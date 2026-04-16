# Student Data Management System

A full-stack web application for uploading, storing, and managing student records from multiple universities using Excel files.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Axios |
| Backend | FastAPI, Python 3.13 |
| Database | MySQL 8.0 |
| Data Processing | Pandas, OpenPyXL |

---

## Features

### Upload
- Upload `.xlsx` / `.xls` Excel files containing student data
- Automatic column name cleaning (lowercase, spaces → underscores)
- Strict schema validation — all 15 required columns must be present
- Per-row data validation with detailed error messages
- **Create New Table** — dynamically creates a typed MySQL table and inserts all rows
- **Merge with Existing Table** — appends data to an existing table with duplicate detection

### Duplicate Handling (Merge)
- Before any data is written, the backend checks for matching roll numbers
- If duplicates are found, the user is shown the count and list of duplicate roll numbers
- User can **Cancel** (nothing is written) or **Merge Anyway** (existing records are updated with latest data, new records are inserted)

### View / Manage Data
- Select any university (table) from a dropdown to load its data
- Select **All Universities** to view combined data from all tables with a `university` column appended
- **Column Filters** — filter by Gender, Degree, Branch, Passed Out, Current Year, Working Currently, Age range, CGPA range, Passing Year range, Active Arrears range, Arrear History range, No. of Projects range
- Smart filter rules — selecting "Passed Out = Yes" auto-disables Current Year and Active Arrears filters
- **Search** — search by student name or roll number
- All filtering and search happens in the browser — no extra API calls

---

## Required Excel Schema

The uploaded Excel file must contain exactly these 15 columns (in any order):

| # | Column Name | Format / Rule |
|---|---|---|
| 1 | `rollno` | Exactly 6 digits |
| 2 | `full_name` | Non-empty string |
| 3 | `gender` | Male / Female / Other |
| 4 | `age` | Positive integer |
| 5 | `degree` | e.g. B.E, B.Tech, M.E |
| 6 | `branch` | e.g. CSE, ECE, MECH |
| 7 | `cgpa` | Decimal, 0 – 10 |
| 8 | `is_passed_out` | Yes / No |
| 9 | `current_year` | 1 / 2 / 3 / 4 — or `-` for passed-out students |
| 10 | `passing_year` | 4-digit year e.g. 2025 |
| 11 | `active_arrears` | Non-negative integer — must be `0` for passed-out students |
| 12 | `arrear_history` | Non-negative integer |
| 13 | `skills` | Comma-separated e.g. `Python, React, SQL` |
| 14 | `no_of_projects` | Non-negative integer |
| 15 | `working_currently` | Yes / No |

---

## Project Structure

```
student-data-system/
├── backend/
│   ├── main.py            # FastAPI app — all API endpoints + validation logic
│   ├── db.py              # MySQL connection
│   └── requirements.txt   # Python dependencies
├── frontend/
│   └── src/
│       ├── App.jsx         # Root component + routing
│       ├── App.css         # All styles
│       └── components/
│           ├── Home.jsx    # Landing page
│           ├── Upload.jsx  # Upload + create/merge flow
│           └── Manage.jsx  # View, filter, and search data
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload Excel file — validates schema and stores in memory |
| `POST` | `/create-table` | Create a new MySQL table and insert uploaded data |
| `POST` | `/merge` | Check duplicates and merge data into an existing table |
| `GET` | `/tables` | List all tables in the database |
| `GET` | `/tables/all/combined` | Fetch all rows from all tables with a `university` column |
| `GET` | `/tables/{table_name}` | Fetch all rows from a specific table |

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0 running locally

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/charanreddy6/student_data_management_software.git
cd student-data-system
```

### 2. MySQL — Create the database

Open MySQL Workbench or any MySQL client and run:

```sql
CREATE DATABASE `student-data-management`;
```

### 3. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt
```

Update your MySQL credentials in `backend/db.py`:

```python
def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="your_password",   # ← change this
        database="student-data-management"
    )
```

Start the backend server:

```bash
uvicorn main:app --reload
```

Backend runs at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## How It Works

```
Excel File
    ↓
POST /upload  →  Pandas reads & validates  →  stored in memory
    ↓
User chooses: Create Table  or  Merge
    ↓
POST /create-table          POST /merge (force=false)
    ↓                              ↓
MySQL CREATE TABLE         Check duplicate rollnos
INSERT all rows                    ↓
                        Duplicates? → Show warning to user
                                   ↓
                        Cancel → nothing written
                        Merge  → UPDATE duplicates + INSERT new rows
```

```
View / Manage
    ↓
GET /tables/{name}  →  SELECT * FROM table  →  JSON to React
    ↓
React holds rows in state
    ↓
Filter / Search  →  browser-side .filter()  →  no extra API call
```

---

## Security

- Table names are sanitized with a regex (`[^\w]` → `_`) to prevent SQL injection
- All database queries use parameterized statements (`%s` placeholders)
- Column names are validated against a strict whitelist before any DB operation
- CORS is restricted to `http://localhost:5173`

---

## License

MIT
