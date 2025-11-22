import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./loginStyle.css"; // reuse your admin login styles
import shuttleImg from "../assets/shuttle_img.png";
import alcedonLogo from "../assets/logo.jpg";
import api from "../api/api";

const UnifiedLoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [alertMsg, setAlertMsg] = useState("");
  const [alertType, setAlertType] = useState("");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyMessage, setCompanyMessage] = useState("");
  const navigate = useNavigate();
  const { role: routeRole } = useParams();

  const headerRoleNormalized = routeRole ? routeRole.toLowerCase() : null;
  let loginTitle = "USER LOGIN";
  if (headerRoleNormalized === "admin") loginTitle = "ADMIN LOGIN";
  else if (headerRoleNormalized === "driver") loginTitle = "DRIVER LOGIN";
  else if (headerRoleNormalized === "client") loginTitle = "CLIENT EMPLOYEE LOGIN";

  useEffect(() => {
    const logoutMsg = localStorage.getItem("logoutMessage");
    if (logoutMsg) {
      setAlertMsg(logoutMsg);
      setAlertType("success");
      localStorage.removeItem("logoutMessage");
    }
  }, []);

  const togglePassword = () => setShowPassword(!showPassword);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      // Optional if using Sanctum
      await api.get("/sanctum/csrf-cookie");

      const response = await api.post("/api/auth/login", {
        id: idNumber,
        password: password,
      });

      const { user, token, driver_id } = response.data;

      const routeRoleNormalized = routeRole ? routeRole.toLowerCase() : null;
      const validExpectedRoles = ["admin", "driver", "client"];
      const expectedRole = validExpectedRoles.includes(routeRoleNormalized)
        ? routeRoleNormalized
        : null;
      const userRoleNormalized = String(user.role || "").toLowerCase();

      if (expectedRole && userRoleNormalized && expectedRole !== userRoleNormalized) {
        let roleLabel = "this";
        if (expectedRole === "admin") roleLabel = "Admin";
        else if (expectedRole === "driver") roleLabel = "Driver";
        else if (expectedRole === "client") roleLabel = "Client Employee";

        setAlertMsg(`You can't log in here. This login page is for ${roleLabel} users only.`);
        setAlertType("danger");
        return;
      }

      // If user is a client, ensure their company is active
      if (user.role === "client") {
        const company = user.company || user.client_company || user.company_data || null;
        const statusRaw = company?.status || user.company_status || "";
        const status = String(statusRaw).toLowerCase();

        if (status && status !== "active") {
          // Block login and show modal explaining contract status
          setCompanyMessage(
            status === "inactive" || status === "terminated"
              ? "Your company's contract with the shuttle service is not active (inactive/terminated). Please contact your company administrator or HR."
              : "Your company's contract with the shuttle service is not active. Please contact your company administrator or HR."
          );
          setShowCompanyModal(true);
          return;
        }
      }

      // Save token and user info for allowed logins
      localStorage.setItem("authToken", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("clientData", JSON.stringify(user)); // Save full user/client data

      if (driver_id) localStorage.setItem("driverId", driver_id);

      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setAlertMsg("Login successful! Redirecting...");
      setAlertType("success");

      setTimeout(() => {
        if (user.role === "admin") navigate("/admin");
        else if (user.role === "driver") navigate("/driver");
        else if (user.role === "client") navigate("/pickup");
        else {
          setAlertMsg("Unknown role. Contact your administrator.");
          setAlertType("danger");
        }
      }, 1000);
    } catch (error) {
      setAlertMsg(error.response?.data?.message || "Invalid credentials");
      setAlertType("danger");
    }
  };

  return (
    <div className="login-container">
      {/* Left - Form */}
      <div className="form-container">
        <img src={alcedonLogo} alt="Alcedon Logo" className="logo" />
        <p className="system-title">SHUTTLE TRACKING SYSTEM</p>
        <p className="role-title">{loginTitle}</p>

        {alertMsg && (
          <div
            className={`alert alert-${alertType} w-100 text-center`}
            role="alert"
          >
            {alertMsg}
          </div>
        )}

        <form className="login-form" onSubmit={handleLogin}>
          <label htmlFor="id">ID Number:</label>
          <input
            id="id"
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="Enter your ID"
            required
          />

          <label htmlFor="password">Password:</label>
          <div className="input-group">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="form-control"
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={togglePassword}
            >
              <i
                className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
              ></i>
            </button>
          </div>

          <button type="submit" className="btn mt-3 login-btn">
            Login
          </button>
        </form>
      </div>

      {/* Right - Shuttle Image */}
      <div className="shuttle-container">
        <img src={shuttleImg} alt="Shuttle" className="shuttle-img" />
      </div>

      {/* Company Status Modal */}
      {showCompanyModal && (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Company Contract Inactive
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShowCompanyModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p>{companyMessage}</p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCompanyModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedLoginPage;
