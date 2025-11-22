import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import logo from '../../../assets/logo.jpg';
import dashboardIcon from '../../../assets/dashboard.png';
import dashboardWhite from '../../../assets/dashboardWhite.png';
import notifIcon from '../../../assets/notif.png';
import notifWhite from '../../../assets/notifWhite.png';
import logoutIcon from '../../../assets/logout_admin.png';
import logoutWhite from '../../../assets/logout_admin_w.png';
import userIcon from '../../../assets/user.png';
import userWhite from '../../../assets/userWhite.png';
import { Link } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/admin.css';

const HeaderComponent = () => {
  const location = useLocation();
  const isDashboard = location.pathname === "/admin";
  const [menuOpen, setMenuOpen] = useState(false);

  const getTitle = () => {
    if (location.pathname === "/admin/users") return "User Management"
    else if (location.pathname === "/admin/routes") return "Route Management"
    else if (location.pathname === "/admin/schedules") return "Schedule Management"
    else if (location.pathname === "/admin/shuttles") return "Shuttle Management"
    else if (location.pathname === "/admin/maintenance") return "Maintenance Management"
    else if (location.pathname === "/admin/reports") return "Report Management";
    return "Admin Panel";
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className={`admin-header ${isDashboard ? 'header-white' : 'header-orange'}`}>
        <div className="header-content"> 
            {isDashboard ? (
            <img src={logo} alt="Logo" className="headerLogo" />
            ) : (
            <h1 className="header-title">{getTitle()}</h1>
            )}
            
            {/* Burger Menu Button - Mobile Only */}
            <button className="burger-menu-btn" onClick={toggleMenu} aria-label="Menu">
              <i className={`bi ${menuOpen ? 'bi-x-lg' : 'bi-list'}`}></i>
            </button>

            {/* Desktop Icons */}
            <div className="header-icons desktop-icons">
              {isDashboard ? (
                <>
                <Link to="/admin" onClick={closeMenu}>
                  <img src={dashboardIcon} alt="Dashboard" className="icon-img" />
                </Link>
                <Link to="/" onClick={closeMenu}>
                  <img src={logoutIcon} alt="Logout" className="icon-img" />
                </Link>
                </>
              ) : (
                <>
                <Link to="/admin" onClick={closeMenu}>
                  <img src={dashboardWhite} alt="Dashboard" className="icon-img" />
                </Link>
                <Link to="/" onClick={closeMenu}>
                  <img src={logoutWhite} alt="Logout" className="icon-img" />
                </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Dropdown */}
            {menuOpen && (
              <div className="mobile-menu-dropdown">
                {isDashboard ? (
                  <>
                  <Link to="/admin" onClick={closeMenu} className="mobile-menu-item">
                    <img src={dashboardIcon} alt="Dashboard" className="mobile-icon" />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/" onClick={closeMenu} className="mobile-menu-item">
                    <img src={logoutIcon} alt="Logout" className="mobile-icon" />
                    <span>Logout</span>
                  </Link>
                  </>
                ) : (
                  <>
                  <Link to="/admin" onClick={closeMenu} className="mobile-menu-item">
                    <img src={dashboardWhite} alt="Dashboard" className="mobile-icon" />
                    <span>Dashboard</span>
                  </Link>
                  <Link to="/" onClick={closeMenu} className="mobile-menu-item">
                    <img src={logoutWhite} alt="Logout" className="mobile-icon" />
                    <span>Logout</span>
                  </Link>
                  </>
                )}
              </div>
            )}
        </div>
    </header>
  );
};

export default HeaderComponent;
