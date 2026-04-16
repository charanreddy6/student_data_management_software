import { useState } from "react";
import Home from "./components/Home";
import Upload from "./components/Upload";
import Manage from "./components/Manage";
import "./App.css";

function App() {
  const [page, setPage] = useState("home");

  return (
    <div className="app-container">
      {/* Navigation bar shown on all pages except home */}
      {page !== "home" && (
        <nav className="navbar">
          <span className="nav-brand">Student Data System</span>
          <button className="nav-back" onClick={() => setPage("home")}>
            ← Back to Home
          </button>
        </nav>
      )}

      {page === "home" && <Home setPage={setPage} />}
      {page === "upload" && <Upload setPage={setPage} />}
      {page === "manage" && <Manage setPage={setPage} />}
    </div>
  );
}

export default App;
