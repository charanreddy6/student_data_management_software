import re
import io
import pandas as pd
import mysql.connector
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from db import get_db

app = FastAPI(title="Student Data Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stored_df: pd.DataFrame | None = None

# ─── Expected columns (exact names after cleaning) ────────────────────────────
REQUIRED_COLUMNS = [
    "rollno",
    "full_name",
    "gender",
    "age",
    "degree",
    "branch",
    "cgpa",
    "is_passed_out",
    "current_year",
    "passing_year",
    "active_arrears",
    "arrear_history",
    "skills",
    "no_of_projects",
    "working_currently",
    "phone_number",
    "email",
]

# ─── Per-column validation rules ──────────────────────────────────────────────
def validate_student_data(df: pd.DataFrame) -> list[str]:
    """
    Validate every row against the student schema rules.
    Returns a list of error strings (empty list = all good).
    """
    errors = []

    for i, row in df.iterrows():
        row_num = i + 2  # Excel row number (1-indexed header + 1)
        prefix = f"Row {row_num}"

        # 1. rollno — must be exactly 6 digits
        rollno = str(row.get("rollno", "")).strip()
        if not re.fullmatch(r"\d{6}", rollno):
            errors.append(f"{prefix}: 'rollno' must be a 6-digit number (got '{rollno}').")

        # 2. full_name — must not be empty
        full_name = str(row.get("full_name", "")).strip()
        if not full_name or full_name.lower() == "nan":
            errors.append(f"{prefix}: 'full_name' cannot be empty.")

        # 3. gender — Male / Female / Other
        gender = str(row.get("gender", "")).strip().lower()
        if gender not in ("male", "female", "other"):
            errors.append(f"{prefix}: 'gender' must be Male, Female, or Other (got '{row.get('gender')}').")

        # 4. age — positive integer
        try:
            age = int(float(str(row.get("age", "")).strip()))
            if age <= 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append(f"{prefix}: 'age' must be a positive integer (got '{row.get('age')}').")

        # 5. degree — not empty
        degree = str(row.get("degree", "")).strip()
        if not degree or degree.lower() == "nan":
            errors.append(f"{prefix}: 'degree' cannot be empty.")

        # 6. branch — not empty
        branch = str(row.get("branch", "")).strip()
        if not branch or branch.lower() == "nan":
            errors.append(f"{prefix}: 'branch' cannot be empty.")

        # 7. cgpa — numeric, 0 <= cgpa <= 10
        try:
            cgpa = float(str(row.get("cgpa", "")).strip())
            if not (0 <= cgpa <= 10):
                raise ValueError
        except (ValueError, TypeError):
            errors.append(f"{prefix}: 'cgpa' must be a number between 0 and 10 (got '{row.get('cgpa')}').")

        # 8. is_passed_out — yes / no
        is_passed_out_raw = str(row.get("is_passed_out", "")).strip().lower()
        if is_passed_out_raw not in ("yes", "no"):
            errors.append(f"{prefix}: 'is_passed_out' must be Yes or No (got '{row.get('is_passed_out')}').")

        passed_out = is_passed_out_raw == "yes"

        # 9. current_year — must be '-' for passed out, else 1/2/3/4
        year_val = str(row.get("current_year", "")).strip()
        if passed_out:
            if year_val != "-":
                errors.append(f"{prefix}: 'current_year' must be '-' for passed-out students (got '{year_val}').")
        else:
            if year_val not in ("1", "2", "3", "4"):
                errors.append(f"{prefix}: 'current_year' must be 1, 2, 3, or 4 for current students (got '{year_val}').")

        # 10. passing_year — 4-digit year
        year_out = str(row.get("passing_year", "")).strip()
        if not re.fullmatch(r"\d{4}", year_out):
            errors.append(f"{prefix}: 'passing_year' must be a 4-digit year (got '{year_out}').")

        # 11. active_arrears — must be 0 for passed-out students, else non-negative integer
        try:
            active_arr = int(float(str(row.get("active_arrears", "")).strip()))
            if active_arr < 0:
                raise ValueError
            if passed_out and active_arr != 0:
                errors.append(f"{prefix}: 'active_arrears' must be 0 for passed-out students (got '{active_arr}').")
        except (ValueError, TypeError):
            errors.append(f"{prefix}: 'active_arrears' must be a non-negative integer (got '{row.get('active_arrears')}').")

        # 12. arrear_history — non-negative integer
        try:
            arr_hist = int(float(str(row.get("arrear_history", "")).strip()))
            if arr_hist < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append(f"{prefix}: 'arrear_history' must be a non-negative integer (got '{row.get('arrear_history')}').")

        # 13. skills — not empty (comma-separated is fine, just can't be blank)
        skills = str(row.get("skills", "")).strip()
        if not skills or skills.lower() == "nan":
            errors.append(f"{prefix}: 'skills' cannot be empty. Use comma-separated values.")

        # 14. no_of_projects — non-negative integer
        try:
            projects = int(float(str(row.get("no_of_projects", "")).strip()))
            if projects < 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append(f"{prefix}: 'no_of_projects' must be a non-negative integer (got '{row.get('no_of_projects')}').")

        # 15. working_currently — yes / no
        working = str(row.get("working_currently", "")).strip().lower()
        if working not in ("yes", "no"):
            errors.append(f"{prefix}: 'working_currently' must be Yes or No (got '{row.get('working_currently')}').")

        # 16. phone_number — 10 digits
        phone = str(row.get("phone_number", "")).strip()
        if not re.fullmatch(r"\d{10}", phone):
            errors.append(f"{prefix}: 'phone_number' must be a 10-digit number (got '{phone}').")

        # 17. email — basic email format
        email = str(row.get("email", "")).strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            errors.append(f"{prefix}: 'email' must be a valid email address (got '{email}').")

        # Stop early if too many errors (avoid flooding)
        if len(errors) >= 20:
            errors.append("... too many errors. Fix the above and re-upload.")
            break

    return errors


# ─── Helpers ──────────────────────────────────────────────────────────────────

def sanitize_table_name(name: str) -> str:
    sanitized = re.sub(r"[^\w]", "_", name.strip())
    if not sanitized or sanitized[0].isdigit():
        raise HTTPException(
            status_code=400,
            detail="Invalid table name. Use letters, numbers, and underscores only. Must not start with a digit."
        )
    return sanitized.lower()


def clean_value(v):
    """Convert NaN / blank to None, otherwise return string."""
    if pd.isna(v):
        return None
    s = str(v).strip()
    return None if s == "" else s


# ─── Request Models ────────────────────────────────────────────────────────────

class CreateTableRequest(BaseModel):
    table_name: str


class MergeRequest(BaseModel):
    table_name: str
    force: bool = False   # if True, overwrite duplicates; if False, abort on duplicates


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """
    Accept an Excel file, validate it against the student schema, and return
    columns + existing table list on success.
    """
    global stored_df

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported.")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded Excel file is empty.")

    # Clean column names
    df.columns = [re.sub(r"[\s/\.]+", "_", col.strip()).lower() for col in df.columns]
    df = df.loc[:, df.columns.str.strip() != ""]

    # ── Check required columns ──
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    extra_cols   = [c for c in df.columns if c not in REQUIRED_COLUMNS]

    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {missing_cols}\n\n"
                   f"Expected columns: {REQUIRED_COLUMNS}"
        )
    if extra_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Unexpected columns found: {extra_cols}\n\n"
                   f"Only these columns are allowed: {REQUIRED_COLUMNS}"
        )

    # Reorder to canonical order
    df = df[REQUIRED_COLUMNS]

    # ── Validate row data ──
    errors = validate_student_data(df)
    if errors:
        raise HTTPException(
            status_code=422,
            detail="Validation failed:\n\n" + "\n".join(errors)
        )

    stored_df = df

    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "columns": df.columns.tolist(),
        "row_count": len(df),
        "tables": tables
    }


