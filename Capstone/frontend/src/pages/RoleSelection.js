import React from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import logo from "../assets/logo.jpg"; 
import "./roleSelectStyle.css";

const RoleSelectionPage = () => {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    navigate(`/login/${role}`);
  };

  return (
    <div className="role-select-container d-flex flex-column flex-md-row vh-100">
      {/* Left Side */}
      <div className="info-section d-flex flex-column align-items-center justify-content-center text-center p-5">
        <img src={logo} alt="Logo" className="mb-3 role-logo" />
        <h2 className="fw-bold text-success">Web-Based Real-Time Shuttle Tracking System</h2>
        <p className="mt-3 text-secondary w-75">
          Select your role to access the appropriate dashboard or tracking feature.
        </p>
      </div>

      {/* Right Side - Role Buttons */}
      <div className="role-section d-flex flex-column justify-content-center align-items-center flex-grow-1 text-center p-5">
        <div className="d-flex flex-column gap-3 w-75">
          <button
            className="btn btn-success py-3 fw-semibold role-btn"
            onClick={() => handleRoleSelect("admin")}
          >
            <i className="bi bi-person-gear me-2"></i> Admin Login
          </button>
          <button
            className="btn btn-primary py-3 fw-semibold role-btn"
            onClick={() => handleRoleSelect("driver")}
          >
            <i className="bi bi-truck-front-fill me-2"></i> Driver Login
          </button>
          <button
            className="btn btn-secondary py-3 fw-semibold role-btn"
            onClick={() => handleRoleSelect("client")}
          >
            <i className="bi bi-people-fill me-2"></i> Client Employee Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionPage;
