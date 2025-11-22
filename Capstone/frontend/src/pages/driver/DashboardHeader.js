import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import 'bootstrap-icons/font/bootstrap-icons.css';
import "./Dashboard.css";

const DashboardHeader = ({ title = "Driver's Dashboard", onToggleSchedule }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

const handleLogout = () => {
  localStorage.removeItem("driverSession");
  sessionStorage.clear();
  navigate("/");   // back to LoginPage (driver login)
};

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <header className="dashboard-header">
      {/* 🍔 Burger Button */}
      <button className="menu-btn" onClick={toggleMenu}>
        <i className="bi bi-list"></i>
      </button>

      <h1 className="Driverheader-title">{title}</h1>

      {/* 📋 Dropdown Menu */}
      {menuOpen && (
        <div className="side-menu">
          <button
            onClick={() => {
              onToggleSchedule();
              setMenuOpen(false);
            }}
          >
            <i className="bi bi-calendar-week"></i> My Schedule
          </button>
          <button onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i> Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default DashboardHeader;
