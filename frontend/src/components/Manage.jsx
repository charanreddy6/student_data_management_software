import { useState, useEffect, useMemo } from "react";
import axios from "axios";

const API = "http://localhost:8000";

const EMPTY_FILTERS = {
  gender: "", degree: "", branch: "", is_passed_out: "",
  current_year: "", working_currently: "",
  passing_year_from: "", passing_year_to: "",
  age_min: "", age_max: "",
  cgpa_min: "", cgpa_max: "",
  active_arrears_min: "", active_arrears_max: "",
  arrear_history_min: "", arrear_history_max: "",
  no_of_projects_min: "", no_of_projects_max: "",
};

function Manage() {
  const [tables, setTables]               = useState([]);
  const [error, setError]                 = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [tableData, setTableData]         = useState([]);
  const [columns, setColumns]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [searchTerm, setSearchTerm]       = useState("");
  const [searchBy, setSearchBy]           = useState("full_name");
  const [filters, setFilters]             = useState(EMPTY_FILTERS);

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
    setSearchTerm("");
    setFilters(EMPTY_FILTERS);
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
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setSearchTerm(""); };
  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length + (searchTerm ? 1 : 0);

  const uniqueVals = (key) =>
    [...new Set(tableData.map((r) => String(r[key] ?? "")).filter(Boolean))].sort();

  const displayData = useMemo(() => {
    return tableData.filter((row) => {
      if (searchTerm.trim()) {
        if (!String(row[searchBy] ?? "").toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
      }
      const num = (v) => parseFloat(String(v ?? "").trim());
      const str = (v) => String(v ?? "").trim().toLowerCase();
      if (filters.gender            && str(row.gender)           !== filters.gender.toLowerCase())           return false;
      if (filters.degree            && str(row.degree)           !== filters.degree.toLowerCase())           return false;
      if (filters.branch            && str(row.branch)           !== filters.branch.toLowerCase())           return false;
      if (filters.is_passed_out     && str(row.is_passed_out)    !== filters.is_passed_out.toLowerCase())    return false;
      if (filters.current_year      && str(row.current_year)     !== filters.current_year.toLowerCase())     return false;
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
  }, [tableData, searchTerm, searchBy, filters]);

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
                <select className="filter-select-full" value={selectedTable}
                  onChange={(e) => handleTableChange(e.target.value)}>
                  <option value="">-- Choose a university --</option>
                  <option value="__all__">All Universities</option>
                  {tables.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

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
                      <select value={filters.degree} onChange={(e) => setFilter("degree", e.target.value)}>
                        <option value="">All</option>
                        {uniqueVals("degree").map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-filter-item">
                      <label>Branch</label>
                      <select value={filters.branch} onChange={(e) => setFilter("branch", e.target.value)}>
                        <option value="">All</option>
                        {uniqueVals("branch").map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="col-filter-item">
                      <label>Passed Out</label>
                      <select value={filters.is_passed_out} onChange={(e) => {
                        const val = e.target.value;
                        setFilter("is_passed_out", val);
                        if (val === "Yes") {
                          setFilter("current_year", "-");
                          setFilter("active_arrears_min", "0");
                          setFilter("active_arrears_max", "0");
                        } else if (val !== "Yes") {
                          setFilter("current_year", "");
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
                      <select value={filters.current_year}
                        disabled={filters.is_passed_out === "Yes"}
                        onChange={(e) => setFilter("current_year", e.target.value)}>
                        <option value="">All</option>
                        <option value="1">1</option><option value="2">2</option>
                        <option value="3">3</option><option value="4">4</option>
                        <option value="-">- (Passed out)</option>
                      </select>
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