@app.post("/create-table")
def create_table(body: CreateTableRequest):
    global stored_df

    if stored_df is None:
        raise HTTPException(status_code=400, detail="No file uploaded. Please upload an Excel file first.")

    table_name = sanitize_table_name(body.table_name)

    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SHOW TABLES LIKE %s", (table_name,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Table '{table_name}' already exists. Choose a different name.")

        # Use typed columns for the known schema
        create_sql = f"""
            CREATE TABLE `{table_name}` (
                `id`                        INT AUTO_INCREMENT PRIMARY KEY,
                `rollno`                    CHAR(6)         NOT NULL,
                `full_name`                 VARCHAR(255)    NOT NULL,
                `gender`                    VARCHAR(10)     NOT NULL,
                `age`                       TINYINT UNSIGNED NOT NULL,
                `degree`                    VARCHAR(100)    NOT NULL,
                `branch`                    VARCHAR(100)    NOT NULL,
                `cgpa`                      DECIMAL(4,2)    NOT NULL,
                `is_passed_out`             VARCHAR(3)      NOT NULL,
                `current_year`              VARCHAR(5)      NOT NULL,
                `passing_year`              YEAR            NOT NULL,
                `active_arrears`            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                `arrear_history`            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                `skills`                    TEXT            NOT NULL,
                `no_of_projects`            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                `working_currently`         VARCHAR(3)      NOT NULL,
                `phone_number`              CHAR(10)        NOT NULL,
                `email`                     VARCHAR(255)    NOT NULL
            )
        """
        cursor.execute(create_sql)

        _insert_rows(cursor, table_name, stored_df)

        conn.commit()
        cursor.close()
        conn.close()

    except HTTPException:
        raise
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"message": f"Table '{table_name}' created and {len(stored_df)} rows inserted successfully."}


