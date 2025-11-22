import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, Button } from "react-bootstrap";
import api from "../../api/api";
import logo from "../../assets/logo.png";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/pickupPage.css";

function PickupPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("incoming");
  const [scheduleData, setScheduleData] = useState([]);
  const [clientCompanyName, setClientCompanyName] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Load client company name from localStorage
    try {
      const clientData = localStorage.getItem("clientData");
      if (clientData) {
        const parsed = JSON.parse(clientData);
        const compName = parsed.company || parsed.company_name || (parsed.company && parsed.company.name) || "";
        setClientCompanyName(compName);
      }
    } catch (e) {
      console.error("Error loading company name:", e);
    }
  }, []);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        // Fetch only active schedules assigned to the authenticated client
        // Backend route: GET /api/client/schedules -> ScheduleController@indexPublic
        const response = await api.get("/api/client/schedules");
        setScheduleData(response.data || []);
      } catch (error) {
        console.error("Error fetching schedules:", error);
      }
    };
    fetchSchedules();
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("selectedSchedule");
      localStorage.removeItem("selectedShuttleId");
      localStorage.removeItem("clientData");
      localStorage.removeItem("guestName");
    } catch (e) {
      console.error("Error clearing client storage on logout:", e);
    }
    navigate("/");
  };

  // Group schedules by direction (incoming/outgoing) and date
  const groupedData = scheduleData.reduce(
    (acc, sched) => {
      const direction = sched.route?.direction?.toLowerCase() || "incoming";
      if (!acc[direction][sched.date]) acc[direction][sched.date] = [];
      acc[direction][sched.date].push(sched);
      return acc;
    },
    { incoming: {}, outgoing: {} }
  );

  const handleBusSelection = async (sched) => {
    // Optional: show loading state here (spinner)
    try {
      const payload = {
        schedule_id: sched.id,
        user_id: currentUser?.id || null,
        passenger_name: currentUser ? undefined : (localStorage.getItem('guestName') || null)
      };

      const res = await api.post(`/api/schedules/${sched.id}/verify-participation`, payload);
      if (res.data && res.data.allowed) {
        // allowed -> save schedule and go to track
        localStorage.setItem("selectedSchedule", JSON.stringify(sched));
        localStorage.setItem("selectedShuttleId", sched.shuttle?.id || "");
        navigate("/track");
      } else {
        // not allowed — show modal with reason
        setErrorMessage(res.data?.message || "You are not verified as a passenger for this schedule.");
        setShowErrorModal(true);
      }
    } catch (err) {
      console.error("Verify error:", err?.response?.data || err);
      // If server returns 403 or not allowed, show modal with message
      if (err.response?.data?.message) {
        setErrorMessage(err.response.data.message);
      } else {
        setErrorMessage("Could not verify participation. Try again or contact support.");
      }
      setShowErrorModal(true);
    }
  };

  return (
    <div className="d-flex flex-column vh-100 text-center">
      {/* Logo, Title, and Logout (mobile-first header) */}
      <header className="d-flex align-items-center justify-content-between px-3 pt-3 pb-2">
        <div className="d-flex align-items-center">
          <img src={logo} alt="Logo" style={{ maxWidth: "150px" }} />
        </div>
        <button
          type="button"
          className="btn btn-outline-danger btn-sm d-flex align-items-center"
          onClick={handleLogout}
        >
          <i className="bi bi-box-arrow-right me-1"></i>
          <span>Logout</span>
        </button>
      </header>
      <div className="px-3">
        <h5 className="mt-1 text-success fw-bold mb-1">SHUTTLE TRACKING SYSTEM</h5>
        {clientCompanyName && (
          <p className="text-muted small mb-0">
            <strong>Company:</strong> {clientCompanyName}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-container mt-4 mx-auto">
        <div className="tab-toggle position-relative">
          <div
            className={`tab-indicator ${
              activeTab === "outgoing" ? "right" : "left"
            }`}
          ></div>
          <button
            className={`tab-btn ${activeTab === "incoming" ? "active" : ""}`}
            onClick={() => setActiveTab("incoming")}
          >
            Incoming
          </button>
          <button
            className={`tab-btn ${activeTab === "outgoing" ? "active" : ""}`}
            onClick={() => setActiveTab("outgoing")}
          >
            Outgoing
          </button>
        </div>
      </div>

      {/* Routes and Schedules */}
      <div className="pickup-section flex-grow-1 my-4 px-4 text-start overflow-auto">
        {Object.keys(groupedData[activeTab]).length === 0 ? (
          <p className="text-center mt-4 text-muted">
            No {activeTab} routes scheduled.
          </p>
        ) : (
          Object.entries(groupedData[activeTab]).map(([date, schedules]) => (
            <div key={date} className="mb-4">
              <h5 className="fw-bold text-center text-success sticky-date">
                {new Date(date).toLocaleDateString(undefined, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h5>

              {schedules.map((sched, idx) => (
                <div
                  key={idx}
                  className="pickup-card p-3 mb-3 rounded shadow-sm bg-white"
                >
                  <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2">
                    <div>
                      <p className="fw-semibold mb-1">
                        {sched.route?.name || "Unnamed Route"}
                      </p>
                      <small className="text-muted d-block">
                        Pickup: {sched.time} | Shuttle:{" "}
                        {sched.shuttle?.model || "N/A"} (
                        {sched.shuttle?.plate || "No Plate"})
                      </small>
                      <small className="text-muted d-block">
                        Driver:{" "}
                        {sched.driver
                          ? `${sched.driver.first_name} ${sched.driver.last_name}`
                          : "No Assigned Driver"}
                      </small>
                    </div>
                    {new Date(sched.date).toDateString() === new Date().toDateString() ? (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleBusSelection(sched)}
                      >
                        Track
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-secondary" disabled>
                        Not Available Yet
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Error Modal */}
      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} centered>
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="text-danger">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            Access Denied
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <p className="mb-0">{errorMessage}</p>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="secondary" onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default PickupPage;
