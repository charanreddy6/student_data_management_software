import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";

const API = "http://localhost:8000";

const EMPTY_FILTERS = {
  gender: "", is_passed_out: "", working_currently: "",
  degree: [], branch: [], current_year: [],
  passing_year_from: "", passing_year_to: "",
  age_min: "", age_max: "",
  cgpa_min: "", cgpa_max: "",
  active_arrears_min: "", active_arrears_max: "",
  arrear_history_min: "", arrear_history_max: "",
  no_of_projects_min: "", no_of_projects_max: "",
};

// ── Multi-select dropdown component ──────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  const displayText = selected.length === 0
    ? `All`
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  return (
    <div className="multi-select" ref={ref}>
      <button
        type="button"
        className={`multi-select-btn ${selected.length > 0 ? "multi-select-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        {displayText}
        <span className="multi-select-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="multi-select-dropdown">
          {options.map((opt) => (
            <label key={opt} className="multi-select-option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button className="multi-select-clear" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Manage() {
  const [tables, setTables]               = useState([]);
  const [error, setError]                 = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [tableData, setTableData]         = useState([]);
  const [columns, setColumns]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [searchTerm, setSearchTerm]       = useState("");
  const [searchBy, setSearchBy]           = useState("full_name");
  const [skillSearch, setSkillSearch]     = useState("");
  const [sortOrder, setSortOrder]         = useState("");
  const [filters, setFilters]             = useState(EMPTY_FILTERS);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchTables(); }, []);

  const fetchTables = async () => {
    try {
      const res = await axios.get(`${API}/tables`);
      setTables(res.data.tables);
    } catch {
      setError("Could not connect to the server. Make sure the backend is running.");
    }
  };

  const handleTableChange = async (tableName) => {
    setSelectedTable(tableName);
    setTableData([]);
    setColumns([]);
    if (!tableName) return;
    setLoading(true);
    setError("");
    try {
      const res = tableName === "__all__"
        ? await axios.get(`${API}/tables/all/combined`)
        : await axios.get(`${API}/tables/${tableName}`);
      const rows = res.data.rows;
      setTableData(rows);
      setColumns(rows.length > 0 ? Object.keys(rows[0]) : []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load table data.");
    } finally {
      setLoading(false);
    }
  };

  const setFilter = (key, val) => setFilters((p) => ({ ...p, [key]: val }));
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearchTerm(""); setSkillSearch(""); setSortOrder(""); };

  const handleDeleteTable = async () => {
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/tables/${selectedTable}`);
      await fetchTables();
      setSelectedTable("");
      setTableData([]);
      setColumns([]);
      setDeleteConfirm(false);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete table.");
      setDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };
  const activeFilterCount = Object.values(filters).filter((v) => Array.isArray(v) ? v.length > 0 : v !== "").length + (searchTerm ? 1 : 0) + (skillSearch ? 1 : 0);

  const uniqueVals = (key) =>
    [...new Set(tableData.map((r) => String(r[key] ?? "")).filter(Boolean))].sort();

  const displayData = useMemo(() => {
    const filtered = tableData.filter((row) => {
      if (searchTerm.trim()) {
        if (!String(row[searchBy] ?? "").toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
      }
      if (skillSearch.trim()) {
        if (!String(row.skills ?? "").toLowerCase().includes(skillSearch.trim().toLowerCase())) return false;
      }
      const num = (v) => parseFloat(String(v ?? "").trim());
      const str = (v) => String(v ?? "").trim().toLowerCase();
      if (filters.gender            && str(row.gender)           !== filters.gender.toLowerCase())           return false;
      if (filters.degree.length > 0  && !filters.degree.map(v=>v.toLowerCase()).includes(str(row.degree)))   return false;
      if (filters.branch.length > 0  && !filters.branch.map(v=>v.toLowerCase()).includes(str(row.branch)))   return false;
      if (filters.is_passed_out     && str(row.is_passed_out)    !== filters.is_passed_out.toLowerCase())    return false;
      if (filters.current_year.length > 0 && !filters.current_year.map(v=>v.toLowerCase()).includes(str(row.current_year))) return false;
      if (filters.working_currently && str(row.working_currently)!== filters.working_currently.toLowerCase())return false;
      if (filters.age_min            !== "" && num(row.age)            < num(filters.age_min))            return false;
      if (filters.age_max            !== "" && num(row.age)            > num(filters.age_max))            return false;
      if (filters.cgpa_min           !== "" && num(row.cgpa)           < num(filters.cgpa_min))           return false;
      if (filters.cgpa_max           !== "" && num(row.cgpa)           > num(filters.cgpa_max))           return false;
      if (filters.passing_year_from  !== "" && num(row.passing_year)   < num(filters.passing_year_from))  return false;
      if (filters.passing_year_to    !== "" && num(row.passing_year)   > num(filters.passing_year_to))    return false;
      if (filters.active_arrears_min !== "" && num(row.active_arrears) < num(filters.active_arrears_min)) return false;
      if (filters.active_arrears_max !== "" && num(row.active_arrears) > num(filters.active_arrears_max)) return false;
      if (filters.arrear_history_min !== "" && num(row.arrear_history) < num(filters.arrear_history_min)) return false;
      if (filters.arrear_history_max !== "" && num(row.arrear_history) > num(filters.arrear_history_max)) return false;
      if (filters.no_of_projects_min !== "" && num(row.no_of_projects) < num(filters.no_of_projects_min)) return false;
      if (filters.no_of_projects_max !== "" && num(row.no_of_projects) > num(filters.no_of_projects_max)) return false;
      return true;
    });
    if (sortOrder === "cgpa_desc") filtered.sort((a, b) => parseFloat(b.cgpa) - parseFloat(a.cgpa));
    if (sortOrder === "cgpa_asc")  filtered.sort((a, b) => parseFloat(a.cgpa) - parseFloat(b.cgpa));
    return filtered;
  }, [tableData, searchTerm, searchBy, skillSearch, filters, sortOrder]);

  return (
    <div className="page-container">
      <div className="card">
        <h2 className="card-title">View / Manage Data</h2>
        {error && <div className="alert alert-error">{error}</div>}

        {tables.length === 0 && !error ? (
          <div className="empty-state">
            <p>No tables found in the database.</p>
            <p className="empty-hint">Upload an Excel file to create your first table.</p>
          </div>
        ) : (
          <>
            {/* ══ Single unified section ══ */}
            <div className="filter-section">

              {/* University selector */}
              <div className="filter-row">
                <label className="filter-label">Filter</label>
                <div className="university-row">
                  <select className="filter-select-full" value={selectedTable}
                    onChange={(e) => handleTableChange(e.target.value)}>
                    <option value="">-- Choose a university --</option>
                    <option value="__all__">All Universities</option>
                    {tables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {selectedTable && selectedTable !== "__all__" && (
                    <button
                      className="btn-delete-table"
                      onClick={() => setDeleteConfirm(true)}
                      title="Delete this table"
                    >
                      Delete University
                    </button>
                  )}
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirm && (
                <div className="delete-confirm-box">
                  <p className="delete-confirm-text">
                    Permanently delete university <strong>{selectedTable}</strong>?
                    This will remove all student records in it and cannot be undone.
                  </p>
                  <div className="button-row">
                    <button className="btn btn-outline" onClick={() => setDeleteConfirm(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-danger" onClick={handleDeleteTable} disabled={deleteLoading}>
                      {deleteLoading ? "Deleting..." : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              )}

              {/* Column filters — shown under university once data loads */}
              {tableData.length > 0 && (
                <>
                  <div className="col-filters-header">
                    <span className="col-filters-title">Column Filters</span>
                    {activeFilterCount > 0 && (
                      <button className="clear-filters-btn" onClick={clearFilters}>
                        ✕ Clear all ({activeFilterCount})
                      </button>
                    )}
                  </div>
                  <div className="col-filters-grid">
                    <div className="col-filter-item">
                      <label>Gender</label>
                      <select value={filters.gender} onChange={(e) => setFilter("gender", e.target.value)}>
                        <option value="">All</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-filter-item">
                      <label>Degree</label>
                      <MultiSelect
                        options={uniqueVals("degree")}
                        selected={filters.degree}
                        onChange={(val) => setFilter("degree", val)}
                      />
                    </div>
                    <div className="col-filter-item">
                      <label>Branch</label>
                      <MultiSelect
                        options={uniqueVals("branch")}
                        selected={filters.branch}
                        onChange={(val) => setFilter("branch", val)}
                      />
                    </div>
                    <div className="col-filter-item">
                      <label>Passed Out</label>
                      <select value={filters.is_passed_out} onChange={(e) => {
                        const val = e.target.value;
                        setFilter("is_passed_out", val);
                        if (val === "Yes") {
                          setFilter("current_year", ["-"]);
                          setFilter("active_arrears_min", "0");
                          setFilter("active_arrears_max", "0");
                        } else {
                          setFilter("current_year", []);
                          setFilter("active_arrears_min", "");
                          setFilter("active_arrears_max", "");
                        }
                      }}>
                        <option value="">All</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className="col-filter-item">
                      <label>Current Year</label>
                      <MultiSelect
                        options={["1","2","3","4","-"]}
                        selected={filters.current_year}
                        onChange={(val) => setFilter("current_year", val)}
                      />
                    </div>
                    <div className="col-filter-item">
                      <label>Working Currently</label>
                      <select value={filters.working_currently} onChange={(e) => setFilter("working_currently", e.target.value)}>
                        <option value="">All</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className="col-filter-item range-item">
                      <label>Age</label>
                      <div className="range-inputs">
                        <input type="number" placeholder="Min" min="0" value={filters.age_min} onChange={(e) => setFilter("age_min", e.target.value)} />
                        <span className="range-sep">–</span>
                        <input type="number" placeholder="Max" min="0" value={filters.age_max} onChange={(e) => setFilter("age_max", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-filter-item range-item">
                      <label>CGPA</label>
                      <div className="range-inputs">
                        <input type="number" placeholder="Min" min="0" max="10" step="0.1" value={filters.cgpa_min} onChange={(e) => setFilter("cgpa_min", e.target.value)} />
                        <span className="range-sep">–</span>
                        <input type="number" placeholder="Max" min="0" max="10" step="0.1" value={filters.cgpa_max} onChange={(e) => setFilter("cgpa_max", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-filter-item range-item">
                      <label>Passing Year</label>
                      <div className="range-inputs">
                        <input type="number" placeholder="From" min="2000" value={filters.passing_year_from} onChange={(e) => setFilter("passing_year_from", e.target.value)} />
                        <span className="range-sep">–</span>
                        <input type="number" placeholder="To" min="2000" value={filters.passing_year_to} onChange={(e) => setFilter("passing_year_to", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-filter-item range-item">
                      <label>Active Arrears</label>
                      <div className="range-inputs">
                        <input type="number" placeholder="Min" min="0"
                          disabled={filters.is_passed_out === "Yes"}
                          value={filters.active_arrears_min} onChange={(e) => setFilter("active_arrears_min", e.target.value)} />
                        <span className="range-sep">–</span>
                        <input type="number" placeholder="Max" min="0"
                          disabled={filters.is_passed_out === "Yes"}
                          value={filters.active_arrears_max} onChange={(e) => setFilter("active_arrears_max", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-filter-item range-item">
                      <label>Arrear History</label>
                      <div className="range-inputs">
                        <input type="number" placeholder="Min" min="0" value={filters.arrear_history_min} onChange={(e) => setFilter("arrear_history_min", e.target.value)} />
                        <span className="range-sep">–</span>
                        <input type="number" placeholder="Max" min="0" value={filters.arrear_history_max} onChange={(e) => setFilter("arrear_history_max", e.target.value)} />
                      </div>
                    </div>
                    <div className="col-filter-item range-item">
                      <label>No. of Projects</label>
                      <div className="range-inputs">
                        <input type="number" placeholder="Min" min="0" value={filters.no_of_projects_min} onChange={(e) => setFilter("no_of_projects_min", e.target.value)} />
                        <span className="range-sep">–</span>
                        <input type="number" placeholder="Max" min="0" value={filters.no_of_projects_max} onChange={(e) => setFilter("no_of_projects_max", e.target.value)} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <hr className="section-divider" />

              {/* Search row */}
              <div className="filter-row">
                <label className="filter-label">Search</label>
                <div className="search-attached">
                  <select className="search-by-select" value={searchBy}
                    onChange={(e) => { setSearchBy(e.target.value); setSearchTerm(""); }}>
                    <option value="full_name">By Name</option>
                    <option value="rollno">By Roll No</option>
                  </select>
                  <div className="search-divider" />
                  <input type="text" className="search-input"
                    placeholder={`Search by ${searchBy === "full_name" ? "name" : "roll no"}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={!selectedTable}
                  />
                  {searchTerm && (
                    <button className="search-clear" onClick={() => setSearchTerm("")}>✕</button>
                  )}
                </div>
              </div>

              {/* Skill search row */}
              <div className="filter-row">
                <label className="filter-label">Search by Skill</label>
                <div className="search-attached">
                  <input type="text" className="search-input"
                    placeholder="e.g. Python, React, SQL..."
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    disabled={!selectedTable}
                  />
                  {skillSearch && (
                    <button className="search-clear" onClick={() => setSkillSearch("")}>✕</button>
                  )}
                </div>
              </div>

              {/* Sort row */}
              <div className="filter-row">
                <label className="filter-label">Sort by CGPA</label>
                <select
                  className="filter-select-full"
                  style={{ maxWidth: "260px" }}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  disabled={!selectedTable}
                >
                  <option value="">No Sorting</option>
                  <option value="cgpa_desc">Highest CGPA First</option>
                  <option value="cgpa_asc">Lowest CGPA First</option>
                </select>
              </div>

            </div>

            {/* ══ Data area ══ */}
            {loading && <div className="loading-text">Loading data...</div>}

            {!loading && !selectedTable && (
              <div className="empty-state">
                <p>No data to display.</p>
                <p className="empty-hint">Select a university from the Filter dropdown above.</p>
              </div>
            )}

            {!loading && selectedTable && tableData.length === 0 && (
              <div className="empty-state"><p>This table has no records.</p></div>
            )}

            {!loading && tableData.length > 0 && (
              <div className="table-info">
                <span className="table-meta">
                  {displayData.length === tableData.length
                    ? `${tableData.length} student${tableData.length !== 1 ? "s" : ""} found`
                    : `${displayData.length} of ${tableData.length} student${tableData.length !== 1 ? "s" : ""} found`}
                </span>
                {displayData.length === 0 ? (
                  <div className="empty-state">
                    <p>No students match the current filters.</p>
                    <button className="btn btn-outline" style={{ marginTop: "12px" }} onClick={clearFilters}>
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
                      </thead>
                      <tbody>
                        {displayData.map((row, i) => (
                          <tr key={i}>
                            {columns.map((col) => <td key={col}>{row[col] ?? "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Manage;
