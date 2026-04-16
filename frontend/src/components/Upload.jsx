import { useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

// Canonical columns the backend expects
const EXPECTED_COLUMNS = [
  { name: "rollno",                    note: "6-digit number" },
  { name: "full_name",                 note: "Student's full name" },
  { name: "gender",                    note: "Male / Female / Other" },
  { name: "age",                       note: "Positive integer" },
  { name: "degree",                    note: "e.g. B.E, B.Tech, M.E" },
  { name: "branch",                    note: "e.g. CSE, ECE, MECH" },
  { name: "cgpa",                      note: "0 – 10" },
  { name: "is_passed_out",             note: "Yes / No" },
  { name: "current_year",   note: "1 / 2 / 3 / 4  (or '-' if passed out)" },
  { name: "passing_year",  note: "4-digit year e.g. 2025" },
  { name: "active_arrears",            note: "Number  (must be 0 for passed-out students)" },
  { name: "arrear_history",            note: "Total arrears ever" },
  { name: "skills",                    note: "Comma-separated e.g. Python, React" },
  { name: "no_of_projects",            note: "Non-negative integer" },
  { name: "working_currently",         note: "Yes / No" },
];

const STEP = {
  SELECT_FILE:   "select_file",
  CHOOSE_ACTION: "choose_action",
  CREATE_TABLE:  "create_table",
  MERGE_TABLE:   "merge_table",
  DONE:          "done",
};

function Upload() {
  const [file, setFile]               = useState(null);
  const [columns, setColumns]         = useState([]);
  const [rowCount, setRowCount]       = useState(0);
  const [tables, setTables]           = useState([]);
  const [step, setStep]               = useState(STEP.SELECT_FILE);
  const [tableName, setTableName]     = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [successMsg, setSuccessMsg]   = useState("");

  // Duplicate confirmation state
  const [dupInfo, setDupInfo]         = useState(null); // { count, rollnos }

  const clearMessages = () => { setError(""); setSuccessMsg(""); };

  // ── Upload file ──────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    clearMessages();
    const selected = e.target.files[0];
    if (selected && !selected.name.match(/\.(xlsx|xls)$/i)) {
      setError("Please select a valid Excel file (.xlsx or .xls).");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) { setError("Please select an Excel file first."); return; }
    clearMessages();
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/upload`, formData);
      setColumns(res.data.columns);
      setRowCount(res.data.row_count);
      setTables(res.data.tables);
      setStep(STEP.CHOOSE_ACTION);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Create table ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!tableName.trim()) { setError("Please enter a table name."); return; }
    clearMessages();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/create-table`, { table_name: tableName.trim() });
      setSuccessMsg(res.data.message);
      setStep(STEP.DONE);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create table.");
    } finally {
      setLoading(false);
    }
  };

  // ── Merge (first attempt — checks duplicates) ────────────────────────────
  const handleMerge = async () => {
    if (!selectedTable) { setError("Please select a table to merge into."); return; }
    clearMessages();
    setDupInfo(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merge`, { table_name: selectedTable, force: false });
      if (res.data.status === "duplicates_found") {
        setDupInfo({ count: res.data.duplicate_count, rollnos: res.data.duplicate_rollnos });
      } else {
        setSuccessMsg(res.data.message);
        setStep(STEP.DONE);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Merge failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Force merge (user confirmed duplicates) ──────────────────────────────
  const handleForceMerge = async () => {
    clearMessages();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merge`, { table_name: selectedTable, force: true });
      setSuccessMsg(res.data.message);
      setDupInfo(null);
      setStep(STEP.DONE);
    } catch (err) {
      setError(err.response?.data?.detail || "Merge failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setFile(null); setColumns([]); setRowCount(0); setTables([]);
    setTableName(""); setSelectedTable("");
    setDupInfo(null);
    setStep(STEP.SELECT_FILE); clearMessages();
  };

  return (
    <div className="page-container">
      <div className="card">
        <h2 className="card-title">Upload Excel Data</h2>

        {/* Progress */}
        <div className="progress-steps">
          <span className={`progress-step ${step !== STEP.SELECT_FILE ? "done" : "active"}`}>
            1. Select File
          </span>
          <span className="progress-divider">›</span>
          <span className={`progress-step ${
            [STEP.CHOOSE_ACTION, STEP.CREATE_TABLE, STEP.MERGE_TABLE].includes(step)
              ? "active" : step === STEP.DONE ? "done" : ""
          }`}>
            2. Choose Action
          </span>
          <span className="progress-divider">›</span>
          <span className={`progress-step ${step === STEP.DONE ? "done active" : ""}`}>
            3. Done
          </span>
        </div>

        {/* Messages */}
        {error    && <div className="alert alert-error">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {/* ── Step 1: File selection ── */}
        {step === STEP.SELECT_FILE && (
          <div className="step-content">

            {/* Schema reference guide */}
            <div className="schema-guide">
              <div className="schema-guide-header">Required Excel Columns</div>
              <table className="schema-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Column Name</th>
                    <th>Rule / Format</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPECTED_COLUMNS.map((col, idx) => (
                    <tr key={col.name}>
                      <td className="schema-num">{idx + 1}</td>
                      <td><code>{col.name}</code></td>
                      <td className="schema-note">{col.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="file-drop-area">
              <input
                type="file"
                id="file-input"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="file-input-hidden"
              />
              <label htmlFor="file-input" className="file-label">
                {file ? (
                  <>
                    <span className="file-name">{file.name}</span>
                    <span className="file-hint">Click to change file</span>
                  </>
                ) : (
                  <>
                    <span className="file-name">Click to select Excel file</span>
                    <span className="file-hint">Supports .xlsx and .xls</span>
                  </>
                )}
              </label>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={handleUpload}
              disabled={loading || !file}
            >
              {loading ? "Validating & Uploading..." : "Upload & Continue →"}
            </button>
          </div>
        )}

        {/* ── Step 2: Choose action ── */}
        {step === STEP.CHOOSE_ACTION && (
          <div className="step-content">
            <div className="upload-summary">
              <p><strong>File:</strong> {file.name}</p>
              <p>
                <strong>Rows:</strong> {rowCount} &nbsp;|&nbsp;
                <strong>Columns:</strong> {columns.length}
              </p>
              <div className="column-tags">
                {columns.map((col) => <span key={col} className="tag">{col}</span>)}
              </div>
            </div>

            <h3 className="section-label">What would you like to do?</h3>
            <div className="action-buttons">
              <button
                className="btn btn-primary"
                onClick={() => { clearMessages(); setStep(STEP.CREATE_TABLE); }}
              >
                Create New Table
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { clearMessages(); setStep(STEP.MERGE_TABLE); }}
                disabled={tables.length === 0}
                title={tables.length === 0 ? "No existing tables found" : ""}
              >
                Merge with Existing Table
                {tables.length === 0 && <span className="btn-note"> (no tables yet)</span>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2a: Create table ── */}
        {step === STEP.CREATE_TABLE && (
          <div className="step-content">
            <h3 className="section-label">Create New Table</h3>
            <p className="section-hint">
              A new table will be created with the 15 student columns + auto-increment id.
            </p>

            <div className="input-group">
              <label htmlFor="table-name">Table Name</label>
              <input
                id="table-name"
                type="text"
                placeholder="e.g. students_2024"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <span className="input-hint">Letters, numbers, and underscores only</span>
            </div>

            <div className="button-row">
              <button className="btn btn-outline" onClick={() => setStep(STEP.CHOOSE_ACTION)}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Creating..." : "Create Table"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2b: Merge table ── */}
        {step === STEP.MERGE_TABLE && (
          <div className="step-content">
            <h3 className="section-label">Merge into Existing Table</h3>
            <p className="section-hint">
              Data will be appended to the selected table. Columns must match exactly.
            </p>

            <div className="input-group">
              <label htmlFor="table-select">Select Table</label>
              <select
                id="table-select"
                value={selectedTable}
                onChange={(e) => { setSelectedTable(e.target.value); setDupInfo(null); }}
              >
                <option value="">-- Select a table --</option>
                {tables.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Duplicate warning */}
            {dupInfo && (
              <div className="dup-warning">
                <div className="dup-warning-title">
                  Duplicate Roll Numbers Found
                </div>
                <p className="dup-warning-body">
                  <strong>{dupInfo.count}</strong> roll number{dupInfo.count !== 1 ? "s" : ""} in
                  the Excel file already exist in this table.
                </p>
                <p className="dup-warning-body">
                  Selecting <strong>Merge</strong> will update those records with the latest data
                  from the Excel file. New records will be inserted normally.
                </p>
                <div className="dup-rollnos">
                  {dupInfo.rollnos.slice(0, 10).map((r) => (
                    <span key={r} className="tag">{r}</span>
                  ))}
                  {dupInfo.rollnos.length > 10 && (
                    <span className="tag">+{dupInfo.rollnos.length - 10} more</span>
                  )}
                </div>
                <div className="button-row" style={{ marginTop: "14px" }}>
                  <button className="btn btn-outline"
                    onClick={() => { setDupInfo(null); clearMessages(); }}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleForceMerge} disabled={loading}>
                    {loading ? "Merging..." : "Merge Anyway"}
                  </button>
                </div>
              </div>
            )}

            {!dupInfo && (
              <div className="button-row">
                <button className="btn btn-outline" onClick={() => setStep(STEP.CHOOSE_ACTION)}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleMerge} disabled={loading}>
                  {loading ? "Checking..." : "Merge Data"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === STEP.DONE && (
          <div className="step-content done-step">
            <div className="done-icon"></div>
            <p className="done-text">{successMsg}</p>
            <button className="btn btn-primary" onClick={handleReset}>
              Upload Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Upload;
