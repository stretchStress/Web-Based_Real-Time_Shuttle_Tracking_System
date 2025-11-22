import React, { useState, useEffect } from 'react';
import './styles/admin.css';
import './styles/reportStyle.css';
import HeaderComponent from './components/HeaderComponent';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import api from '../../api/api';
import 'bootstrap-icons/font/bootstrap-icons.css';

let dashboardCache = {
  initialized: false,
  drivers: [],
  schedulesAll: [],
  shuttles: [],
  reports: [],
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState({
    avgDriverPerformance: 0,
    totalShuttleTrips: 0,
    mostUsedShuttle: 'N/A',
    totalIncidents: 0,
    driverPerformanceData: [],
    shuttleTripsData: [],
  });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedMonth, setSelectedMonth] = useState('November');
  const [rawReports, setRawReports] = useState([]);
  const [rawShuttles, setRawShuttles] = useState([]);
  const [rawSchedules, setRawSchedules] = useState([]);
  const [rawSchedulesAll, setRawSchedulesAll] = useState([]);
  const [rawShuttleAggregates, setRawShuttleAggregates] = useState({ source: '', usageMap: {}, scheduleCounts: {} });
  const [incidentNotifications, setIncidentNotifications] = useState([]);
  const [unreadIncidentCount, setUnreadIncidentCount] = useState(0);
  const [isIncidentDropdownOpen, setIsIncidentDropdownOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedYear, selectedMonth]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      let drivers = [];
      let schedules = [];
      let shuttles = [];
      let reports = [];

      if (dashboardCache.initialized) {
        drivers = dashboardCache.drivers;
        schedules = dashboardCache.schedulesAll;
        shuttles = dashboardCache.shuttles;
        reports = dashboardCache.reports;
      } else {
        // Fetch drivers for average performance
        const driversRes = await api.get('/api/drivers');
        drivers = Array.isArray(driversRes.data) ? driversRes.data : [];

        // Fetch schedules for shuttle trips
        const schedulesRes = await api.get('/api/schedules');
        schedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];

        // Fetch shuttles for most used shuttle
        const shuttlesRes = await api.get('/api/shuttles');
        shuttles = Array.isArray(shuttlesRes.data) ? shuttlesRes.data : [];

        // Fetch reports for incidents (with year filtering)
        const reportsRes = await api.get('/api/reports/linked');
        reports = Array.isArray(reportsRes.data.data) ? reportsRes.data.data : [];

        dashboardCache = {
          initialized: true,
          drivers,
          schedulesAll: schedules,
          shuttles,
          reports,
        };
      }

      setRawSchedulesAll(schedules);
      setRawShuttles(shuttles);
      setRawReports(reports);
      console.log('Drivers:', drivers);
      console.log('Schedules:', schedules);
      console.log('Shuttles:', shuttles);
      console.log('Reports:', reports);

      // Filter data by selected year and month (match ReportManagement logic)
      const yearSchedules = schedules.filter(sched => {
        const schedDateInput = sched.date ? new Date(sched.date) : null;
        if (!schedDateInput) return false;
        const matchesYear = selectedYear === 'All' || schedDateInput.getFullYear() === parseInt(selectedYear);
        const schedMonthName = schedDateInput.toLocaleString('en-US', { month: 'long' });
        const matchesMonth = selectedMonth === 'All' || schedMonthName === selectedMonth;
        return matchesYear && matchesMonth;
      });
      setRawSchedules(yearSchedules);

      const yearReports = reports.filter(report => {
        const reportDateInput = report.reported_at || report.date;
        const reportDate = reportDateInput ? new Date(reportDateInput) : null;
        if (!reportDate) return false;
        const matchesYear = selectedYear === 'All' || reportDate.getFullYear() === parseInt(selectedYear);
        const reportMonthName = reportDate.toLocaleString('en-US', { month: 'long' });
        const matchesMonth = selectedMonth === 'All' || reportMonthName === selectedMonth;
        return matchesYear && matchesMonth;
      });

      // Prepare driver performance chart data (Top 10) - based on reports with ratings
      const driverPerformanceMap = {};
      yearReports
        .filter(r => r.title === 'Driver Performance' && r.driver_id)
        .forEach(r => {
          if (!driverPerformanceMap[r.driver_id]) {
            driverPerformanceMap[r.driver_id] = {
              id: r.driver_id,
              name: r.driver?.user ? `${r.driver.user.first_name} ${r.driver.user.last_name}`.substring(0, 10) : 'Unknown',
              scores: []
            };
          }
          driverPerformanceMap[r.driver_id].scores.push(r.rating || 0);
        });

      const driverPerfData = Object.values(driverPerformanceMap)
        .map(driver => ({
          name: driver.name,
          'Performance Score': (driver.scores.reduce((a, b) => a + b, 0) / driver.scores.length * 20).toFixed(1)
        }))
        .sort((a, b) => b['Performance Score'] - a['Performance Score'])
        .slice(0, 10);

      // Compute average driver performance to match ReportManagement approach
      const avgPerformance = driverPerfData.length > 0
        ? (driverPerfData.reduce((sum, d) => sum + parseFloat(d['Performance Score']), 0) / driverPerfData.length).toFixed(1)
        : 0;

      // Build usage map from reports
      const usageReports = yearReports.filter(r => r.title === 'Shuttle Usage');
      const usageMap = {};
      usageReports.forEach(report => {
        const shuttleId = report.shuttle_id;
        if (!usageMap[shuttleId]) {
          usageMap[shuttleId] = {
            name: report.shuttle?.model || report.shuttle?.plate || `Shuttle ${shuttleId}`,
            'Total Trips': 0
          };
        }
        usageMap[shuttleId]['Total Trips'] += report.trips || 0;
      });

      // Determine data source and prepare shuttle trips chart data
      let shuttleTripsData = [];
      let totalTrips = 0;
      let shuttleDataSource = 'schedules'; // default

      if (usageReports.length > 0) {
        // Use reports data
        shuttleDataSource = 'reports';
        shuttleTripsData = Object.values(usageMap)
          .sort((a, b) => b['Total Trips'] - a['Total Trips'])
          .slice(0, 10);
        totalTrips = Object.values(usageMap).reduce((sum, s) => sum + s['Total Trips'], 0);
      } else {
        // Fallback to schedule data
        shuttleTripsData = shuttles.slice(0, 10).map(shuttle => {
          const trips = yearSchedules.filter(s => String(s.shuttle_id) === String(shuttle.id)).length;
          return {
            name: shuttle.model || `Shuttle ${shuttle.id}`,
            'Total Trips': trips,
          };
        }).sort((a, b) => b['Total Trips'] - a['Total Trips']);
        totalTrips = yearSchedules.length;
      }

      // Find most used shuttle
      const mostUsed = shuttleTripsData.length > 0 
        ? shuttleTripsData[0].name 
        : 'N/A';

      // Count incidents
      const incidents = yearReports.filter(r => r.title === 'Incident Report').length;

      const incidentReports = yearReports
        .filter(r => r.title === 'Incident Report')
        .sort((a, b) => {
          const aDate = a.reported_at || a.date;
          const bDate = b.reported_at || b.date;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate) - new Date(aDate);
        });

      const notifications = incidentReports.map(r => {
        const driverName = r.driver?.user
          ? `${r.driver.user.first_name} ${r.driver.user.last_name}`
          : 'Unknown';
        const shuttleLabel = r.shuttle
          ? `${r.shuttle.model || 'Shuttle'}${r.shuttle.plate ? ` (${r.shuttle.plate})` : ''}`
          : 'N/A';
        const routeName = r.route?.name || 'N/A';
        const reportedAtRaw = r.reported_at || r.date;
        const reportedAt = reportedAtRaw ? new Date(reportedAtRaw) : null;

        return {
          id: r.id,
          driverName,
          shuttleLabel,
          routeName,
          description: r.description || '',
          date: reportedAt
            ? reportedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'N/A',
          time: reportedAt
            ? reportedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
            : 'N/A',
          rawReportedAt: reportedAtRaw,
        };
      });

      setIncidentNotifications(notifications);

      const lastSeenRaw = typeof window !== 'undefined'
        ? window.localStorage.getItem('admin_incident_last_seen_at')
        : null;

      let unreadCount = 0;
      if (notifications.length > 0) {
        if (lastSeenRaw) {
          unreadCount = notifications.filter(n => {
            if (!n.rawReportedAt) return false;
            return new Date(n.rawReportedAt) > new Date(lastSeenRaw);
          }).length;
        } else {
          unreadCount = notifications.length;
        }
      }

      setUnreadIncidentCount(unreadCount);

      // Update analytics state
      setAnalytics({
        avgDriverPerformance: avgPerformance,
        totalShuttleTrips: totalTrips,
        mostUsedShuttle: mostUsed,
        totalIncidents: incidents,
        driverPerformanceData: driverPerfData,
        shuttleTripsData: shuttleTripsData,
      });

      // Update raw shuttle aggregates for debug panel
      setRawShuttleAggregates({
        source: shuttleDataSource,
        usageMap: usageMap,
        scheduleCounts: {} // You can populate this if needed
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = () => {
    dashboardCache.initialized = false;
    fetchDashboardData();
  };

  const handleToggleIncidentDropdown = () => {
    setIsIncidentDropdownOpen(prev => {
      const next = !prev;
      if (!prev && incidentNotifications.length > 0) {
        const latest = incidentNotifications[0].rawReportedAt;
        if (latest && typeof window !== 'undefined') {
          window.localStorage.setItem('admin_incident_last_seen_at', latest);
          setUnreadIncidentCount(0);
        }
      }
      return next;
    });
  };

  const handleOpenIncident = (incident) => {
    setSelectedIncident(incident);
    setShowIncidentModal(true);
    setIsIncidentDropdownOpen(false);
  };

  const handleCloseIncidentModal = () => {
    setShowIncidentModal(false);
    setSelectedIncident(null);
  };

  return (
    <div className="admin-container-with-sidebar">
      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>

        <div className="sidebar-logo">
          <img src={require('../../assets/logo.png')} alt="Alcedon" className="logo-img" />
          <h4>SHUTTLE TRACKING SYSTEM</h4>
        </div>

        <div className="admin-avatar">
          <div className="avatar">
            <i className="bi bi-person-fill"></i>
          </div>
          <p>Admin</p>
        </div>

        <div className="sidebar-notifications" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className="sidebar-item"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={handleToggleIncidentDropdown}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <i className="bi bi-bell"></i>
              <span>Incident Notifications</span>
            </span>
            {unreadIncidentCount > 0 && (
              <span
                style={{
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '0 0.45rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                !
              </span>
            )}
          </button>
          {isIncidentDropdownOpen && (
            <div
              style={{
                marginTop: '0.25rem',
                backgroundColor: '#ffffff',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '0.4rem 0.3rem',
              }}
            >
              {incidentNotifications.length === 0 && (
                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#666' }}>
                  No incident reports for the selected period.
                </div>
              )}
              {incidentNotifications.slice(0, 8).map(incident => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => handleOpenIncident(incident)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    padding: '0.4rem 0.4rem',
                    borderRadius: '0.35rem',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#333' }}>
                    {incident.driverName}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#555' }}>
                    {incident.shuttleLabel}  on {incident.routeName}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>
                    {incident.date} at {incident.time}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="sidebar-menu">
          <button className="sidebar-item" onClick={() => navigate('/admin/companies')}>
            <i className="bi bi-building"></i>
            <span>Company Management</span>
          </button>

          <button className="sidebar-item" onClick={() => navigate('/admin/users')}>
            <i className="bi bi-person-vcard"></i>
            <span>User Management</span>
          </button>

          <button className="sidebar-item" onClick={() => navigate('/admin/routes')}>
            <i className="bi bi-map"></i>
            <span>Route Management</span>
          </button>

          <button className="sidebar-item" onClick={() => navigate('/admin/schedules')}>
            <i className="bi bi-calendar-week"></i>
            <span>Schedule Management</span>
          </button>

          <button className="sidebar-item" onClick={() => navigate('/admin/shuttles')}>
            <i className="bi bi-minecart-loaded"></i>
            <span>Shuttle Management</span>
          </button>

          <button className="sidebar-item" onClick={() => navigate('/admin/maintenance')}>
            <i className="bi bi-wrench"></i>
            <span>Maintenance<br/>Management</span>
          </button>

          <button className="sidebar-item" onClick={() => navigate('/admin/reports')}>
            <i className="bi bi-file-text"></i>
            <span>Reports Management</span>
          </button>

          <button className="sidebar-item logout" onClick={() => {
            localStorage.removeItem('auth_token');
            navigate('/');
          }}>
            <i className="bi bi-box-arrow-right"></i>
            <span>Logout</span>
          </button>
        </nav>
      </div>

      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="admin-main-with-sidebar">
        <div className="analysis-header">
          <div className="header-left">
            {!sidebarOpen && (
              <button
                type="button"
                className="burger-menu-btn"
                onClick={() => setSidebarOpen(prev => !prev)}
              >
                <i className="bi bi-list"></i>
              </button>
            )}
            <span className="chart-icon">📊</span>
            <h2 className="analysis-title">Analysis</h2>
          </div>

          <div className="filter-controls">
            <div className="year-selector">
              <label htmlFor="year-select">Year: </label>
              <select 
                id="year-select" 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="year-dropdown"
              >
                <option value="All">All Years</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
                <option value="2020">2020</option>
                <option value="2019">2019</option>
              </select>
            </div>
            <div className="month-selector">
              <label htmlFor="month-select">Month: </label>
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="year-dropdown"
              >
                <option value="All">All</option>
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm ms-2"
              onClick={handleRefreshData}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise me-1" />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Metric Cards - 4 Column Grid */}
        <div className="analysis-metrics">
          <div className="analysis-card">
            <div className="card-info">
              <p className="card-label">Avg. Driver Performance</p>
              <p className="card-value">{analytics.avgDriverPerformance}/100</p>
            </div>
          </div>

          <div className="analysis-card">
            <div className="card-info">
              <p className="card-label">Total Shuttle Trips</p>
              <p className="card-value">{analytics.totalShuttleTrips}</p>
            </div>
          </div>

          <div className="analysis-card">
            <div className="card-info">
              <p className="card-label">Most Used Shuttle</p>
              <p className="card-value">{analytics.mostUsedShuttle}</p>
            </div>
          </div>

          <div className="analysis-card">
            <div className="card-info">
              <p className="card-label">Total Incidents</p>
              <p className="card-value">{analytics.totalIncidents}</p>
            </div>
          </div>
        </div>

        {/* Driver Performance Chart */}
        <div className="analysis-chart-container">
          <div className="chart-top-bar">
            <h3>Driver Performance Overview (Top 10)</h3>
          </div>
          <div className="chart-wrapper">
            {analytics.driverPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={analytics.driverPerformanceData} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="0" stroke="#e8e8e8" vertical={false} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(234, 120, 34, 0.08)' }} />
                  <Bar dataKey="Performance Score" fill="#EA7822" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No data available</p>
            )}
          </div>
        </div>

        {/* Shuttle Trips Chart */}
        <div className="analysis-chart-container">
          <div className="chart-top-bar">
            <h3>Shuttle Trips Overview (Top 10)</h3>
          </div>
          <div className="chart-wrapper">
            {analytics.shuttleTripsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={analytics.shuttleTripsData} margin={{ top: 20, right: 30, left: 0, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="0" stroke="#e8e8e8" vertical={false} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(76, 175, 80, 0.08)' }} />
                  <Bar dataKey="Total Trips" fill="#4CAF50" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>No data available</p>
            )}
          </div>
        </div>

        {showIncidentModal && selectedIncident && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
            }}
            onClick={handleCloseIncidentModal}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '0.75rem',
                padding: '1.25rem 1.5rem',
                width: 'min(520px, 94vw)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Incident Details</h3>
                <button
                  type="button"
                  onClick={handleCloseIncidentModal}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ fontSize: '0.9rem', color: '#444', marginBottom: '0.75rem' }}>
                <div style={{ marginBottom: '0.35rem' }}>
                  <strong>Driver:</strong> {selectedIncident.driverName}
                </div>
                <div style={{ marginBottom: '0.35rem' }}>
                  <strong>Shuttle:</strong> {selectedIncident.shuttleLabel}
                </div>
                <div style={{ marginBottom: '0.35rem' }}>
                  <strong>Route:</strong> {selectedIncident.routeName}
                </div>
                <div style={{ marginBottom: '0.35rem' }}>
                  <strong>Date &amp; Time:</strong> {selectedIncident.date} at {selectedIncident.time}
                </div>
              </div>

              <div style={{ fontSize: '0.9rem', color: '#333' }}>
                <strong>Incident Description</strong>
                <div
                  style={{
                    marginTop: '0.35rem',
                    padding: '0.6rem 0.75rem',
                    backgroundColor: '#f7f7f7',
                    borderRadius: '0.45rem',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {selectedIncident.description || 'No description provided.'}
                </div>
              </div>

              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={handleCloseIncidentModal}
                  style={{
                    border: 'none',
                    backgroundColor: '#EA7822',
                    color: '#fff',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '0.4rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;