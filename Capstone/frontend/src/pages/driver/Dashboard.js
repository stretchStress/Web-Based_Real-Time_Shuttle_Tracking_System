import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DashboardHeader from './DashboardHeader';
import './Dashboard.css';
import api from '../../api/api';

const Dashboard = ({ driverStatus, toggleStatus }) => {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [driver, setDriver] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const hasInitialized = useRef(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const driverId = localStorage.getItem('driverId');
  const token = localStorage.getItem('authToken');
  const dayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const parseDateTime = (val, dateFallback) => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val;

    const s = String(val).trim();
    if (!s || s.toLowerCase() === 'null' || s === '0000-00-00 00:00:00') return null;

    if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+\-]\d{2}:\d{2})$/.test(s)) {
      const d = new Date(s);
      return isNaN(d) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s) ||
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
      const iso = s.replace(' ', 'T') + 'Z'; // force-interpret as UTC
      const d = new Date(iso);
      return isNaN(d) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T00:00:00Z');
      return isNaN(d) ? null : d;
    }

    if (/^\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      const baseDate = (dateFallback && /^\d{4}-\d{2}-\d{2}$/.test(dateFallback))
        ? dateFallback
        : new Date().toISOString().slice(0, 10); // YYYY-MM-DD of today
      const iso = `${baseDate}T${s}Z`;
      const d = new Date(iso);
      return isNaN(d) ? null : d;
    }

    const parsed = Date.parse(s);
    return isNaN(parsed) ? null : new Date(parsed);
  };

  const formatTime = (val, dateFallback) => {
    const dt = parseDateTime(val, dateFallback);
    if (!dt) return '—';
    return dt.toLocaleTimeString('en-PH', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Manila'
    });
  };

  const formatDate = (val) => {
    const dt = parseDateTime(val);
    if (!dt) return '—';
    return dt.toLocaleDateString('en-PH', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Manila'
    });
  };
  // Fetch all driver schedules (for weekly view)
  useEffect(() => {
    const fetchAllSchedules = async () => {
      try {
        const scheduleRes = await api.get(
          `/api/schedules/driver/${driverId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setAllSchedules(scheduleRes.data);

        if (scheduleRes.data.length > 0 && scheduleRes.data[0].driver) {
          setDriver(scheduleRes.data[0].driver);
        }
      } catch (err) {
        console.error('Error fetching driver schedules:', err);
      }
    };

    if (driverId && token) fetchAllSchedules();
  }, [driverId, token]);

  // Fetch today's schedules
  useEffect(() => {
    const fetchTodaySchedules = async () => {
      try {
        const scheduleRes = await api.get(
          `/api/schedules/driver/${driverId}/today`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setTodaySchedules(scheduleRes.data);
        setSchedules(scheduleRes.data); // Set as main schedules for dashboard

        // Find current/active schedule (one without time_out or most recent)
        if (scheduleRes.data.length > 0) {
          const activeSchedule = scheduleRes.data.find(s => s.time_in && !s.time_out) 
            || scheduleRes.data[0];
          setCurrentSchedule(activeSchedule);
          
          // Update driver status based on schedule (only on initial load)
          if (!hasInitialized.current) {
            if (activeSchedule && activeSchedule.time_in && !activeSchedule.time_out) {
              toggleStatus('on-duty');
            } else if (activeSchedule && activeSchedule.time_out) {
              toggleStatus('off-duty');
            }
            hasInitialized.current = true;
          }
        }
      } catch (err) {
        console.error('Error fetching today\'s schedules:', err);
      }
    };

    if (driverId && token) fetchTodaySchedules();
  }, [driverId, token]); // Removed toggleStatus from dependencies to avoid loop

  // Location tracking
  useEffect(() => {
    if (driverStatus === 'on-duty') {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [driverStatus]);

  const startLocationTracking = () => {
    setIsLoading(true);
    if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) : 'N/A',
            address: getShuttleArea(position.coords.latitude, position.coords.longitude)
          };
          setCurrentLocation(newLoc);
          setIsLoading(false);

          try {
            await axios.post(
              `http://127.0.0.1:8000/api/shuttles/${driverId}/location`,
              newLoc,
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch (err) {
            console.error('Error sending location:', err);
          }
        },
        (error) => {
          console.error('Tracking error:', error);
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      setWatchId(id);
    }
  };

  const stopLocationTracking = () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
  };

  const getShuttleArea = (lat, lng) => {
    const serviceAreas = [
      "Near Main Terminal",
      "Industrial Park Zone",
      "Business District",
      "Residential Pickup Point",
      "Corporate Hub Area"
    ];
    return serviceAreas[Math.floor(Math.random() * serviceAreas.length)];
  };

  // Handle duty status toggle with API call
  const handleScheduleAction = async (sched, action, confirmed = false) => {
    // show modal instead of window.confirm
    if (action === 'off-duty' && !confirmed) {
      setPendingAction({ sched, action });
      setShowConfirmModal(true);
      return;
    }

    setIsLoading(true);

    try {
      await api.post(
        `/api/schedules/${sched.id}/duty`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh today's schedules
      const updatedRes = await api.get(
        `/api/schedules/driver/${driverId}/today`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTodaySchedules(updatedRes.data);

      // Handle tracking
      if (action === 'on-duty') startLocationTracking();
      else stopLocationTracking();
    } catch (err) {
      console.error('Error updating schedule timing:', err);
      alert(err.response?.data?.message || 'Failed to update schedule timing.');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
      setPendingAction(null);
    }
  };

  useEffect(() => {
    if (!allSchedules || allSchedules.length === 0) return;

    const monthKeySet = new Set();
    allSchedules.forEach((sched) => {
      const dt = parseDateTime(sched.date);
      if (!dt) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      monthKeySet.add(key);
    });

    const sortedKeys = Array.from(monthKeySet).sort();
    if (!sortedKeys.length) return;

    if (!selectedMonthKey || !monthKeySet.has(selectedMonthKey)) {
      setSelectedMonthKey(sortedKeys[0]);
    }
  }, [allSchedules, selectedMonthKey]);

  const monthOptions = (() => {
    const monthKeySet = new Set();
    allSchedules.forEach((sched) => {
      const dt = parseDateTime(sched.date);
      if (!dt) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      monthKeySet.add(key);
    });

    return Array.from(monthKeySet)
      .sort()
      .map((key) => {
        const [yearStr, monthStr] = key.split('-');
        const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
        const label = date.toLocaleString('en-PH', {
          month: 'long',
          year: 'numeric',
          timeZone: 'Asia/Manila'
        });
        return { key, label };
      });
  })();

  const filteredSchedulesByMonth = selectedMonthKey
    ? allSchedules.filter((sched) => {
        const dt = parseDateTime(sched.date);
        if (!dt) return false;
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        return key === selectedMonthKey;
      })
    : allSchedules;

  return (
    <div className="dashboard-container">
      <DashboardHeader
        title={showSchedule ? "My Schedule" : "Driver's Dashboard"}
        onToggleSchedule={() => setShowSchedule(!showSchedule)}
      />
      {showSchedule ? (
        <div className="schedule-section fade-in">
          <h3>Weekly Shuttle Schedule</h3>
          {monthOptions.length > 0 && (
            <div className="month-filter">
              <label htmlFor="month-select">Month:</label>
              <select
                id="month-select"
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="weekly-calendar no-time">
            <div className="calendar-header">
              <div className="day">Mon</div>
              <div className="day">Tue</div>
              <div className="day">Wed</div>
              <div className="day">Thu</div>
              <div className="day">Fri</div>
              <div className="day">Sat</div>
              <div className="day">Sun</div>
              
            </div>
            <div className="calendar-body">
              {[...Array(7)].map((_, dayIdx) => (
                <div className="calendar-cell" key={dayIdx}>
                  {filteredSchedulesByMonth
                    .filter((sched) => dayMap[sched.day] === dayIdx)
                    .map((sched) => (
                      <div className="route-event" key={sched.id}>
                        <span className="route-badge">
                          {sched.route ? sched.route.company : 'No Route'}
                        </span>
                        <p>{sched.route ? sched.route.name : 'No route assigned'}</p>
                        <p>Date: {formatDate(sched.date)}</p>
                        <p>Time: {sched.time}</p>
                        {sched.time_in && (
                          <p style={{ fontSize: '12px', color: '#4CAF50' }}>
                            ✓ Started: {formatTime(sched.time_in, sched.date)}
                          </p>
                        )}
                        {sched.time_out && (
                          <p style={{ fontSize: '12px', color: '#f44336' }}>
                            ✓ Ended: {formatTime(sched.time_out, sched.date)}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

          {/* 🔙 Go Back Button */}
          <button className="go-back-btn" onClick={() => setShowSchedule(false)}>
            <i className="bi bi-arrow-left"></i> Go Back to Dashboard
          </button>
        </div>
      ) : (
        <>

        <div className="driver-info-2">
          <h2>
            {driver
              ? `${driver.first_name} ${driver.last_name}`
              : 'Driver'}
          </h2>
          <p>Alcedon Transport Corp.</p>
        </div>
{/* 
        {driverStatus === 'on-duty' && currentLocation && (
          <div className="info-section">
            <h3>Shuttle Location Tracker</h3>
            <div className="info-card">
              <p><strong>Lat:</strong> {currentLocation.lat}</p>
              <p><strong>Lng:</strong> {currentLocation.lng}</p>
              <p><strong>Speed:</strong> {currentLocation.speed} km/h</p>

              <div className="map-placeholder">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentLocation.lng - 0.01}%2C${currentLocation.lat - 0.01}%2C${currentLocation.lng + 0.01}%2C${currentLocation.lat + 0.01}&layer=mapnik&marker=${currentLocation.lat}%2C${currentLocation.lng}`}
                  title="Live Shuttle Tracker"
                />
                <small>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${currentLocation.lat}&mlon=${currentLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Full Tracking Map
                  </a>
                </small>
              </div>
            </div>
          </div>
        )} */}
        
        <div className="schedule-section">
          <h3>Today's Scheduled Routes</h3>

          {todaySchedules.length > 0 ? (
            todaySchedules.map((sched) => {
              const isActive = sched.time_in && !sched.time_out;
              const hasActiveOther =
                todaySchedules.some(
                  (s) => s.id !== sched.id && s.time_in && !s.time_out
                );

              return (
                <div className="schedule-card" key={sched.id}>
                  <p className="route-description">
                    {sched.route ? sched.route.name : 'No route assigned'}
                  </p>

                  {sched.shuttle && (
                    <div style={{ borderRadius: '4px', fontSize: '0.9rem' }}>
                      <strong>Vehicle:</strong> {sched.shuttle.model} ({sched.shuttle.plate})
                    </div>
                  )}
                  
                  <div className="time-info">
                    <span>Time: {sched.time}</span>
                    {sched.route && (
                      <>
                        <br />
                        <span>
                          Route: {sched.route.embarked} → {sched.route.disembarked}
                        </span>
                      </>
                    )}
                    {sched.time_in && (
                      <>
                        <br />
                        <span style={{ color: '#4CAF50', fontSize: '14px' }}>
                          ✓ Time In: {sched.time_in ? formatTime(sched.time_in, sched.date) : ''}
                        </span>
                      </>
                    )}
                    {sched.time_out && (
                      <>
                        <br />
                        <span style={{ color: '#f44336', fontSize: '14px' }}>
                          ✓ Time Out: {sched.time_out ? formatTime(sched.time_out, sched.date) : ''}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Time In / Time Out Buttons */}
                  <div className="schedule-controls">
                    {!sched.time_in && (
                      <button
                        className={`duty-btn ${hasActiveOther ? 'faded' : ''}`}
                        disabled={hasActiveOther || isLoading}
                        onClick={() => handleScheduleAction(sched, 'on-duty')}
                      >
                        {isLoading ? 'Timing in...' : 'Time In'}
                      </button>
                    )}
                    {isActive && (
                      <button
                        className="duty-btn time-out"
                        onClick={() => handleScheduleAction(sched, 'off-duty')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Timing out...' : 'Time Out'}
                      </button>
                    )}
                  </div>

                  <button
                    className="report-btn"
                    onClick={() =>
                      navigate('report', {
                        state: {
                          schedule: sched,
                          shuttle: sched.shuttle || (sched.shuttle_id ? { id: sched.shuttle_id } : null)
                        }
                      })
                    }
                  >
                    Report Incident
                  </button>
                </div>
                
              );
            })
          ) : (
            <p>No schedules found for today.</p>
          )}
        </div>
        {showConfirmModal && (
          <div className="confirm-modal-overlay">
            <div className="confirm-modal">
              <h3>Confirm Time Out</h3>
              <p>
                Are you sure you want to <strong>Time Out</strong> from this route?
              </p>
              <div className="modal-buttons">
                <button
                  className="confirm-btn"
                  onClick={() =>
                    handleScheduleAction(pendingAction.sched, pendingAction.action, true)
                  }
                >
                  Yes, Confirm
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        </>
        )}
    </div>
     
  );
};

export default Dashboard;
