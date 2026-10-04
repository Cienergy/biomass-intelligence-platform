import { NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-title">Biomass Intelligence</div>
            <div className="brand-sub">Catchment optimisation · India</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Explorer
          </NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/report">Report</NavLink>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