@app.post("/merge")
def merge(body: MergeRequest):
    global stored_df

    if stored_df is None:
        raise HTTPException(status_code=400, detail="No file uploaded. Please upload an Excel file first.")

    table_name = sanitize_table_name(body.table_name)

    try:
        conn = get_db()
        cursor = conn.cursor()

        # Validate columns
        cursor.execute(f"DESCRIBE `{table_name}`")
        db_columns = [row[0] for row in cursor.fetchall() if row[0] != "id"]

        excel_columns = stored_df.columns.tolist()
        missing_in_excel = set(db_columns) - set(excel_columns)
        extra_in_excel   = set(excel_columns) - set(db_columns)

        if missing_in_excel or extra_in_excel:
            detail = "Column mismatch detected.\n"
            if missing_in_excel:
                detail += f"In table but missing in Excel: {sorted(missing_in_excel)}\n"
            if extra_in_excel:
                detail += f"Extra in Excel not in table: {sorted(extra_in_excel)}"
            raise HTTPException(status_code=400, detail=detail)

        # Find duplicate rollnos
        excel_rollnos = stored_df["rollno"].astype(str).tolist()
        placeholders  = ", ".join(["%s"] * len(excel_rollnos))
        cursor.execute(f"SELECT rollno FROM `{table_name}` WHERE rollno IN ({placeholders})", excel_rollnos)
        duplicate_rollnos = [str(row[0]) for row in cursor.fetchall()]

        # If duplicates found and user hasn't confirmed force-merge, return info
        if duplicate_rollnos and not body.force:
            cursor.close()
            conn.close()
            return {
                "status": "duplicates_found",
                "duplicate_count": len(duplicate_rollnos),
                "duplicate_rollnos": duplicate_rollnos,
                "message": f"{len(duplicate_rollnos)} duplicate roll number(s) found."
            }

        # Separate new rows and duplicate rows
        new_rows  = stored_df[~stored_df["rollno"].astype(str).isin(duplicate_rollnos)]
        dup_rows  = stored_df[stored_df["rollno"].astype(str).isin(duplicate_rollnos)]

        col_list     = ", ".join([f"`{c}`" for c in db_columns])
        placeholders = ", ".join(["%s"] * len(db_columns))
        insert_sql   = f"INSERT INTO `{table_name}` ({col_list}) VALUES ({placeholders})"

        # Update existing rows for duplicates (keep latest data)
        if not dup_rows.empty:
            set_clause = ", ".join([f"`{c}` = %s" for c in db_columns if c != "rollno"])
            update_sql = f"UPDATE `{table_name}` SET {set_clause} WHERE `rollno` = %s"
            for _, row in dup_rows[db_columns].iterrows():
                non_rollno_vals = [clean_value(row[c]) for c in db_columns if c != "rollno"]
                cursor.execute(update_sql, non_rollno_vals + [clean_value(row["rollno"])])

        # Insert new rows
        if not new_rows.empty:
            for _, row in new_rows[db_columns].iterrows():
                cursor.execute(insert_sql, [clean_value(v) for v in row])

        conn.commit()
        cursor.close()
        conn.close()

    except HTTPException:
        raise
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "status": "success",
        "message": f"{len(new_rows)} new rows inserted, {len(dup_rows)} duplicate rows updated in '{table_name}'."
    }


@app.get("/tables/all/combined")
def get_all_tables_combined():
    """Return all rows from all tables combined, with a 'university' column added."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SHOW TABLES")
        tables = [row[list(row.keys())[0]] for row in cursor.fetchall()]

        combined = []
        for table in tables:
            cursor.execute(f"SELECT * FROM `{table}`")
            rows = cursor.fetchall()
            for row in rows:
                row["university"] = table
                combined.append(row)

        cursor.close()
        conn.close()
        return {"rows": combined, "total": len(combined)}
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/tables")
def get_tables():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        cursor.close()
        conn.close()
        return {"tables": tables}
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.delete("/tables/{table_name}")
def delete_table(table_name: str):
    """Permanently drop a table from the database."""
    table_name = sanitize_table_name(table_name)
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
        conn.commit()
        cursor.close()
        conn.close()
        return {"message": f"Table '{table_name}' deleted successfully."}
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/tables/{table_name}")
def get_table_data(table_name: str):
    table_name = sanitize_table_name(table_name)
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT * FROM `{table_name}`")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"table": table_name, "rows": rows}
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ─── Internal helper ──────────────────────────────────────────────────────────

def _insert_rows(cursor, table_name: str, df: pd.DataFrame):
    columns = df.columns.tolist()
    col_list = ", ".join([f"`{c}`" for c in columns])
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = f"INSERT INTO `{table_name}` ({col_list}) VALUES ({placeholders})"
    for _, row in df.iterrows():
        values = [clean_value(v) for v in row]
        cursor.execute(insert_sql, values)
