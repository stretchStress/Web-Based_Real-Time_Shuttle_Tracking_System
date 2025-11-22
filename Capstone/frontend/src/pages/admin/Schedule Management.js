import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import HeaderComponent from "./components/HeaderComponent";
import SearchBar from "./components/SearchBarComponent";
import "./styles/admin.css";
import "./styles/scheduleStyle.css";
import api from "../../api/api";

const API_URL = `${api.defaults.baseURL}/api`;

const colorPalette = [
  "#4CAF50", "#2196F3", "#FF9800", "#673AB7", "#009688",
  "#E91E63", "#795548", "#3F51B5", "#FF5722", "#607D8B"
];

function getRandomColor() { 
  return colorPalette[Math.floor(Math.random() * colorPalette.length)];
}

const daysOfWeek = [
  { name: "Monday" },
  { name: "Tuesday" },
  { name: "Wednesday" },
  { name: "Thursday" },
  { name: "Friday" },
  { name: "Saturday" },
  { name: "Sunday" },
];

// Small reusable searchable select component (no external deps)
const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  disabledOptions = new Set(),
  required = false,
}) => {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    // Initialize query display from value
    const selected = options.find((o) => String(o.value) === String(value));
    setQuery(selected ? `${String(selected.label)}${selected.meta ? ` — ${selected.meta}` : ""}` : "");
  }, [value, options]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShow(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // include meta in filtering (so typing 'incoming' or 'under maintenance' matches)
  const filtered = options.filter((o) =>
    (`${o.label} ${o.meta || ""}`).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShow(true);
        }}
        onFocus={() => setShow(true)}
        required={required}
      />

      {show && (
        <div
          className="card"
          style={{
            position: "absolute",
            width: "100%",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 2000,
          }}
        >
          <ul className="list-group list-group-flush">
            {filtered.length === 0 && (
              <li className="list-group-item text-muted">No matches</li>
            )}
            {filtered.map((opt) => (
              <li
                key={opt.value}
                className={`list-group-item list-group-item-action ${disabledOptions.has(Number(opt.value)) ? 'text-muted' : ''}`}
                style={{ cursor: disabledOptions.has(Number(opt.value)) ? 'not-allowed' : 'pointer' }}
                onClick={() => {
                  if (disabledOptions.has(Number(opt.value))) return;
                  onChange(opt.value);
                  setQuery(`${opt.label}${opt.meta ? ` — ${opt.meta}` : ""}`);
                  setShow(false);
                }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>{opt.label}</div>
                  {opt.meta && (
                    (() => {
                      const metaLower = String(opt.meta).toLowerCase();
                      const badgeClass = metaLower.includes('maintenance')
                        ? 'bg-warning text-dark'
                        : metaLower.includes('incoming')
                        ? 'bg-info text-dark'
                        : metaLower.includes('outgoing')
                        ? 'bg-primary text-white'
                        : 'bg-secondary text-white';
                      return (
                        <small className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem' }}>{opt.meta}</small>
                      );
                    })()
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

function DriverScheduleManagement() {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestionPrompt, setShowSuggestionPrompt] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [action, setAction] = useState("view");
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [shuttles, setShuttles] = useState([]);
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [alertMessage, setAlertMessage] = useState("");
  const [alertVariant, setAlertVariant] = useState("success");
  const [conflictErrors, setConflictErrors] = useState([]); // Track conflict errors
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkData, setBulkData] = useState({
    driver_id: "",
    route_id: "",
    shuttle_id: "",
    time: "",
    startDate: "",
    endDate: "",
    repeatPattern: "weekdays", // weekdays, weekends, all
    client_ids: [],
  });

  // === Auth Axios Instance ===
  const token = localStorage.getItem("authToken");
  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  useEffect(() => {
    fetchCompanies();
    fetchDrivers();
    fetchShuttles();
    fetchMaintenance();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchSchedules();
      fetchRoutes();
      fetchClientsByCompany();

      // If an existing selectedSchedule references a route outside the selected company,
      // clear it to avoid editing/creating schedules with mismatched routes.
      if (selectedSchedule && selectedSchedule.route) {
        const r = selectedSchedule.route;
        const routeCompanyId = r.company_id || r.companyId || (r.company && r.company.id);
        const routeCompanyName = (r.company && typeof r.company === 'string') ? r.company : (r.company && r.company.name) || '';

        if (routeCompanyId) {
          if (Number(routeCompanyId) !== Number(selectedCompany.id)) setSelectedSchedule(null);
        } else if (routeCompanyName) {
          if (String(routeCompanyName).trim() !== String(selectedCompany.name).trim()) setSelectedSchedule(null);
        } else {
          // route has no company info -> clear to be safe
          setSelectedSchedule(null);
        }
      }
    }
  }, [selectedCompany]);

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

  function formatToManilaDate(utcString) {
    if (!utcString) return "—";
    const date = new Date(utcString);
    return date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const fetchCompanies = async () => {
    try {
      const res = await axiosAuth.get(`/companies`);
      // Only include active companies
      const activeCompanies = (res.data || []).filter(
        (c) => String(c.status).toLowerCase() === "active"
      );
      setCompanies(activeCompanies);
      // Auto-select first active company if available
      if (activeCompanies.length > 0) {
        setSelectedCompany(activeCompanies[0]);
      } else {
        setSelectedCompany(null);
      }
    } catch (err) {
      console.error("Fetch companies error:", err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await axiosAuth.get(`/schedules`);
      // Filter schedules by selected company (via route.company_id or route.company name)
      const filtered = res.data.filter((schedule) => {
        if (!selectedCompany || !schedule.route) return true;
        const r = schedule.route;
        const routeCompanyId = r.company_id || r.companyId || (r.company && r.company.id);
        const routeCompanyName = (r.company && typeof r.company === 'string') ? r.company : (r.company && r.company.name) || '';

        if (routeCompanyId) return Number(routeCompanyId) === Number(selectedCompany.id);
        if (routeCompanyName) return String(routeCompanyName).trim() === String(selectedCompany.name).trim();
        // No company info on route: exclude when a company is selected
        return false;
      });
      setSchedules(filtered);
    } catch (err) {
      console.error("Fetch schedules error:", err);
    }
  };

  const fetchScheduleDetails = async (scheduleId) => {
    try {
      const res = await axiosAuth.get(`/schedules/${scheduleId}`);
      return res.data;
    } catch (err) {
      console.error("Fetch schedule details error:", err);
      return null;
    }
  };

  const removeClientFromSchedule = async (scheduleId, clientId) => {
    try {
      await axiosAuth.delete(`/schedules/${scheduleId}/remove-client/${clientId}`);
      // Refresh schedule details
      const updated = await fetchScheduleDetails(scheduleId);
      if (updated) {
        setSelectedSchedule(updated);
        setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? updated : s)));
      }
      setAlertMessage("Client removed from schedule successfully!");
      setAlertVariant("success");
      setTimeout(() => setAlertMessage(""), 3000);
    } catch (err) {
      console.error("Remove client error:", err);
      setAlertMessage("Failed to remove client. Please try again.");
      setAlertVariant("danger");
      setTimeout(() => setAlertMessage(""), 3000);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await axiosAuth.get(`/drivers`);
      setDrivers(res.data);
    } catch (err) {
      console.error("Fetch drivers error:", err);
    }
  };

  const fetchRoutes = async () => {
    try {
      const res = await axiosAuth.get(`/routes`);
      // Filter routes by selected company (require match by company_id or company name)
      const filtered = res.data.filter((route) => {
        if (!selectedCompany) return true;
        const routeCompanyId = route.company_id || route.companyId || (route.company && route.company.id);
        const routeCompanyName = (route.company && typeof route.company === 'string') ? route.company : (route.company && route.company.name) || '';

        if (routeCompanyId) return Number(routeCompanyId) === Number(selectedCompany.id);
        if (routeCompanyName) return String(routeCompanyName).trim() === String(selectedCompany.name).trim();
        // No company info on route: exclude when a company is selected
        return false;
      });
      setRoutes(filtered);
    } catch (err) {
      console.error("Fetch routes error:", err);
    }
  };

  const fetchShuttles = async () => {
    try {
      const res = await axiosAuth.get(`/shuttles`);
      setShuttles(res.data);
    } catch (err) {
      console.error("Fetch shuttles error:", err);
    }
  };

  const fetchMaintenance = async () => {
    try {
      const res = await axiosAuth.get(`/maintenance`);
      setMaintenanceList(res.data || []);
    } catch (err) {
      console.error("Fetch maintenance error:", err);
    }
  };

  const fetchClientsByCompany = async () => {
    try {
      if (!selectedCompany?.id) {
        setClients([]);
        return;
      }
      const res = await axiosAuth.get(`/companies/${selectedCompany.id}/users`, {
        params: { user_type: 'client' },
      });
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch clients error:", err);
      setClients([]);
    }
  };

  const getUnderMaintenanceShuttleIds = () => {
    return new Set(
      (maintenanceList || [])
        .filter((m) => (m.status || '').toLowerCase() === 'under maintenance')
        .map((m) => Number(m.shuttle_id || m.shuttle?.id))
        .filter((id) => !!id)
    );
  };

  const handleModal = (actionType) => {
    setModalAction(actionType);
    setShowModal(true);
  };

  const confirmAction = async () => {
    if (!selectedSchedule) return;

    if (modalAction === "delete") {
      try {
        await axiosAuth.delete(`/schedules/${selectedSchedule.id}`);
        setSchedules(schedules.filter((s) => s.id !== selectedSchedule.id));
        setAlertMessage(
          `Schedule of ${
            selectedSchedule.driver?.user
              ? `${selectedSchedule.driver.user.first_name} ${selectedSchedule.driver.user.last_name}`
              : "Unknown"
          } has been deleted.`
        );
        setAlertVariant("danger");
        setSelectedSchedule(null);
        setShowDetailsModal(false);
      } catch (err) {
        console.error("Delete error:", err);
        setAlertMessage("Failed to delete schedule.");
        setAlertVariant("danger");
      }
    } else if (modalAction === "backup") {
      setAlertMessage(
        `Schedule of ${
          selectedSchedule.driver?.user
            ? `${selectedSchedule.driver.user.first_name} ${selectedSchedule.driver.user.last_name}`
            : "Unknown"
        } has been backed up successfully.`
      );
      setAlertVariant("success");
    }

    setShowModal(false);
    setAction("view");
    setTimeout(() => setAlertMessage(""), 3000);
  };

  const handleSave = async () => {
    // Clear previous
    setConflictErrors([]);
    setSuggestions([]);
    setShowSuggestionPrompt(false);

    if (!selectedSchedule) return;

    try {
      // Prevent saving if selected shuttle is under maintenance
      const um = getUnderMaintenanceShuttleIds();
      if (um.has(Number(selectedSchedule.shuttle_id))) {
        setAlertMessage("Selected shuttle is under maintenance and cannot be scheduled.");
        setAlertVariant("danger");
        setTimeout(() => setAlertMessage(""), 4000);
        return;
      }

      // 0) Validate required fields client-side quickly
      if (!selectedSchedule.driver_id || !selectedSchedule.route_id || !selectedSchedule.shuttle_id || !selectedSchedule.date || !selectedSchedule.time || !selectedSchedule.day) {
        setAlertMessage("Please fill all required fields.");
        setAlertVariant("danger");
        setTimeout(() => setAlertMessage(""), 3000);
        return;
      }

      // 1) Try to save directly first (create/update)
      const payload = {
        driver_id: parseInt(selectedSchedule.driver_id),
        date: selectedSchedule.date,
        day: selectedSchedule.day,
        time: selectedSchedule.time,
        route_id: parseInt(selectedSchedule.route_id),
        shuttle_id: parseInt(selectedSchedule.shuttle_id),
        status: selectedSchedule.status || "Active",
      };

      console.log("Saving schedule with payload:", payload);
      console.log("Auth token present:", !!token);

       if (selectedSchedule.id) {
        setPendingSavePayload(payload);
        setShowRescheduleModal(true);
        return;
      } else {
        const res = await axiosAuth.post(`/schedules`, payload);
        const created = res.data;
        // Assign clients if selected
        if (Array.isArray(selectedSchedule.client_ids) && selectedSchedule.client_ids.length > 0) {
          try {
            await axiosAuth.post(`/schedules/${created.id}/assign-clients`, {
              client_ids: selectedSchedule.client_ids.map((id) => parseInt(id)),
              mode: 'replace',
            });
          } catch (assignErr) {
            console.error('Assign clients error:', assignErr);
          }
        }
        setSchedules((prev) => [...prev, created]);
        setAlertMessage("Schedule added successfully!");
        setAlertVariant("success");
      }

      setAction("view");
      setShowDetailsModal(false);
      setTimeout(() => setAlertMessage(""), 3000);
    } catch (err) {
      console.error("Save error - Full details:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      
      // 2) If there's a 422 conflict error, fetch suggestions
      if (err.response?.status === 422) {
        const errorData = err.response.data;
        
        // Check if it's validation errors or conflict errors
        if (errorData.errors && typeof errorData.errors === 'object' && !Array.isArray(errorData.errors)) {
          // Laravel validation errors (object format)
          const validationErrors = Object.values(errorData.errors).flat();
          setConflictErrors(validationErrors);
          setAlertMessage("Validation failed! Please check the errors below.");
          setAlertVariant("danger");
          setTimeout(() => setAlertMessage(""), 5000);
          return; // Don't fetch suggestions for validation errors
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          // Conflict errors (array format)
          setConflictErrors(errorData.errors);
        } else if (errorData.message) {
          setConflictErrors([errorData.message]);
        } else {
          setConflictErrors(["A scheduling conflict was detected."]);
        }
        
        // Now fetch suggestions from the resolve endpoint
        try {
          const resResolve = await axiosAuth.post(`/schedules/resolve`, {
            driver_id: selectedSchedule.driver_id,
            shuttle_id: selectedSchedule.shuttle_id,
            date: selectedSchedule.date,
            time: selectedSchedule.time,
            exclude_id: selectedSchedule.id || null
          });

          if (resResolve.data.success && resResolve.data.suggestions && resResolve.data.suggestions.length > 0) {
            // Show suggestions
            setSuggestions(resResolve.data.suggestions);
            setShowSuggestionPrompt(true);
            setAlertMessage("Schedule conflict detected! Review the errors and apply a suggestion, or manually adjust the schedule.");
            setAlertVariant("warning");
          } else {
            setAlertMessage("Schedule conflict detected! Please adjust the date, time, driver, or shuttle.");
            setAlertVariant("danger");
          }
        } catch (resolveErr) {
          console.error("Resolve error:", resolveErr);
          setAlertMessage("Schedule conflict detected! Please adjust the date, time, driver, or shuttle.");
          setAlertVariant("danger");
        }
        
        // keep modal open
        setTimeout(() => setAlertMessage(""), 5000);
      } else if (err.response?.status === 401) {
        setAlertMessage("Unauthorized. Please log in again.");
        setAlertVariant("danger");
        setTimeout(() => setAlertMessage(""), 3000);
      } else if (err.response?.status === 500) {
        console.error("500 Server Error Details:", err.response?.data);
        const errorMsg = err.response?.data?.message || "Server error. Please check Laravel logs.";
        setAlertMessage(`Server Error: ${errorMsg}`);
        setAlertVariant("danger");
        setTimeout(() => setAlertMessage(""), 5000);
      } else {
        // Display more specific error message from backend if available
        const errorMsg = err.response?.data?.message || err.response?.data?.error || "Failed to save schedule. Please try again.";
        setAlertMessage(errorMsg);
        setAlertVariant("danger");
        setTimeout(() => setAlertMessage(""), 3000);
      }
    }
  };

  const handleAdd = () => {
    setSelectedSchedule({
      id: null,
      driver_id: "",
      date: "",
      day: "",
      time_in: "",
      time_out: "",
      time: "",
      route_id: "",
      shuttle_id: "",
      status: "Active",
      color: getRandomColor(),
      client_ids: [],
    });
    setAction("edit");
    setShowDetailsModal(true);
    setConflictErrors([]); // Clear any previous errors
    setSuggestions([]); // Clear suggestions
    setShowSuggestionPrompt(false); // Hide suggestions
  };

  const handleBulkAdd = async () => {
    // Clear previous errors
    setConflictErrors([]);
    setSuggestions([]);
    setShowSuggestionPrompt(false);

    // Validate
    if (!bulkData.driver_id || !bulkData.route_id || !bulkData.shuttle_id || !bulkData.time || !bulkData.startDate || !bulkData.endDate) {
      setAlertMessage("Please fill all fields for bulk schedule.");
      setAlertVariant("danger");
      setTimeout(() => setAlertMessage(""), 3000);
      return;
    }

    const start = new Date(bulkData.startDate);
    const end = new Date(bulkData.endDate);

    if (start > end) {
      setAlertMessage("Start date must be before end date.");
      setAlertVariant("danger");
      setTimeout(() => setAlertMessage(""), 3000);
      return;
    }

    // Generate dates based on repeat pattern
    const generateDates = () => {
      const dates = [];
      let current = new Date(start);

      while (current <= end) {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday

        let include = false;
        if (bulkData.repeatPattern === "weekdays" && dayOfWeek >= 1 && dayOfWeek <= 5) {
          include = true;
        } else if (bulkData.repeatPattern === "weekends" && (dayOfWeek === 0 || dayOfWeek === 6)) {
          include = true;
        } else if (bulkData.repeatPattern === "all") {
          include = true;
        }

        if (include) {
          dates.push(new Date(current));
        }

        current.setDate(current.getDate() + 1);
      }

      return dates;
    };

    const dates = generateDates();

    if (dates.length === 0) {
      setAlertMessage("No dates match the selected pattern and date range.");
      setAlertVariant("warning");
      setTimeout(() => setAlertMessage(""), 3000);
      return;
    }

    // Show confirmation with count
    const confirmBulk = window.confirm(
      `This will create ${dates.length} schedule(s). Continue?`
    );

    if (!confirmBulk) {
      return;
    }

    try {
      // Prevent saving if selected shuttle is under maintenance
      const um = getUnderMaintenanceShuttleIds();
      if (um.has(Number(bulkData.shuttle_id))) {
        setAlertMessage("Selected shuttle is under maintenance and cannot be scheduled.");
        setAlertVariant("danger");
        setTimeout(() => setAlertMessage(""), 4000);
        return;
      }

      // Create schedules
      const payloads = dates.map((d) => ({
        driver_id: parseInt(bulkData.driver_id),
        date: d.toISOString().split("T")[0],
        day: daysOfWeek[d.getDay() === 0 ? 6 : d.getDay() - 1].name,
        time: bulkData.time,
        route_id: parseInt(bulkData.route_id),
        shuttle_id: parseInt(bulkData.shuttle_id),
        status: "Active",
      }));

      // POST all schedules
      const results = await Promise.allSettled(
        payloads.map((payload) => axiosAuth.post(`/schedules`, payload))
      );

      // Assign clients to each successfully created schedule
      const createdItems = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value?.data)
        .filter(Boolean);
      if (Array.isArray(bulkData.client_ids) && bulkData.client_ids.length > 0 && createdItems.length > 0) {
        await Promise.allSettled(
          createdItems.map((sched) =>
            axiosAuth.post(`/schedules/${sched.id}/assign-clients`, {
              client_ids: bulkData.client_ids.map((id) => parseInt(id)),
              mode: 'replace',
            })
          )
        );
      }

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (successful > 0) {
        fetchSchedules(); // Refresh the list
        setAlertMessage(
          `${successful} schedule(s) added successfully!${failed > 0 ? ` (${failed} failed)` : ""}`
        );
        setAlertVariant(failed > 0 ? "warning" : "success");
      } else {
        setAlertMessage("Failed to create schedules. Please try again.");
        setAlertVariant("danger");
      }

      setShowBulkModal(false);
      setBulkData({
        driver_id: "",
        route_id: "",
        shuttle_id: "",
        time: "",
        startDate: "",
        endDate: "",
        repeatPattern: "weekdays",
        client_ids: [],
      });

      setTimeout(() => setAlertMessage(""), 5000);
    } catch (err) {
      console.error("Bulk add error:", err);
      setAlertMessage("Error creating schedules. Please check the console.");
      setAlertVariant("danger");
      setTimeout(() => setAlertMessage(""), 3000);
    }
  };

  function getDayFromDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return daysOfWeek[date.getDay() === 0 ? 6 : date.getDay() - 1].name; 
  }

  return (
    <div className="admin-container">
      <HeaderComponent />

      <div className="admin-main schedule-management">
        <section className="crud-form-area">
          {/* Company Selector */}
          <div className="mb-3">
            <label className="form-label fw-bold">Select Company</label>
            <select 
              className="form-select"
              value={selectedCompany?.id || ""}
              onChange={(e) => {
                const company = companies.find(c => c.id === parseInt(e.target.value));
                setSelectedCompany(company);
              }}
            >
              <option value="">-- Choose a Company --</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          

          <div className="d-flex justify-content-between align-items-center mb-3">
            <SearchBar placeholder="Search by driver name..." onSearch={() => {}} />
            <div className="d-flex gap-2">
              <Button 
                variant="info" 
                onClick={() => setShowBulkModal(true)}
                disabled={!selectedCompany}
              >
                <i className="bi bi-calendar-range me-2"></i> Bulk Add Schedule
              </Button>
              <Button 
                variant="success" 
                onClick={handleAdd}
                disabled={!selectedCompany}
              >
                <i className="bi bi-plus-circle me-2"></i> Add Schedule
              </Button>
            </div>
          </div>

          {alertMessage && (
            <Alert variant={alertVariant} className="mt-2">
              {alertMessage}
            </Alert>
          )}

          {/* Month Filter */}
          <div className="mb-3">
            <label className="form-label fw-bold">Filter by Month</label>
            <input
              type="month"
              className="form-control"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <div className="week-grid">
            {daysOfWeek.map((day) => {
              // Filter schedules by day and selected month
              const daySchedules = schedules.filter((s) => {
                if (s.day !== day.name) return false;
                if (!selectedMonth) return true;
                // Check if schedule date is in selected month
                const scheduleMonth = s.date ? s.date.slice(0, 7) : null;
                return scheduleMonth === selectedMonth;
              });

              return (
                <div key={day.name} className="day-column">
                  <h4>{day.name}</h4>
                  {daySchedules.map((s) => (
                    <div
                      key={s.id}
                      className="schedule-item text-white"
                      style={{
                        backgroundColor: s.color || getRandomColor(),
                        fontWeight: "bold",
                        cursor: "pointer",
                        borderRadius: "6px",
                        padding: "8px",
                        marginBottom: "6px",
                      }}
                      onClick={async () => {
                        // Fetch full schedule details including clients
                        const details = await fetchScheduleDetails(s.id);
                        setSelectedSchedule(details || s);
                        setShowDetailsModal(true);
                        setAction("view");
                        setConflictErrors([]); // Clear errors when viewing
                        setSuggestions([]); // Clear suggestions
                        setShowSuggestionPrompt(false); // Hide suggestions
                      }}
                    >
                      <div>
                        {s.driver?.user
                          ? `${s.driver.user.first_name} ${s.driver.user.last_name}`
                          : "No Driver"}
                      </div>
                      <div style={{ fontSize: "11px", marginTop: "2px", opacity: 0.9 }}>
                        {s.date ? formatToManilaDate(s.date) : ''}
                      </div>
                      <div style={{ fontSize: "12px", marginTop: "2px" }}>
                        {s.time}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Confirmation Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modalAction === "delete" ? "Confirm Delete" : "Confirm Backup"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSchedule && (
            <p>
              Are you sure you want to {" "}
              <strong>{modalAction}</strong> the schedule of{" "}
              <strong>
                {selectedSchedule.driver?.user
                  ? `${selectedSchedule.driver.user.first_name} ${selectedSchedule.driver.user.last_name}`
                  : "Unknown"}
              </strong>?
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button
            variant={modalAction === "delete" ? "danger" : "success"}
            onClick={confirmAction}
          >
            {modalAction === "delete" ? "Delete" : "Backup"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* update */}
      <Modal
        show={showRescheduleModal}
        onHide={() => setShowRescheduleModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Reschedule</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to reschedule this trip? <br />
            This will <strong>clear the driver's time in/out logs</strong>.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRescheduleModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (pendingSavePayload && selectedSchedule?.id) {
                // Clear time logs before sending
                pendingSavePayload.time_in = null;
                pendingSavePayload.time_out = null;

                try {
                  const res = await axiosAuth.put(
                    `/schedules/${selectedSchedule.id}`,
                    pendingSavePayload
                  );
                  setSchedules((prev) =>
                    prev.map((s) => (s.id === selectedSchedule.id ? res.data : s))
                  );
                  
                  // Assign/replace clients for updated schedule only if client_ids have changed
                  if (Array.isArray(selectedSchedule.client_ids)) {
                    // Get original client IDs from the schedule
                    const originalClientIds = (selectedSchedule.clients || []).map(c => c.id).sort();
                    const newClientIds = selectedSchedule.client_ids.map(id => parseInt(id)).sort();
                    
                    // Check if there are actual changes
                    const hasChanges = JSON.stringify(originalClientIds) !== JSON.stringify(newClientIds);
                    
                    if (hasChanges) {
                      try {
                        await axiosAuth.post(`/schedules/${selectedSchedule.id}/assign-clients`, {
                          client_ids: newClientIds,
                          mode: 'replace',
                        });
                      } catch (assignErr) {
                        console.error('Assign clients on update error:', assignErr);
                        setAlertMessage('Schedule updated but client assignment failed.');
                        setAlertVariant('warning');
                      }
                    }
                  }
                  setAlertMessage("Schedule rescheduled successfully!");
                  setAlertVariant("success");
                  setAction("view");
                  setShowDetailsModal(false);
                } catch (err) {
                  console.error("Reschedule error:", err);
                  setAlertMessage("Failed to reschedule. Please try again.");
                  setAlertVariant("danger");
                } finally {
                  setShowRescheduleModal(false);
                  setPendingSavePayload(null);
                  setTimeout(() => setAlertMessage(""), 3000);
                }
              }
            }}
          >
            Confirm
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Details Modal */}
      <Modal
        show={showDetailsModal}
        onHide={() => {
          setShowDetailsModal(false);
          setConflictErrors([]); // Clear errors when closing
          setSuggestions([]); // Clear suggestions
          setShowSuggestionPrompt(false); // Hide suggestions
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {action === "edit"
              ? selectedSchedule?.id ? "Edit Driver Schedule" : "Add Driver Schedule"
              : "Driver Schedule Details"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSchedule && (
            <>
              {/* Display conflict errors if any */}
              {conflictErrors.length > 0 && (
                <Alert variant="danger" className="mb-3">
                  <Alert.Heading>
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    Schedule Conflict Detected!
                  </Alert.Heading>
                  <hr />
                  <ul className="mb-0">
                    {conflictErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                  <small className="text-muted mt-2 d-block">
                    Please adjust the date, time, driver, or shuttle to resolve the conflict.
                  </small>
                </Alert>
              )}

              {/* Suggestions UI */}
              {showSuggestionPrompt && suggestions.length > 0 && (
                <Alert variant="info" className="mb-3">
                  <Alert.Heading>
                    <i className="bi bi-lightbulb-fill me-2"></i>
                    Suggested Alternatives
                  </Alert.Heading>
                  <hr />
                  <ul className="mb-0">
                    {suggestions.map((sug, idx) => (
                      <li key={idx} className="mb-2">
                        <div>{sug.message}</div>
                        <div className="mt-1">
                          <Button
                            size="sm"
                            variant="outline-success"
                            className="me-2"
                            onClick={() => {
                              // Apply suggestion by type
                              if (sug.type === 'shuttle_alternative' && sug.shuttle) {
                                setSelectedSchedule(prev => ({ ...prev, shuttle_id: sug.shuttle.id }));
                              } else if (sug.type === 'driver_alternative' && sug.driver) {
                                setSelectedSchedule(prev => ({ ...prev, driver_id: sug.driver.id }));
                              } else if (sug.type && sug.type.startsWith('time_alternative') && sug.time) {
                                setSelectedSchedule(prev => ({ ...prev, time: sug.time }));
                              }
                              // hide prompt and then attempt save again
                              setShowSuggestionPrompt(false);
                              setSuggestions([]);
                              // re-run save automatically to persist applied suggestion
                              setTimeout(() => handleSave(), 300);
                            }}
                          >
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => {
                              // Remove this suggestion from the list
                              setSuggestions(prev => prev.filter((_, i) => i !== idx));
                            }}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <small className="text-muted d-block mt-2">
                    You can apply a suggestion (auto-fill) or dismiss all suggestions and press Save to attempt to save anyway.
                  </small>
                </Alert>
              )}

              {action === "view" ? (
                <>
                  <h3>
                    {selectedSchedule.driver?.user
                      ? `${selectedSchedule.driver.user.first_name} ${selectedSchedule.driver.user.last_name}`
                      : "No Driver"}
                  </h3>
                  <p>
                    <strong>Date:</strong> {formatToManilaDate(selectedSchedule.date)}
                  </p>
                  <p>
                    <strong>Day:</strong> {selectedSchedule.day}
                  </p>
                  <p>
                    <strong>Schedule:</strong> {selectedSchedule.time}
                  </p>
                  <p>
                    <strong>Time In:</strong>{" "}
                    {formatToManilaTime(selectedSchedule.time_in) || "Not yet timed in"}
                  </p>
                  <p>
                    <strong>Time Out:</strong>{" "}
                    {formatToManilaTime(selectedSchedule.time_out) || "Not yet timed out"}
                  </p>
                  <p>
                    <strong>Route:</strong>{" "}
                    {selectedSchedule.route
                      ? selectedSchedule.route.name
                      : "No Route"}
                  </p>
                  <p>
                    <strong>Shuttle:</strong>{" "}
                    {selectedSchedule.shuttle
                      ? `${selectedSchedule.shuttle.model} (${selectedSchedule.shuttle.plate})`
                      : "No Shuttle"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={`badge bg-${selectedSchedule.status === "Active" ? "success" : "secondary"}`}>
                      {selectedSchedule.status}
                    </span>
                  </p>

                  {/* Assigned Clients Section */}
                  <div className="mt-3">
                    <strong>Assigned Clients:</strong>
                    {selectedSchedule.clients && selectedSchedule.clients.length > 0 ? (
                      <div className="mt-2">
                        {selectedSchedule.clients.map((client) => (
                          <div
                            key={client.id}
                            className="d-flex justify-content-between align-items-center border rounded p-2 mb-2"
                          >
                            <span>
                              {client.user
                                ? `${client.user.first_name} ${client.user.last_name}`
                                : `${client.first_name || ''} ${client.last_name || ''}`}
                              {client.company?.name && (
                                <small className="text-muted ms-2">({client.company.name})</small>
                              )}
                            </span>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                if (window.confirm('Remove this client from the schedule?')) {
                                  removeClientFromSchedule(selectedSchedule.id, client.id);
                                }
                              }}
                            >
                              <i className="bi bi-trash"></i> Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted mt-2">No clients assigned to this schedule.</div>
                    )}
                  </div>
                </>
              ) : (
                <Form>
                  {/* Driver Dropdown */}
                  <Form.Group className="mb-3">
                    <Form.Label>Driver <span className="text-danger">*</span></Form.Label>
                    <SearchableSelect
                      options={drivers.map((d) => ({
                        value: d.id,
                        label: d.user ? `${d.user.first_name} ${d.user.last_name}` : "Unnamed Driver",
                      }))}
                      value={selectedSchedule.driver_id || ""}
                      onChange={(v) =>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          driver_id: v,
                        })}
                      placeholder="Select Driver"
                      required
                    />
                  </Form.Group>

                  {/* Date */}
                  <Form.Group className="mb-3">
                    <Form.Label>Date <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={selectedSchedule.date}
                      onChange={(e) =>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          date: e.target.value,
                          day: getDayFromDate(e.target.value),
                        })
                      }
                      required
                    />
                    {selectedSchedule.day && (
                      <Form.Text className="text-muted">
                        Selected day: <strong>{selectedSchedule.day}</strong>
                      </Form.Text>
                    )}
                  </Form.Group>

                  {/* Time */}
                  <Form.Group className="mb-3">
                    <Form.Label>Schedule (Time) <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="time"
                      value={selectedSchedule.time}
                      onChange={(e) =>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          time: e.target.value,
                        })
                      }
                      required
                    />
                    <Form.Text className="text-muted">
                      The system will check for conflicts within a 30-minute window.
                    </Form.Text>
                  </Form.Group>

                  {/* Route Dropdown */}
                  <Form.Group className="mb-3">
                    <Form.Label>Route <span className="text-danger">*</span></Form.Label>
                    <SearchableSelect
                      options={routes.map((r) => ({
                        value: r.id,
                        label: r.name,
                        meta: r.direction ? `${r.direction}` : undefined,
                      }))}
                      value={selectedSchedule.route_id || ""}
                      onChange={(v) =>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          route_id: v,
                        })}
                      placeholder="Select Route"
                      required
                    />
                  </Form.Group>

                  {/* Shuttle Dropdown */}
                  <Form.Group className="mb-3">
                    <Form.Label>Shuttle <span className="text-danger">*</span></Form.Label>
                    <SearchableSelect
                      options={shuttles.map((s) => {
                        const um = getUnderMaintenanceShuttleIds();
                        const disabled = um.has(Number(s.id));
                        return ({
                          value: s.id,
                          label: `${s.model} (${s.plate})`,
                          meta: disabled ? 'Under Maintenance' : undefined,
                        });
                      })}
                      value={selectedSchedule.shuttle_id || ""}
                      onChange={(v) =>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          shuttle_id: v,
                        })}
                      placeholder="Select Shuttle"
                      disabledOptions={getUnderMaintenanceShuttleIds()}
                      required
                    />
                  </Form.Group>

                  {/* Clients Multi-Select */}
                  <Form.Group className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <Form.Label className="mb-0">Assign Clients</Form.Label>
                      {clients.length > 0 && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-decoration-none p-0"
                          onClick={() => {
                            const allClientIds = clients.map(c => c.id);
                            const currentIds = Array.isArray(selectedSchedule.client_ids) ? selectedSchedule.client_ids : [];
                            const allSelected = allClientIds.every(id => currentIds.includes(id));
                            
                            setSelectedSchedule(prev => ({
                              ...prev,
                              client_ids: allSelected ? [] : allClientIds
                            }));
                          }}
                        >
                          {(() => {
                            const allClientIds = clients.map(c => c.id);
                            const currentIds = Array.isArray(selectedSchedule.client_ids) ? selectedSchedule.client_ids : [];
                            const allSelected = allClientIds.every(id => currentIds.includes(id));
                            return allSelected ? (
                              <><i className="bi bi-square me-1"></i>Deselect All</>
                            ) : (
                              <><i className="bi bi-check-square me-1"></i>Select All</>
                            );
                          })()}
                        </Button>
                      )}
                    </div>
                    <div className="border rounded p-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {clients.length === 0 && (
                        <div className="text-muted">No clients available for the selected company.</div>
                      )}
                      {clients.map((c) => (
                        <div key={c.id} className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`client-${c.id}`}
                            checked={Array.isArray(selectedSchedule.client_ids) && selectedSchedule.client_ids.includes(c.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedSchedule((prev) => {
                                const current = Array.isArray(prev.client_ids) ? prev.client_ids.slice() : [];
                                if (checked) {
                                  if (!current.includes(c.id)) current.push(c.id);
                                } else {
                                  const idx = current.indexOf(c.id);
                                  if (idx > -1) current.splice(idx, 1);
                                }
                                return { ...prev, client_ids: current };
                              });
                            }}
                          />
                          <label className="form-check-label" htmlFor={`client-${c.id}`}>
                            {c.user ? `${c.user.first_name} ${c.user.last_name}` : `${c.first_name || ''} ${c.last_name || ''}`}
                            {c.company?.name ? ` — ${c.company.name}` : ''}
                          </label>
                        </div>
                      ))}
                    </div>
                    <Form.Text className="text-muted">
                      {selectedSchedule.id 
                        ? 'Update client assignments for this schedule.'
                        : 'Selected clients will be assigned to this schedule after it is created.'}
                    </Form.Text>
                  </Form.Group>

                  {/* Status */}
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={selectedSchedule.status || "Active"}
                      onChange={(e) =>
                        setSelectedSchedule({
                          ...selectedSchedule,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </Form.Select>
                  </Form.Group>
                </Form>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="d-flex flex-column gap-2 align-items-stretch">
          {action === "edit" ? (
            <>
              <Button
                variant="success"
                onClick={handleSave}
                className="w-100"
              >
                <i className="bi bi-check-circle me-2"></i> Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAction("view");
                  setConflictErrors([]); // Clear errors when canceling
                  setSuggestions([]); // Clear suggestions
                  setShowSuggestionPrompt(false); // Hide suggestions
                }}
                className="w-100"
              >
                <i className="bi bi-x-circle me-2"></i> Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  // Initialize client_ids from clients array when editing
                  if (selectedSchedule.clients && Array.isArray(selectedSchedule.clients)) {
                    setSelectedSchedule(prev => ({
                      ...prev,
                      client_ids: prev.clients.map(c => c.id)
                    }));
                  } else if (!selectedSchedule.client_ids) {
                    setSelectedSchedule(prev => ({
                      ...prev,
                      client_ids: []
                    }));
                  }
                  setAction("edit");
                }}
                className="w-100"
              >
                <i className="bi bi-pencil-square me-2"></i> Edit
              </Button>
              <Button
                variant="danger"
                onClick={() => handleModal("delete")}
                className="w-100"
              >
                <i className="bi bi-trash me-2"></i> Delete
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      {/* Bulk Add Schedule Modal */}
      <Modal
        show={showBulkModal}
        onHide={() => {
          setShowBulkModal(false);
          setBulkData({
            driver_id: "",
            route_id: "",
            shuttle_id: "",
            time: "",
            startDate: "",
            endDate: "",
            repeatPattern: "weekdays",
            client_ids: [],
          });
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-calendar-range me-2"></i> Bulk Add Schedules
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Driver Dropdown */}
            <Form.Group className="mb-3">
              <Form.Label>Driver <span className="text-danger">*</span></Form.Label>
              <SearchableSelect
                options={drivers.map((d) => ({
                  value: d.id,
                  label: d.user ? `${d.user.first_name} ${d.user.last_name}` : "Unnamed Driver",
                }))}
                value={bulkData.driver_id || ""}
                onChange={(v) => setBulkData({ ...bulkData, driver_id: v })}
                placeholder="Select Driver"
                required
              />
            </Form.Group>

            {/* Route Dropdown */}
            <Form.Group className="mb-3">
              <Form.Label>Route <span className="text-danger">*</span></Form.Label>
              <SearchableSelect
                options={routes.map((r) => ({
                  value: r.id,
                  label: r.name,
                  meta: r.direction ? `${r.direction}` : undefined,
                }))}
                value={bulkData.route_id || ""}
                onChange={(v) => setBulkData({ ...bulkData, route_id: v })}
                placeholder="Select Route"
                required
              />
            </Form.Group>

            {/* Shuttle Dropdown */}
            <Form.Group className="mb-3">
              <Form.Label>Shuttle <span className="text-danger">*</span></Form.Label>
              <SearchableSelect
                options={shuttles.map((s) => {
                  const um = getUnderMaintenanceShuttleIds();
                  const disabled = um.has(Number(s.id));
                  return ({
                    value: s.id,
                    label: `${s.model} (${s.plate})`,
                    meta: disabled ? 'Under Maintenance' : undefined,
                  });
                })}
                value={bulkData.shuttle_id || ""}
                onChange={(v) => setBulkData({ ...bulkData, shuttle_id: v })}
                placeholder="Select Shuttle"
                disabledOptions={getUnderMaintenanceShuttleIds()}
                required
              />
            </Form.Group>

            {/* Clients Multi-Select (Bulk) */}
            <Form.Group className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label className="mb-0">Assign Clients to all created schedules</Form.Label>
                {clients.length > 0 && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-decoration-none p-0"
                    onClick={() => {
                      const allClientIds = clients.map(c => c.id);
                      const currentIds = Array.isArray(bulkData.client_ids) ? bulkData.client_ids : [];
                      const allSelected = allClientIds.every(id => currentIds.includes(id));
                      
                      setBulkData(prev => ({
                        ...prev,
                        client_ids: allSelected ? [] : allClientIds
                      }));
                    }}
                  >
                    {(() => {
                      const allClientIds = clients.map(c => c.id);
                      const currentIds = Array.isArray(bulkData.client_ids) ? bulkData.client_ids : [];
                      const allSelected = allClientIds.every(id => currentIds.includes(id));
                      return allSelected ? (
                        <><i className="bi bi-square me-1"></i>Deselect All</>
                      ) : (
                        <><i className="bi bi-check-square me-1"></i>Select All</>
                      );
                    })()}
                  </Button>
                )}
              </div>
              <div className="border rounded p-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {clients.length === 0 && (
                  <div className="text-muted">No clients available for the selected company.</div>
                )}
                {clients.map((c) => (
                  <div key={c.id} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`bulk-client-${c.id}`}
                      checked={Array.isArray(bulkData.client_ids) && bulkData.client_ids.includes(c.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBulkData((prev) => {
                          const current = Array.isArray(prev.client_ids) ? prev.client_ids.slice() : [];
                          if (checked) {
                            if (!current.includes(c.id)) current.push(c.id);
                          } else {
                            const idx = current.indexOf(c.id);
                            if (idx > -1) current.splice(idx, 1);
                          }
                          return { ...prev, client_ids: current };
                        });
                      }}
                    />
                    <label className="form-check-label" htmlFor={`bulk-client-${c.id}`}>
                      {c.user ? `${c.user.first_name} ${c.user.last_name}` : `${c.first_name || ''} ${c.last_name || ''}`}
                      {c.company?.name ? ` — ${c.company.name}` : ''}
                    </label>
                  </div>
                ))}
              </div>
              <Form.Text className="text-muted">
                These clients will be assigned to each schedule created in this batch.
              </Form.Text>
            </Form.Group>

            {/* Time */}
            <Form.Group className="mb-3">
              <Form.Label>Schedule (Time) <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="time"
                value={bulkData.time}
                onChange={(e) => setBulkData({ ...bulkData, time: e.target.value })}
                required
              />
              <Form.Text className="text-muted">
                All schedules will have this time.
              </Form.Text>
            </Form.Group>

            {/* Date Range */}
            <Form.Group className="mb-3">
              <Form.Label>Start Date <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={bulkData.startDate}
                onChange={(e) => setBulkData({ ...bulkData, startDate: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>End Date <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={bulkData.endDate}
                onChange={(e) => setBulkData({ ...bulkData, endDate: e.target.value })}
                required
              />
            </Form.Group>

            {/* Repeat Pattern */}
            <Form.Group className="mb-3">
              <Form.Label>Repeat Pattern <span className="text-danger">*</span></Form.Label>
              <Form.Select
                value={bulkData.repeatPattern}
                onChange={(e) => setBulkData({ ...bulkData, repeatPattern: e.target.value })}
              >
                <option value="weekdays">Weekdays (Mon-Fri)</option>
                <option value="weekends">Weekends (Sat-Sun)</option>
                <option value="all">All Days</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Select which days to schedule within the date range.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowBulkModal(false);
              setBulkData({
                driver_id: "",
                route_id: "",
                shuttle_id: "",
                time: "",
                startDate: "",
                endDate: "",
                repeatPattern: "weekdays",
              });
            }}
          >
            Cancel
          </Button>
          <Button variant="success" onClick={handleBulkAdd}>
            <i className="bi bi-check-circle me-2"></i> Create Schedules
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default DriverScheduleManagement;