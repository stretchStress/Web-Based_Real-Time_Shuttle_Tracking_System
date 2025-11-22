import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/trackPage.css';
import driverImg from '../../assets/driver.png';
import GoogleMapComponent from '../admin/components/GoogleMapComponent';
import api from '../../api/api';

function TrackPage() {
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDriverCard, setShowDriverCard] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [passengerName, setPassengerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [suggestions, setSuggestions] = useState('');
  const [modal, setModal] = useState({ visible: false, title: '', message: '', type: 'info' });

  // read selected schedule ONCE (avoid parsing every render)
  const [selectedSchedule, setSelectedSchedule] = useState(() => {
    try {
      const raw = localStorage.getItem('selectedSchedule');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Error parsing selected schedule (init):', e);
      return null;
    }
  });

  const driver = selectedSchedule?.driver;
  const shuttle = selectedSchedule?.shuttle;
  const route = selectedSchedule?.route;

  // Derived display values for name/company
  const displayName = currentUser
    ? ((currentUser.first_name || currentUser.firstName || '') + ' ' + (currentUser.last_name || currentUser.lastName || '')).trim()
    : passengerName;

  const displayCompany = (() => {
    if (currentUser) {
      return (
        currentUser.company_name ||
        currentUser.company?.name ||
        currentUser.company ||
        route?.company_name ||
        route?.company ||
        "—"
      );
    }
    return (
      companyName ||
      route?.company_name ||
      route?.company ||
      "—"
    );
  })();

  // Run once on mount — check selectedSchedule and load current user
  useEffect(() => {
    if (!selectedSchedule) {
      // no schedule -> redirect to role selection or pickup
      navigate('/');
      return;
    }

    // load client/user info once
    try {
      const maybe =
        localStorage.getItem('clientData') ||
        localStorage.getItem('user') ||
        localStorage.getItem('authUser') ||
        localStorage.getItem('currentUser');

      if (maybe) {
        const parsed = JSON.parse(maybe);
        setCurrentUser(parsed || null);

        const fname = parsed.first_name || parsed.firstName || parsed.first || '';
        const lname = parsed.last_name || parsed.lastName || parsed.last || '';
        const full = `${fname} ${lname}`.trim();
        if (full) setPassengerName(full);

        const compName = parsed.company || parsed.company_name || (parsed.company && parsed.company.name) || '';
        if (compName) setCompanyName(compName);
      }
    } catch (e) {
      // ignore parse errors
      console.error('Error loading client/user from localStorage:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only once on mount

  const handleLogout = () => {
    localStorage.removeItem("selectedSchedule");
    localStorage.removeItem("selectedShuttleId");
    localStorage.removeItem("clientData");
    navigate("/");
  };

  const handleGoHome = () => {
    console.log("Going to pickup...");
    localStorage.removeItem("selectedSchedule");
    localStorage.removeItem("selectedShuttleId");
    setShowSidebar(false);
    // small delay to allow map/unmount cleanup if needed
    setTimeout(() => navigate("/pickup"), 120);
  };

  // === Submit feedback to backend API ===
  const handleSubmitFeedback = async () => {
    const derivedName = currentUser
      ? ((currentUser.first_name || currentUser.firstName || '') + ' ' + (currentUser.last_name || currentUser.lastName || '')).trim()
      : passengerName.trim();

    if (!derivedName) {
      setModal({ visible: true, title: 'Name required', message: 'Please enter your name before submitting feedback.', type: 'error' });
      return;
    }

    if (rating === 0) {
      setModal({ visible: true, title: 'Rating required', message: 'Please give a star rating before submitting!', type: 'error' });
      return;
    }

    // company checks (unchanged)
    try {
      const verifyRes = await api.post(`/api/schedules/${selectedSchedule.id}/verify-participation`, {
        schedule_id: selectedSchedule.id,
        user_id: currentUser?.id || null,
        passenger_name: currentUser ? undefined : passengerName.trim()
      });

      if (!verifyRes.data.allowed) {
        setModal({
          visible: true,
          title: 'Not Allowed',
          message: verifyRes.data.message || 'You are not verified as a passenger for this schedule.',
          type: 'error'
        });
        return;
      }
    } catch (err) {
      // If backend returns 403 or verification failed
      const msg = err.response?.data?.message || 'Could not verify participation. Feedback denied.';
      setModal({ visible: true, title: 'Not Allowed', message: msg, type: 'error' });
      return;
    }
    const payload = {
      driver_id: driver?.id ?? selectedSchedule?.driver_id,
      shuttle_id: shuttle?.id ?? selectedSchedule?.shuttle_id,
      route_id: route?.id ?? selectedSchedule?.route_id,
      rating,
      passenger_name: derivedName,
      company_name: currentUser ? (currentUser.company || currentUser.company_name || (currentUser.company && currentUser.company.name) || route?.company || '') : (companyName.trim() || route?.company || ''),
      description: suggestions || '',
      source: 'Passenger'
    };

    try {
      const res = await api.post('/api/reports/feedback', payload);
      const data = res.data;

      if (data.success) {
        const submittedAt = new Date();
        setModal({
          visible: true,
          title: 'Feedback Submitted',
          message: `Name: ${derivedName}\nRating: ${rating} ${rating === 1 ? 'star' : 'stars'}\nSuggestions: ${suggestions || 'None'}\nSubmitted on: ${submittedAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour12: true })}`,
          type: 'success'
        });
        setRating(0);
        setSuggestions('');
        if (!currentUser) {
          setPassengerName('');
          setCompanyName('');
        }
        setShowDriverCard(false);
      } else {
        console.error('Feedback API returned failure:', data);
        setModal({ visible: true, title: 'Submission Failed', message: data.message || 'Failed to submit feedback. Please try again.', type: 'error' });
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      console.error('Axios error response (if any):', err.response?.data);

      if (err.response?.status === 409) {
        setModal({ visible: true, title: 'Feedback Already Submitted', message: err.response?.data?.message || 'You have already submitted feedback for this route.', type: 'error' });
        return;
      } else if (err.response?.status === 422 && err.response.data.errors) {
        const firstErr = Object.values(err.response.data.errors)[0][0];
        setModal({ visible: true, title: 'Validation Error', message: firstErr, type: 'error' });
      } else {
        const msg = err.response?.data?.message
          || err.response?.data?.errors
          || err.message
          || 'An error occurred while submitting feedback.';
        setModal({ visible: true, title: 'Error', message: msg, type: 'error' });
      }
    }
  };

  function formatToManilaTime(utcString) {
    if (!utcString) return "—";
    const date = new Date(utcString);
    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <div className="position-relative trackpage-container" style={{ minHeight: '100vh' }}>

      {/* Render map only if we have a shuttle id */}
      {selectedSchedule?.shuttle?.id ? (
        <GoogleMapComponent
          height="100vh"
          shuttleId={selectedSchedule.shuttle.id}
        />
      ) : (
        // Fallback UI while no shuttle (prevents map from mounting/unmounting weirdness)
        <div style={{ height: '100vh', background: '#f8f9fa' }} />
      )}

      {/* Sidebar toggle */}
      <button
        className="btn text-white fw-bold position-absolute"
        onClick={() => setShowSidebar(!showSidebar)}
        style={{
          top: '40%',
          left: '10px',
          backgroundColor: '#28a745',
          borderRadius: '8px',
          padding: '10px 12px',
          zIndex: 1000,
        }}
      >
        <i className="bi bi-list" style={{ fontSize: '20px' }}></i>
      </button>

      {/* Sidebar */}
      {showSidebar && (
        <div
          className="position-absolute bg-white shadow rounded p-3"
          style={{
            top: '20%',
            left: '0',
            width: '200px',
            zIndex: 1100,
            borderTopRightRadius: '12px',
            borderBottomRightRadius: '12px',
            borderLeft: `6px solid #28a745`,
          }}
        >
          <button
            className="btn-close position-absolute"
            onClick={() => setShowSidebar(false)}
            style={{ top: '10px', right: '10px' }}
          ></button>

          <ul className="list-unstyled mt-4">
            <li className="mb-3">
              <i className="bi bi-house-door-fill me-2 text-success"></i>
              <span style={{ cursor: "pointer" }} onClick={handleGoHome}>
                Home
              </span>
            </li>
            <li className="mb-3">
              <i className="bi bi-person-vcard-fill me-2 text-success"></i>
              <span
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setShowSidebar(false);
                  setShowDriverCard(true);
                }}
              >
                Driver’s Info
              </span>
            </li>
            <li>
              <i className="bi bi-box-arrow-left me-2 text-success"></i>
              <span style={{ cursor: 'pointer' }} onClick={handleLogout}>
                Log out
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Driver card, modal, etc. (unchanged) */}
      {showDriverCard && (
        // ... your existing driver card JSX unchanged ...
        <div
          className="position-absolute bg-white shadow p-3"
          style={{
            top: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            borderRadius: '12px',
            zIndex: 1200,
            border: '2px solid #28a745',
          }}
        >
          <button
            className="btn-close position-absolute"
            onClick={() => setShowDriverCard(false)}
            style={{ top: '10px', right: '10px' }}
          ></button>

          <div className="d-flex justify-content-center mb-3">
            <img
              src={driverImg}
              alt="Driver"
              style={{ width: '80px', borderRadius: '50%' }}
            />
          </div>

          <h5 className="text-center fw-bold mb-3">
            {driver ? `${driver.first_name} ${driver.last_name}` : 'No Assigned Driver'}
          </h5>

          <div style={{ fontSize: '14px' }}>
            <p className="mb-1">
              <strong>Shuttle:</strong>{' '}
              {shuttle?.model || 'N/A'} ({shuttle?.plate || 'No Plate'})
            </p>
            <p className="mb-1">
              <strong>Route:</strong> {route?.name || 'N/A'}
            </p>
            <p className="mb-1">
              <strong>Pickup Time:</strong> {selectedSchedule?.time || 'N/A'}
            </p>
            <p className="mb-1">
              <strong>Time In:</strong>{' '}
              {formatToManilaTime(selectedSchedule?.time_in) || 'Not yet logged'}
            </p>
            <p className="mb-1">
              <strong>Time Out:</strong>{' '}
              {formatToManilaTime(selectedSchedule?.time_out) || 'Not yet logged'}
            </p>
            <p className="mb-2">
              <strong>Status:</strong>{' '}
              <span className="fw-semibold text-success">
                {selectedSchedule?.status || 'Unknown'}
              </span>
            </p>
          </div>

          {/* Feedback form (unchanged) */}
          <div className="mt-3">
            <h5 className="fw-bold text-center">Feedback</h5>
            <div className="mb-2">
              <div className="fw-semibold">Name</div>
              <div className="mb-2">{displayName}</div>
              <div className="fw-semibold">Company</div>
              <div className="mb-2">{displayCompany}</div>
            </div>
            <div className="mb-3 d-flex justify-content-center">
              {[...Array(5)].map((_, index) => {
                const starValue = index + 1;
                return (
                  <i
                    key={index}
                    className={`bi ${
                      starValue <= (hover || rating)
                        ? 'bi-star-fill text-warning'
                        : 'bi-star text-secondary'
                    }`}
                    style={{
                      fontSize: '24px',
                      cursor: 'pointer',
                      margin: '0 5px',
                    }}
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHover(starValue)}
                    onMouseLeave={() => setHover(0)}
                  ></i>
                );
              })}
            </div>

            <textarea
              className="form-control mb-2"
              placeholder="Suggestions or Concerns"
              rows="2"
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
            ></textarea>

            <button
              className="btn btn-success w-100"
              onClick={handleSubmitFeedback}
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}

      {modal.visible && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '90%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
            <h4 style={{ margin: 0, marginBottom: 8, color: modal.type === 'error' ? '#b00020' : modal.type === 'success' ? 'rgb(1,78,1)' : '#333' }}>{modal.title}</h4>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 16, color: '#222' }}>{modal.message}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setModal({ ...modal, visible: false })}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackPage;
