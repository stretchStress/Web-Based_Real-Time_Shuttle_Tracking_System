import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ReportPage.css';
import api from '../../api/api';

const ReportPage = () => {
  const navigate = useNavigate();
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const location = useLocation();
  // Prefer shuttle passed from previous page (dashboard) via navigate state
  const shuttleFromState = location.state?.shuttle || null;
  const scheduleFromState = location.state?.schedule || null;
  const [shuttle, setShuttle] = useState(shuttleFromState);
  const [loading, setLoading] = useState(true);

  const driverId = localStorage.getItem('driverId');
  const token = localStorage.getItem('authToken');

  // Fetch driver's shuttle information
  useEffect(() => {
    // If shuttle passed from previous page, we can skip the fetch
    if (shuttleFromState) {
      setLoading(false);
      return;
    }

    const fetchFromTodaySchedule = async () => {
      try {
        // Get this driver's schedules and pick today's
        const res = await api.get(`/api/schedules/driver/${driverId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const today = new Date().toISOString().slice(0, 10);
        const todays = (res.data || []).filter(s => (s.date || '').slice(0,10) === today);
        const chosen = todays[0] || res.data?.[0];
        if (chosen?.shuttle) {
          setShuttle(chosen.shuttle);
        } else if (chosen?.shuttle_id) {
          // Fallback: fetch shuttle by id if relation missing
          const sh = await api.get('/api/shuttles', { headers: { Authorization: `Bearer ${token}` } });
          const found = (sh.data || []).find(x => x.id === chosen.shuttle_id);
          if (found) setShuttle(found);
        }
        if (!chosen) {
          setError('No active schedule found for today.');
        }
      } catch (err) {
        console.error('Error fetching schedule/shuttle:', err);
        setError('Failed to load schedule information.');
      } finally {
        setLoading(false);
      }
    };

    if (driverId && token) {
      fetchFromTodaySchedule();
    } else {
      setError('Please log in to report an incident.');
      setLoading(false);
    }
  }, [driverId, token, shuttleFromState]);

  const handleSubmit = async () => {
    if (!reportText.trim()) {
      setError('Please describe the incident.');
      return;
    }

    if (!shuttle) {
      setError('No shuttle assigned. Cannot submit report.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const now = new Date();
      const response = await api.post(
        '/api/reports',
        {
          title: 'Incident Report',
          type: 'Incident',
          source: 'Driver Report',
          description: reportText.trim(),
          date: now.toISOString().split('T')[0],
          reported_at: now.toISOString(), // Add exact datetime
          driver_id: parseInt(driverId),
          shuttle_id: shuttle.id,
          schedule_id: scheduleFromState?.id || null,
          route_id: shuttle.route_id || shuttle.route?.id || scheduleFromState?.route_id,
          plate_number: shuttle.plate,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setSuccess('Incident report submitted successfully!');
        setReportText('');
        setTimeout(() => {
          navigate(-1);
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to submit report.');
      }
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Failed to submit incident report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="report-page">
        <h2>Report Incident</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="report-page">
      <h2>Report Incident</h2>
      
      {scheduleFromState && (
        <div className="schedule-summary" style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '6px', fontSize: '0.9rem' }}>
          <div><strong>Route:</strong> {scheduleFromState.route?.name || 'No route'}</div>
          <div><strong>Schedule Time:</strong> {scheduleFromState.time || 'N/A'}</div>
        </div>
      )}
      
      {shuttle && (
        <div className="shuttle-info" style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f0f0f0', borderRadius: '4px' }}>
          <p><strong>Shuttle:</strong> {shuttle.model} ({shuttle.plate})</p>
          {shuttle.route && <p><strong>Route:</strong> {shuttle.route.name}</p>}
        </div>
      )}

      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '1rem', padding: '0.5rem', background: '#ffe6e6', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" style={{ color: 'green', marginBottom: '1rem', padding: '0.5rem', background: '#e6ffe6', borderRadius: '4px' }}>
          {success}
        </div>
      )}

      <textarea
        className="report-textarea"
        value={reportText}
        onChange={(e) => setReportText(e.target.value)}
        placeholder="Describe the incident in detail..."
        disabled={isSubmitting || !shuttle}
      />
      <div className="report-actions">
        <button 
          className="cancel-button"
          onClick={() => navigate(-1)}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          className="submit-button"
          onClick={handleSubmit}
          disabled={!reportText.trim() || isSubmitting || !shuttle}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
};

export default ReportPage;