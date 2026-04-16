function Home({ setPage }) {
  return (
    <div className="home-container">
      <div className="home-card">
        <h1 className="home-title">Student Data Management System</h1>
        <div className="home-actions">
          <button className="btn btn-primary" onClick={() => setPage("upload")}>
            Upload Data
          </button>

          <button className="btn btn-secondary" onClick={() => setPage("manage")}>
            View / Manage Data
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
