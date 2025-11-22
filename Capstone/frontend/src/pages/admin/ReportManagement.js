import React, { useState, useEffect, useMemo } from 'react';
import HeaderComponent from './components/HeaderComponent';
import SearchBar from './components/SearchBarComponent';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/admin.css';
import './styles/reportStyle.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../../api/api';

/* -------------------------
   ChartInsightModal
   ------------------------- */
const ChartInsightModal = ({ open, onClose, title, insights }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box insights-modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="insights-body">
          {insights && insights.length > 0 ? (
            <ul className="insights-list">
              {insights.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          ) : (
            <p>No insights available for this chart.</p>
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: '1rem' }}>
          <button className="crud-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
   Report Details Modal
   ------------------------- */
const ReportDetailsModal = ({ open, onClose, report }) => {
  if (!open || !report) return null;

  const isPerformanceReport = report.title === 'Driver Performance';
  const isIncidentReport = report.title === 'Incident Report';

  const submittedDate = report.reported_at
    ? new Date(report.reported_at)
    : report.date
    ? new Date(report.date)
    : null;

  const formattedSubmittedDate = submittedDate
    ? report.reported_at
      ? submittedDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : submittedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
    : 'No timestamp available';

  const passengerName = report.passenger_name || 'Anonymous Passenger';

  // Show modal for Driver Performance and Incident Reports
  if (!isPerformanceReport && !isIncidentReport) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box report-details-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-simple">
          <h3>{report.title}</h3>
          <button className="close-btn-simple" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <div className="modal-body-simple">
          {/* Date */}
          <div className="report-date-simple">
            <i className="bi bi-calendar3"></i>
            {formattedSubmittedDate}
          </div>

          {/* Incident Status removed as requested */}

          {/* Performance Score (for Driver Performance Reports) */}
          {isPerformanceReport && (
            <div className="score-section-simple">
              <div className="score-display">
                <span className="score-number">{(report.rating * 20).toFixed(0)}</span>
                <span className="score-label">/100</span>
              </div>
              <div className="stars-simple">
                {[1, 2, 3, 4, 5].map(star => (
                  <i 
                    key={star} 
                    className={`bi bi-star${star <= (report.rating || 0) ? '-fill' : ''}`}
                  ></i>
                ))}
              </div>
              <span className="rating-label">{report.rating} out of 5 stars</span>
            </div>
          )}

          {isPerformanceReport && (
            <div className="section-simple">
              <h4 className="section-title">
                <i className="bi bi-person-lines-fill"></i>
                Feedback Details
              </h4>
              <div className="info-grid-simple">
                <div className="info-field">
                  <label>Passenger Name</label>
                  <span>{passengerName}</span>
                </div>
                <div className="info-field">
                  <label>Company Name</label>
                  <span>{report.company_name || report.route?.company || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Submitted At</label>
                  <span>{formattedSubmittedDate}</span>
                </div>
              </div>
            </div>
          )}

          {/* Driver Information */}
          {report.driver && (
            <div className="section-simple">
              <h4 className="section-title">
                <i className="bi bi-person-circle"></i>
                Driver Information
              </h4>
              <div className="info-grid-simple">
                <div className="info-field">
                  <label>Full Name</label>
                  <span>{report.driver.first_name} {report.driver.last_name}</span>
                </div>
                <div className="info-field">
                  <label>Email</label>
                  <span>{report.driver.user?.email || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Shuttle Information */}
          {report.shuttle && (
            <div className="section-simple">
              <h4 className="section-title">
                <i className="bi bi-bus-front"></i>
                Shuttle Information
              </h4>
              <div className="info-grid-simple">
                <div className="info-field">
                  <label>Model</label>
                  <span>{report.shuttle.model}</span>
                </div>
                <div className="info-field">
                  <label>Plate Number</label>
                  <span>{report.plate_number || report.shuttle?.plate || 'N/A'}</span>
                </div>
                <div className="info-field">
                  <label>Capacity</label>
                  <span>{report.shuttle.capacity || 'N/A'} passengers</span>
                </div>
                <div className="info-field">
                  <label>Route</label>
                  <span>
                    {report.route?.name || report.route_name || 
                     (report.route_id ? `Route ID: ${report.route_id}` : 'N/A')}
                  </span>
                </div>
                {isIncidentReport && (
                  <div className="info-field">
                    <label>Company</label>
                    <span>{report.company_name || report.route?.company || 'N/A'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description/Feedback */}
          <div className="section-simple">
            <h4 className="section-title">
              <i className={isIncidentReport ? "bi bi-exclamation-triangle" : "bi bi-chat-square-text"}></i>
              {isIncidentReport ? 'Incident Description' : 'Client Feedback'}
            </h4>
            <div className="feedback-box-simple">
              {report.description || (isIncidentReport ? 'No description provided.' : 'No feedback provided.')}
            </div>
          </div>
        </div>

        <div className="modal-footer-simple">
          <button className="btn-close-simple" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------
   ChartCard
   ------------------------- */
const ChartCard = ({ title, children, onViewInsights }) => {
  return (
    <div
      className="chart-section chart-card"
      role="button"
      onClick={onViewInsights}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onViewInsights(); }}
    >
      <div className="chart-header">
        <h4>{title}</h4>
        <button
          className="view-insights-badge"
          onClick={(e) => { e.stopPropagation(); onViewInsights(); }}
        >
          <i className="bi bi-lightbulb"></i> View insights
        </button>
      </div>
      <div className="chart-content">{children}</div>
    </div>
  );
};

/* -------------------------
   Main Component
   ------------------------- */
const ReportManagement = () => {
  const [reports, setReports] = useState([]);
  const [selectedType, setSelectedType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedGenerateType, setSelectedGenerateType] = useState('Driver Performance');
  const [insightModalOpen, setInsightModalOpen] = useState(false);
  const [insightTitle, setInsightTitle] = useState('');
  const [insightItems, setInsightItems] = useState([]);
  
  // Report details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedDriver, setSelectedDriver] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Routes state for better route handling
  const [routes, setRoutes] = useState([]);
  
  // Updated filter types - Driver Performance, Shuttle Usage, and Incident Report
  const reportTypes = [
    'All',
    'Driver Performance',
    'Shuttle Usage',
    'Incident Report'
  ];

  const generateReportOptions = [
    { value: 'Driver Performance', label: 'Driver Performance' },
    { value: 'Shuttle Usage', label: 'Shuttle Usage' },
    { value: 'Incident Report', label: 'Incident Report' },
  ];

  const months = [
    'All', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate years array (2019-2024 based on seeder)
  const years = ['All', 2025, 2024, 2023, 2022, 2021, 2020, 2019];

  // Fetch drivers for filter
  const [drivers, setDrivers] = useState([]);
  
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const response = await api.get('/api/drivers');
        if (response.data) {
          setDrivers(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Error fetching drivers:', error);
      }
    };
    fetchDrivers();
  }, []);

  // Fetch routes for better route handling
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await api.get('/api/routes');
        if (response.data) {
          setRoutes(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('Error fetching routes:', error);
      }
    };
    fetchRoutes();
  }, []);

  /* -------------------------
     Fetch Reports from Laravel
     ------------------------- */
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await api.get('/api/reports/linked');
        if (response.data.success) {
          setReports(response.data.data);
        } else {
          console.error('No data found:', response.data);
        }
      } catch (error) {
        console.error('Error fetching reports:', error);
      }
    };

    fetchReports();
  }, []);

  // Helper function to get route name by ID
  const getRouteNameById = (routeId) => {
    if (!routeId) return 'N/A';
    const route = routes.find(r => r.id === routeId);
    return route ? route.name : `Route ID: ${routeId}`;
  };

  /* -------------------------
     Helper function to render star ratings
     ------------------------- */
  const renderStarRating = (rating) => {
    return (
      <span className="star-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <i 
            key={star}
            className={`bi bi-star${star <= rating ? '-fill' : ''}`}
            style={{ 
              color: star <= rating ? '#FFD700' : '#ccc',
              marginRight: '2px'
            }}
          ></i>
        ))}
        <span style={{ marginLeft: '8px' }}>({rating}/5)</span>
      </span>
    );
  };

  /* -------------------------
     Filter Reports by Type, Search, Month, Year, Driver, and Date Range
     ------------------------- */
  const filteredReports = reports.filter(report => {
    const matchesType =
      selectedType === 'All' ||
      report.title === selectedType;

    const matchesQuery =
      report.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // Driver filter
    const matchesDriver = 
      selectedDriver === 'All' ||
      (report.driver_id && Number(report.driver_id) === Number(selectedDriver));

    // Date range filter
    const reportDateInput = report.reported_at || report.date;
    const reportDate = reportDateInput ? new Date(reportDateInput) : null;
    const isValidReportDate = reportDate && !Number.isNaN(reportDate.getTime());
    let matchesDateRange = true;
    if (startDate || endDate) {
      if (!isValidReportDate) {
        matchesDateRange = false;
      } else {
        if (startDate) {
          const start = new Date(startDate);
          matchesDateRange = matchesDateRange && reportDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          matchesDateRange = matchesDateRange && reportDate <= end;
        }
      }
    }

    // Month/Year filters (only if date range not provided)
    let matchesMonth = true;
    let matchesYear = true;
    if (!startDate && !endDate) {
      if (isValidReportDate) {
        const reportMonth = reportDate.toLocaleString('en-US', { month: 'long' });
        const reportYear = reportDate.getFullYear();
        matchesMonth = selectedMonth === 'All' || reportMonth === selectedMonth;
        matchesYear = selectedYear === 'All' || reportYear === parseInt(selectedYear);
      } else {
        matchesMonth = selectedMonth === 'All';
        matchesYear = selectedYear === 'All';
      }
    }

    return matchesType && matchesQuery && matchesDriver && matchesDateRange && matchesMonth && matchesYear;
  });

  /* -------------------------
     Handle Row Click
     ------------------------- */
  const handleRowClick = (report) => {
    setSelectedReport(report);
    setDetailsModalOpen(true);
  };

  /* -------------------------
     Analytics & Chart Data
     ------------------------- */
  const analytics = useMemo(() => {
    // Separate Driver Performance, Shuttle Usage, and Incident Reports
    const performanceReports = filteredReports.filter(r => r.title === 'Driver Performance');
    const usageReports = filteredReports.filter(r => r.title === 'Shuttle Usage');
    const incidentReports = filteredReports.filter(r => r.title === 'Incident Report');

    // === DRIVER PERFORMANCE ANALYTICS ===
    // Group by driver and calculate average rating
    const driverPerformanceMap = {};
    performanceReports.forEach(r => {
      const driverName = r.driver ? `${r.driver.first_name} ${r.driver.last_name}` : 'Unknown';
      const driverId = r.driver_id || 'unknown';
      
      if (!driverPerformanceMap[driverId]) {
        driverPerformanceMap[driverId] = {
          driver: driverName,
          driverId: driverId,
          totalRating: 0,
          count: 0,
          reports: [] // Store individual reports for detailed view
        };
      }
      
      if (r.rating) {
        driverPerformanceMap[driverId].totalRating += r.rating;
        driverPerformanceMap[driverId].count += 1;
        driverPerformanceMap[driverId].reports.push({
          date: r.reported_at || r.date,
          rating: r.rating,
          performance: (r.rating * 20).toFixed(1),
          report: r // Store the full report for details
        });
      }
    });

    // Calculate average performance for each driver
    const driverPerformance = Object.values(driverPerformanceMap)
      .map(data => ({
        driver: data.driver,
        driverId: data.driverId,
        performance: data.count > 0 ? ((data.totalRating / data.count) * 20).toFixed(1) : 0,
        totalReports: data.count,
        averageRating: data.count > 0 ? (data.totalRating / data.count).toFixed(2) : 0,
        individualReports: data.reports.sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
      }));

    // NEW: Get performance data for chart - show ALL drivers when no specific driver selected
    let chartDriverPerformance;
    
    if (selectedDriver !== 'All') {
      // If a specific driver is selected, show their individual performance records over time
      const selectedDriverData = driverPerformance.find(d => d.driverId == selectedDriver);
      
      if (selectedDriverData) {
        // Show individual performance records over time for the selected driver
        chartDriverPerformance = selectedDriverData.individualReports.map((report, index) => ({
          date: new Date(report.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          }),
          performance: parseFloat(report.performance),
          rating: report.rating,
          fullDate: report.date,
          report: report.report
        }));
      } else {
        chartDriverPerformance = [];
      }
    } else {
      // If no specific driver selected, show top 10 drivers by average performance (original behavior)
      chartDriverPerformance = driverPerformance
        .sort((a, b) => parseFloat(b.performance) - parseFloat(a.performance))
        .slice(0, 10)
        .map(driver => ({
          driver: driver.driver,
          performance: parseFloat(driver.performance),
          totalReports: driver.totalReports,
          averageRating: parseFloat(driver.averageRating)
        }));
    }

    const avgPerformance = driverPerformance.length > 0
      ? (driverPerformance.reduce((sum, r) => sum + parseFloat(r.performance), 0) / driverPerformance.length).toFixed(1)
      : 'N/A';

    // === SHUTTLE USAGE ANALYTICS ===
    const shuttleUsageMap = {};
    usageReports.forEach(r => {
      const shuttleName = r.shuttle?.model || 'Unknown';
      if (!shuttleUsageMap[shuttleName]) {
        shuttleUsageMap[shuttleName] = {
          totalTrips: 0,
          count: 0
        };
      }
      shuttleUsageMap[shuttleName].totalTrips += r.trips || 0;
      shuttleUsageMap[shuttleName].count += 1;
    });

    const shuttleUsageData = Object.entries(shuttleUsageMap)
      .map(([shuttle, data]) => ({
        shuttle,
        trips: data.totalTrips
      }))
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 10);

    const totalTrips = shuttleUsageData.reduce((sum, r) => sum + (r.trips || 0), 0);
    const mostUsedShuttle = shuttleUsageData.length > 0
      ? shuttleUsageData[0].shuttle
      : 'N/A';

    // === INCIDENT REPORT ANALYTICS ===
    const incidentStats = {
      total: incidentReports.length,
    };

    return { 
      avgPerformance, 
      totalTrips, 
      mostUsedShuttle, 
      shuttleUsageData, 
      driverPerformance: chartDriverPerformance,
      incidentStats,
      isIndividualDriverView: selectedDriver !== 'All' // Flag to indicate individual driver view
    };
  }, [filteredReports, selectedDriver]);

  /* -------------------------
     Analytics Data State
     ------------------------- */
  const [analyticsData, setAnalyticsData] = useState({
    avgPerformance: 'N/A',
    totalTrips: 0,
    mostUsedShuttle: 'N/A',
    totalIncidents: 0
  });

  useEffect(() => {
    if (
      analyticsData.avgPerformance !== analytics.avgPerformance ||
      analyticsData.totalTrips !== analytics.totalTrips ||
      analyticsData.mostUsedShuttle !== analytics.mostUsedShuttle ||
      analyticsData.totalIncidents !== analytics.incidentStats.total
    ) {
      setAnalyticsData({
        avgPerformance: analytics.avgPerformance,
        totalTrips: analytics.totalTrips,
        mostUsedShuttle: analytics.mostUsedShuttle,
        totalIncidents: analytics.incidentStats.total
      });
    }
  }, [analytics, analyticsData]);

  /* -------------------------
     Insight Modal
     ------------------------- */
  const openInsightModal = (chartKey, title) => {
    setInsightTitle(title);
    let insights = [];

    switch (chartKey) {
      case 'shuttle-trips-overview':
        const maxTrips = analytics.shuttleUsageData.length > 0
          ? Math.max(...analytics.shuttleUsageData.map(r => r.trips))
          : 0;
        const minTrips = analytics.shuttleUsageData.length > 0
          ? Math.min(...analytics.shuttleUsageData.map(r => r.trips))
          : 0;
        const avgTrips = analytics.shuttleUsageData.length > 0
          ? (analytics.totalTrips / analytics.shuttleUsageData.length).toFixed(1)
          : 0;
        
        insights = [
          `Total trips across all shuttles: ${analytics.totalTrips.toLocaleString()}`,
          `Most utilized shuttle: ${analytics.mostUsedShuttle} (${maxTrips.toLocaleString()} trips)`,
          `Trip range: ${minTrips.toLocaleString()} to ${maxTrips.toLocaleString()} trips per shuttle`,
          `Average trips per shuttle: ${avgTrips}`,
          analytics.shuttleUsageData.length > 0
            ? `Number of shuttles analyzed: ${analytics.shuttleUsageData.length}`
            : 'No usage data available'
        ];
        break;

      case 'driver-performance':
        let driverInsights = [];
        
        if (analytics.isIndividualDriverView) {
          // Individual driver insights
          const selectedDriverName = drivers.find(d => d.id == selectedDriver)?.first_name || 'Selected Driver';
          const performanceData = analytics.driverPerformance;
          
          if (performanceData.length > 0) {
            const performances = performanceData.map(p => p.performance);
            const maxPerf = Math.max(...performances);
            const minPerf = Math.min(...performances);
            const avgPerf = (performances.reduce((sum, p) => sum + p, 0) / performances.length).toFixed(1);
            const latestPerf = performances[0]; // Most recent performance
            
            driverInsights = [
              `Driver: ${selectedDriverName}`,
              `Total performance records: ${performanceData.length}`,
              `Average performance score: ${avgPerf}/100`,
              `Performance range: ${minPerf} to ${maxPerf}`,
              `Latest performance: ${latestPerf}/100`,
              performanceData.length >= 5 
                ? `📈 ${performanceData.length} records available for trend analysis`
                : `📊 Collecting more data for better insights (${performanceData.length} records)`,
              latestPerf >= 90 
                ? '🌟 Excellent recent performance'
                : latestPerf >= 80
                ? '👍 Good performance with consistent results'
                : '⚠️ Performance needs improvement'
            ];
          } else {
            driverInsights = [`No performance data available for ${selectedDriverName} in the selected period.`];
          }
        } else {
          // Top 10 drivers insights
          const maxPerf = analytics.driverPerformance.length > 0
            ? Math.max(...analytics.driverPerformance.map(r => parseFloat(r.performance)))
            : 0;
          const minPerf = analytics.driverPerformance.length > 0
            ? Math.min(...analytics.driverPerformance.map(r => parseFloat(r.performance)))
            : 0;
          const topDriver = analytics.driverPerformance.length > 0
            ? analytics.driverPerformance[0]
            : null;
          
          driverInsights = [
            `Average driver performance score: ${analytics.avgPerformance}/100`,
            `Performance range: ${minPerf} to ${maxPerf}`,
            topDriver ? `Top performing driver: ${topDriver.driver} with a score of ${topDriver.performance}/100` : 'No driver data available',
            analytics.avgPerformance >= 90 
              ? '🌟 Excellent overall driver performance across the team'
              : analytics.avgPerformance >= 80
              ? '👍 Good driver performance with room for improvement'
              : '⚠️ Driver performance needs attention and training',
            `Total drivers analyzed: ${analytics.driverPerformance.length}`
          ];
        }

        insights = driverInsights;
        break;

      default:
        insights = ['No insights available for this chart.'];
    }

    setInsightItems(insights);
    setInsightModalOpen(true);
  };

  /* -------------------------
     Generate Report Action with Date Range and Driver Filter
     ------------------------- */
  const handleGenerate = async () => {
    try {
      const payload = {
        report_type: selectedGenerateType,
        month: selectedMonth === 'All' ? undefined : selectedMonth,
        year: selectedYear === 'All' ? undefined : selectedYear,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        driver_id: selectedDriver === 'All' ? undefined : selectedDriver,
      };

      const response = await api.post(
        '/api/reports/generate',
        payload,
        {
          responseType: 'arraybuffer',
          headers: { Accept: 'application/pdf' },
          timeout: 30000,
        }
      );

      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedGenerateType.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      alert(`${selectedGenerateType} Report generated successfully!`);
    } catch (error) {
      try {
        // Axios with responseType 'blob' returns Blob for errors too; attempt to extract message
        if (error?.response?.data) {
          const text = await error.response.data.text();
          try {
            const json = JSON.parse(text);
            const msg = json?.message || json?.error || 'Failed to generate report.';
            alert(msg);
          } catch (_) {
            alert(text || 'Failed to generate report.');
          }
        } else {
          alert(error?.message || 'Failed to generate report.');
        }
      } catch (inner) {
        console.error('Error generating report:', error, inner);
        alert('Failed to generate report. Please try again.');
      }
    }
    setShowModal(false);
  };

  /* -------------------------
     Export CSV Action - Fixed Version
     ------------------------- */
  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      alert('No data to export!');
      return;
    }

    const headers = ['Report Type', 'Driver', 'Shuttle', 'Route', 'Date', 'Rating', 'Trips', 'Description'];
    
    const csvData = filteredReports.map(report => {
      try {
        // Safely extract all values with fallbacks
        const getSafeValue = (value, fallback = 'N/A') => {
          if (value === null || value === undefined || value === '') return fallback;
          return value;
        };

        const driverName = report.driver 
          ? `${getSafeValue(report.driver.first_name)} ${getSafeValue(report.driver.last_name)}`
          : getSafeValue(report.driver_name);

        const shuttleModel = getSafeValue(report.shuttle?.model, report.shuttle_model);
        
        // Enhanced route handling - check multiple sources
        let routeName = 'N/A';
        
        // First check if route object with name exists
        if (report.route && typeof report.route === 'object' && report.route.name) {
          routeName = report.route.name;
        } 
        // Check if route_name exists directly on report
        else if (report.route_name) {
          routeName = report.route_name;
        } 
        // Check if route is a string
        else if (report.route && typeof report.route === 'string') {
          routeName = report.route;
        }
        // Use route_id to look up route name from routes list
        else if (report.route_id) {
          routeName = getRouteNameById(report.route_id);
        }
        // Last resort - check description for route info
        else if (report.description && report.description.includes('route')) {
          // Try to extract route info from description
          const routeMatch = report.description.match(/route\s+([^.,!?]+)/i);
          if (routeMatch) {
            routeName = routeMatch[1].trim();
          }
        }
        
        const reportDate = report.reported_at || report.date || '';
        const formattedDate = reportDate 
          ? new Date(reportDate).toLocaleDateString()
          : '';

        return [
          getSafeValue(report.title),
          driverName,
          shuttleModel,
          routeName,
          formattedDate,
          getSafeValue(report.rating, ''),
          getSafeValue(report.trips, ''),
          report.description ? `"${report.description.replace(/"/g, '""')}"` : ''
        ];
      } catch (error) {
        console.error('Error processing report for CSV:', error, report);
        return ['Error', 'Error', 'Error', 'Error', 'Error', 'Error', 'Error', 'Error'];
      }
    });

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Reports_${selectedType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('CSV exported successfully!');
  };

  return (
    <div className="admin-container">
      <HeaderComponent />
      <div className="admin-main report-management">
        {/* 🔍 Search and Actions */}
        <div className="search-actions">
          <SearchBar placeholder="Search reports..." onSearch={setSearchQuery} />
          <div className="action-buttons">
            <button className="crud-btn" onClick={() => setShowModal(true)}>
              <i className="bi bi-file-earmark-text"></i> Generate Report
            </button>
            <button className="crud-btn" onClick={handleExportCSV}>
              <i className="bi bi-file-earmark-spreadsheet"></i> Export CSV
            </button>
          </div>
        </div>

        {/* 🔽 Filters Section */}
        <div className="filters-section">
          <h3 className="filters-title">🔍 Filters</h3>
          <div className="filters-grid">
            <div className="filter-item">
              <label className="filter-item-label">Report Type</label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="filter-select"
              >
                {reportTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label className="filter-item-label">Driver</label>
              <select
                value={selectedDriver}
                onChange={e => setSelectedDriver(e.target.value)}
                className="filter-select"
              >
                <option value="All">All Drivers</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.first_name} {driver.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label className="filter-item-label">Month</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="filter-select"
                disabled={!!startDate || !!endDate}
              >
                {months.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-item">
              <label className="filter-item-label">Year</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="filter-select"
                disabled={!!startDate || !!endDate}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label className="filter-item-label">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  if (e.target.value) {
                    setSelectedMonth('All');
                    setSelectedYear('All');
                  }
                }}
                className="filter-select"
              />
            </div>

            <div className="filter-item">
              <label className="filter-item-label">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  if (e.target.value) {
                    setSelectedMonth('All');
                    setSelectedYear('All');
                  }
                }}
                className="filter-select"
                min={startDate}
              />
            </div>
          </div>
          
          {/* Clear Filters Button */}
          {(selectedMonth !== 'All' || selectedYear !== 'All' || selectedType !== 'All' || selectedDriver !== 'All' || startDate || endDate) && (
            <button className="clear-filters-btn" onClick={() => {
              setSelectedMonth('All');
              setSelectedYear('All');
              setSelectedType('All');
              setSelectedDriver('All');
              setStartDate('');
              setEndDate('');
            }}>
              Clear All Filters
            </button>
          )}
        </div>

        {/* 📋 Reports Table */}
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Title (Report Type)</th>
                <th>Driver</th>
                <th>Shuttle</th>
                <th>Date</th>
                <th>Rating/Trips</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length > 0 ? (
                filteredReports.map(report => (
                  <tr 
                    key={report.id} 
                    onClick={() => handleRowClick(report)}
                    style={{ cursor: 'pointer' }}
                    className="clickable-row"
                  >
                    <td>{report.title}</td>
                    <td>{report.driver?.first_name} {report.driver?.last_name}</td>
                    <td>{report.shuttle?.model}</td>
                    <td>
                      {report.reported_at
                        ? new Date(report.reported_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })
                        : report.date
                        ? new Date(report.date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td>
                      {report.title === 'Driver Performance' 
                        ? renderStarRating(report.rating)
                        : report.title === 'Shuttle Usage'
                        ? `🚐 ${report.trips} trips`
                        : report.title === 'Incident Report'
                        ? `📝 ${(report.description || 'No description').slice(0, 80)}`
                        : 'N/A'
                      }
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '1rem' }}>
                    No reports found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 📊 Analytics Section */}
        <div className="analytics-container">
          <h3>📊 Analysis</h3>
          <div className="analytics-cards">
            <div className="analytics-card">
              <i className="bi bi-speedometer2"></i>
              <p>Avg. Driver Performance</p>
              <h4>{analyticsData.avgPerformance}/100</h4>
            </div>
            <div className="analytics-card">
              <i className="bi bi-bus-front"></i>
              <p>Total Shuttle Trips</p>
              <h4>{analyticsData.totalTrips.toLocaleString()}</h4>
            </div>
            <div className="analytics-card">
              <i className="bi bi-award"></i>
              <p>Most Used Shuttle</p>
              <h4>{analyticsData.mostUsedShuttle}</h4>
            </div>
            <div className="analytics-card">
              <i className="bi bi-exclamation-triangle"></i>
              <p>Total Incidents</p>
              <h4>{analyticsData.totalIncidents}</h4>
            </div>
          </div>

          {/* Charts */}
          <ChartCard
            title={
              analytics.isIndividualDriverView 
                ? `Driver Performance Over Time - ${drivers.find(d => d.id == selectedDriver)?.first_name || 'Selected Driver'}`
                : "Driver Performance Overview (Top 10)"
            }
            onViewInsights={() => openInsightModal('driver-performance', 'Driver Performance — Insights')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.driverPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                {analytics.isIndividualDriverView ? (
                  // Individual driver view - show performance over time
                  <>
                    <XAxis 
                      dataKey="date" 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value) => [`${value}/100`, 'Performance Score']}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0] && payload[0].payload) {
                          return `Date: ${label}`;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="performance" 
                      fill="#EA7822" 
                      name="Performance Score"
                      onClick={(data) => {
                        if (data.report) {
                          setSelectedReport(data.report);
                          setDetailsModalOpen(true);
                        }
                      }}
                    />
                  </>
                ) : (
                  // Top 10 drivers view
                  <>
                    <XAxis 
                      dataKey="driver" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value) => [`${value}/100`, 'Performance Score']}
                      labelFormatter={(label) => `Driver: ${label}`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="performance" 
                      fill="#EA7822" 
                      name="Performance Score" 
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Shuttle Trips Overview (Top 10)"
            onViewInsights={() => openInsightModal('shuttle-trips-overview', 'Shuttle Trips Overview — Insights')}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.shuttleUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shuttle" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="trips" fill="#4CAF50" name="Total Trips" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      </div>

      {/* 📦 Generate Report Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <h3>Generate Report</h3>
            <div className="radio-group">
              {generateReportOptions.map(option => (
                <label key={option.value} className="radio-label">
                  <input
                    type="radio"
                    name="gtype"
                    checked={selectedGenerateType === option.value}
                    onChange={() => setSelectedGenerateType(option.value)}
                  /> {option.label}
                </label>
              ))}
            </div>
            
            {/* Date Range for Report Generation */}
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Date Range (Optional)</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Start Date:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>End Date:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={startDate}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                Leave empty to use Month/Year filters or generate all records.
              </p>
            </div>

            {/* Driver Filter for Report Generation */}
            {selectedGenerateType !== 'Maintenance' && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Driver (Optional)</h4>
                <select
                  value={selectedDriver}
                  onChange={e => setSelectedDriver(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="All">All Drivers</option>
                  {drivers.map(driver => (
                    <option key={driver.id} value={driver.id}>
                      {driver.first_name} {driver.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
              <p>Note: Date range filter takes precedence over Month/Year filters.</p>
            </div>
            <div className="modal-actions">
              <button className="crud-btn" onClick={handleGenerate}>Generate</button>
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Insights Modal */}
      <ChartInsightModal
        open={insightModalOpen}
        onClose={() => setInsightModalOpen(false)}
        title={insightTitle}
        insights={insightItems}
      />

      {/* Report Details Modal */}
      <ReportDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        report={selectedReport}
      />
    </div>
  );
};
  
export default ReportManagement;