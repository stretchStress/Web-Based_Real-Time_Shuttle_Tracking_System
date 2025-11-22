import React, { useEffect, useMemo, useState } from 'react';
import HeaderComponent from './components/HeaderComponent';
import SearchBar from './components/SearchBarComponent';
import './styles/admin.css';
import './styles/maintenanceStyle.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import api from "../../api/api";

const MaintenanceManagement = () => {
  // data
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [shuttles, setShuttles] = useState([]);

  // UI state
  const [action, setAction] = useState('view'); // view | add | edit
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // backup | delete | null

  // form state
  const emptyForm = {
    shuttle_id: '',
    technician: '',
    start_date: '',
    end_date: '',
    description: '',
    status: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [reportFile, setReportFile] = useState(null);
  const [importedFileName, setImportedFileName] = useState('');
  const [existingFileUrl, setExistingFileUrl] = useState(''); // Add this line

  // maintenance analytics & reporting
  const [maintenanceStats, setMaintenanceStats] = useState({
    total_maintenances: 0,
    under_maintenance: 0,
    done_repairing: 0,
    shuttle_maintenance: [],
    most_maintained_shuttle: null,
  });
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // alerts
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('success');

  // --- Lifecycle: setup auth and fetch data ---
  useEffect(() => {
    // Ensure auth token is set for API requests
    const token = localStorage.getItem('authToken');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    fetchShuttles();
    fetchMaintenance();
    fetchMaintenanceStats();
  }, []);

  const fetchShuttles = async () => {
    try {
      const res = await api.get('/api/shuttles');
      setShuttles(res.data);
    } catch (err) {
      console.error('fetchShuttles error', err);
      showAlert('Failed to load shuttles', 'danger');
    }
  };

  const fetchMaintenance = async () => {
    try {
      const res = await api.get('/api/maintenance');
      setMaintenanceList(res.data);
    } catch (err) {
      console.error('fetchMaintenance error', err);
      showAlert('Failed to load maintenance records', 'danger');
    }
  };

  const fetchMaintenanceStats = async () => {
    try {
      const res = await api.get('/api/reports/maintenance-stats');
      if (res.data?.success) {
        setMaintenanceStats(res.data.data);
      }
    } catch (err) {
      console.error('fetchMaintenanceStats error', err);
      showAlert('Failed to load maintenance statistics', 'danger');
    }
  };

  // --- Helpers ---
  const showAlert = (message, type = 'success', duration = 3000) => {
    setAlertMessage(message);
    setAlertType(type);
    setTimeout(() => setAlertMessage(null), duration);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setReportFile(null);
    setImportedFileName('');
    setExistingFileUrl(''); // Add this line
  };

  // Helper function to check if file is an image
  const isImageFile = (url) => {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  // --- File input ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReportFile(file);
      setImportedFileName(file.name);
      showAlert(`File "${file.name}" selected.`, 'success', 2000);
    }
  };

  // --- Search filtering ---
  const filteredMaintenance = maintenanceList.filter(item => {
    // get shuttle plate; API might return shuttle relation or shuttle_id
    const shuttlePlate = item.shuttle?.plate || findShuttlePlateById(item.shuttle_id) || '';
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      shuttlePlate.toLowerCase().includes(q) ||
      (item.technician || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      (item.status || '').toLowerCase().includes(q) ||
      ((item.start_date || item.date || '') + '').toLowerCase().includes(q) ||
      ((item.end_date || '') + '').toLowerCase().includes(q)
    );
  });

  const findShuttlePlateById = (id) => {
    const s = shuttles.find(x => Number(x.id) === Number(id));
    return s ? s.plate : '';
  };

  const mostUnderMaintenance = useMemo(() => {
    if (!maintenanceStats?.shuttle_maintenance?.length) return null;
    return [...maintenanceStats.shuttle_maintenance].sort((a, b) => {
      const aCount = a.under_maintenance ?? 0;
      const bCount = b.under_maintenance ?? 0;
      if (bCount === aCount) {
        return (b.maintenance_count ?? 0) - (a.maintenance_count ?? 0);
      }
      return bCount - aCount;
    })[0];
  }, [maintenanceStats]);

  // Map maintenance status to shuttle status and update shuttle via API
  const updateShuttleStatusToMaintenance = async (shuttleId, maintenanceStatus) => {
    if (!shuttleId) return;
    
    let shuttleStatus = null;
    const status = maintenanceStatus.toLowerCase();
    
    // Set to Maintenance when under maintenance, Active when done repairing
    if (status.includes('maintenance')) {
      shuttleStatus = 'Maintenance';
    } else if (status.includes('done') || status.includes('repairing')) {
      shuttleStatus = 'Active';
    }
    
    if (!shuttleStatus) return;
    
    try {
      const existing = shuttles.find(x => Number(x.id) === Number(shuttleId));
      let payload = { status: shuttleStatus };
      
      if (existing) {
        payload = {
          model: existing.model ?? '',
          capacity: existing.capacity ?? 0,
          plate: existing.plate ?? '',
          status: shuttleStatus,
        };
      }
      
      await api.put(`/api/shuttles/${shuttleId}`, payload);
      showAlert(`Shuttle status updated to "${shuttleStatus}".`, 'success', 2500);
      fetchShuttles();
    } catch (err) {
      console.error('updateShuttleStatusToMaintenance error', err);
      showAlert('Failed to update shuttle status.', 'danger', 3000);
    }
  };

  const handleExportCSV = () => {
    if (filteredMaintenance.length === 0) {
      showAlert('No maintenance records to export.', 'danger');
      return;
    }

    const headers = [
      'Shuttle',
      'Technician',
      'Start Date',
      'End Date',
      'Status',
      'Description'
    ];

    const rows = filteredMaintenance.map(item => {
      const shuttlePlate = item.shuttle?.plate || findShuttlePlateById(item.shuttle_id) || '';
      const start = item.start_date || item.date || '';
      const end = item.end_date || (item.status === 'Done Repairing' ? '' : 'In Progress');
      return [
        `"${(item.shuttle?.model ? `${item.shuttle.model} (${shuttlePlate})` : shuttlePlate) || '—'}"`,
        `"${item.technician || '—'}"`,
        start,
        end,
        `"${item.status || '—'}"`,
        `"${(item.description || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Maintenance_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showAlert('CSV exported successfully!', 'success', 2500);
  };

  const handleGenerateReport = async () => {
    if (reportStartDate && reportEndDate) {
      if (new Date(reportStartDate) > new Date(reportEndDate)) {
        showAlert('End date cannot be earlier than start date.', 'danger');
        return;
      }
    }

    setReportLoading(true);
    try {
      const payload = {
        report_type: 'Maintenance',
        start_date: reportStartDate || undefined,
        end_date: reportEndDate || undefined,
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
      link.setAttribute('download', `Maintenance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showAlert('Maintenance report generated successfully!', 'success', 2500);
    } catch (error) {
      try {
        if (error?.response?.data) {
          let errorMessage = 'Failed to generate report.';
          
          // Handle ArrayBuffer response (when responseType is 'arraybuffer')
          if (error.response.data instanceof ArrayBuffer) {
            try {
              const decoder = new TextDecoder('utf-8');
              const text = decoder.decode(error.response.data);
              const json = JSON.parse(text);
              errorMessage = json?.message || json?.error || errorMessage;
            } catch (parseErr) {
              errorMessage = 'Failed to generate report. Server error occurred.';
            }
          } 
          // Handle string response
          else if (typeof error.response.data === 'string') {
            try {
              const json = JSON.parse(error.response.data);
              errorMessage = json?.message || json?.error || errorMessage;
            } catch (_) {
              errorMessage = error.response.data || errorMessage;
            }
          }
          // Handle object response (already parsed JSON)
          else if (typeof error.response.data === 'object') {
            errorMessage = error.response.data?.message || error.response.data?.error || errorMessage;
          }
          
          showAlert(errorMessage, 'danger');
        } else {
          showAlert(error?.message || 'Failed to generate report.', 'danger');
        }
      } catch (inner) {
        console.error('Error generating maintenance report:', error, inner);
        showAlert('Failed to generate report. Please try again.', 'danger');
      }
    } finally {
      setReportLoading(false);
      setReportModalOpen(false);
    }
  };

  // --- Add maintenance ---
  const openAddModal = () => {
    resetForm();
    setSelectedMaintenance(null);
    setAction('add');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.shuttle_id || !form.technician || !form.start_date || !form.status || !form.description) {
      showAlert('Please fill all required fields.', 'danger');
      return;
    }

    const computedEndDate = form.status === 'Done Repairing'
      ? (form.end_date || form.start_date || new Date().toISOString().split('T')[0])
      : '';

    try {
      const fd = new FormData();
      fd.append('shuttle_id', form.shuttle_id);
      fd.append('technician', form.technician);
      fd.append('start_date', form.start_date);
      fd.append('date', form.start_date);
      if (computedEndDate) {
        fd.append('end_date', computedEndDate);
      }
      fd.append('description', form.description);
      fd.append('status', form.status);
      if (reportFile) fd.append('report_file', reportFile);

      await api.post('/api/maintenance', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showAlert('Maintenance record added.', 'success');
      // After creating the maintenance record, update shuttle status accordingly
      if (form.shuttle_id) await updateShuttleStatusToMaintenance(form.shuttle_id, form.status);
      await fetchMaintenance();
      await fetchMaintenanceStats();
      setAction('view');
      resetForm();
    } catch (err) {
      console.error('handleAddSubmit error', err);
      const msg = err?.response?.data?.message || 'Failed to add maintenance.';
      showAlert(msg, 'danger');
    }
  };

  // --- Edit maintenance ---
  const openEditModal = (item) => {
    setSelectedMaintenance(item);
    setForm({
      shuttle_id: item.shuttle_id ?? (item.shuttle?.id ?? ''),
      technician: item.technician ?? '',
      start_date: item.start_date ?? item.date ?? '',
      end_date: item.end_date ?? '',
      description: item.description ?? '',
      status: item.status ?? '',
    });
    setReportFile(null);
    setImportedFileName('');
    setExistingFileUrl(item.report_file_url || ''); // Add this line
    setAction('edit');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaintenance) return showAlert('No maintenance selected.', 'danger');

    try {
      const fd = new FormData();
      fd.append('shuttle_id', form.shuttle_id);
      fd.append('technician', form.technician);
      if (form.start_date) {
        fd.append('start_date', form.start_date);
        fd.append('date', form.start_date);
      }
      fd.append('end_date', form.end_date || '');
      fd.append('description', form.description);
      fd.append('status', form.status);
      if (reportFile) fd.append('report_file', reportFile);

      // Laravel accepts method override; using query param _method=PUT
      await api.post(`/api/maintenance/${selectedMaintenance.id}?_method=PUT`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showAlert('Maintenance record updated.', 'success');
      // Update shuttle status if needed after edit
      if (form.shuttle_id) await updateShuttleStatusToMaintenance(form.shuttle_id, form.status);
      await fetchMaintenance();
      await fetchMaintenanceStats();
      setAction('view');
      setSelectedMaintenance(null);
      resetForm();
    } catch (err) {
      console.error('handleEditSubmit error', err);
      const msg = err?.response?.data?.message || 'Failed to update maintenance.';
      showAlert(msg, 'danger');
    }
  };

  // --- Delete & Backup ---
  const performConfirmAction = async () => {
    if (!selectedMaintenance || !confirmAction) return;

    try {
      if (confirmAction === 'delete') {
        await api.delete(`/api/maintenance/${selectedMaintenance.id}`);
        showAlert('Maintenance record deleted.', 'success');
        // Automatically set shuttle to Maintenance or Active based on status
        if (selectedMaintenance.shuttle_id) await updateShuttleStatusToMaintenance(selectedMaintenance.shuttle_id, selectedMaintenance.status);
        setSelectedMaintenance(null);
        fetchMaintenance();
        fetchMaintenanceStats();
      } 
    } catch (err) {
      console.error('performConfirmAction error', err);
      showAlert('Action failed.', 'danger');
    } finally {
      setConfirmAction(null);
      setAction('view');
    }
  };

  // --- Render ---
  return (
    <div className="admin-container">
      <HeaderComponent />

      {/* Alert */}
      {alertMessage && (
        <div className={`alert-box ${alertType}`}>
          {alertMessage}
        </div>
      )}

      <div className="admin-main maintenance-management">
        <section className="crud-form-area">
          <div className="top-controls">
            <SearchBar placeholder="Search by shuttle, technician, status..." onSearch={setSearchQuery} />
            <button className="btn-add-green" onClick={openAddModal}>
              <i className="bi bi-plus-circle"></i> Add Maintenance
            </button>
          </div>

          <section className="maintenance-report-overview">
            <div className="overview-header">
              <div>
                <h3>Maintenance Overview</h3>
                <p>Track active work orders and recently completed repairs across the fleet.</p>
              </div>
              <div className="report-actions">
                <button className="btn-report" onClick={() => setReportModalOpen(true)}>
                  <i className="bi bi-file-earmark-text"></i> Generate Report
                </button>
                <button className="btn-export" onClick={handleExportCSV}>
                  <i className="bi bi-file-earmark-spreadsheet"></i> Export CSV
                </button>
              </div>
            </div>

            <div className="overview-cards">
              <div className="overview-card">
                <div className="card-icon icon-total">
                  <i className="bi bi-tools"></i>
                </div>
                <div className="card-metric">
                  <span className="metric-label">Total Records</span>
                  <span className="metric-value">{maintenanceStats.total_maintenances}</span>
                  <span className="metric-subtitle">Across all shuttles</span>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon icon-active">
                  <i className="bi bi-exclamation-triangle"></i>
                </div>
                <div className="card-metric">
                  <span className="metric-label">Under Maintenance</span>
                  <span className="metric-value">{maintenanceStats.under_maintenance}</span>
                  <span className="metric-subtitle">Currently being serviced</span>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon icon-complete">
                  <i className="bi bi-check-circle"></i>
                </div>
                <div className="card-metric">
                  <span className="metric-label">Done Repairing</span>
                  <span className="metric-value">{maintenanceStats.done_repairing}</span>
                  <span className="metric-subtitle">Completed in the system</span>
                </div>
              </div>
            </div>

            <div className="most-under-maintenance">
              <i className="bi bi-bus-front-fill highlight-icon"></i>
              {mostUnderMaintenance ? (
                <div>
                  <span className="highlight-title">Most Under Maintenance</span>
                  <span className="highlight-value">
                    {mostUnderMaintenance.shuttle_model} ({mostUnderMaintenance.shuttle_plate})
                  </span>
                  <span className="highlight-meta">
                    {mostUnderMaintenance.under_maintenance || 0} ongoing • {mostUnderMaintenance.maintenance_count || 0} total records
                  </span>
                </div>
              ) : (
                <div>
                  <span className="highlight-title">Most Under Maintenance</span>
                  <span className="highlight-meta">No maintenance records available.</span>
                </div>
              )}
            </div>
          </section>

          <div className="maintenance-table-container">
            <table className="maintenance-table">
              <thead>
                <tr>
                  <th>Shuttle</th>
                  <th>Technician</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenance.length > 0 ? (
                  filteredMaintenance.map(item => {
                    const shuttlePlate = item.shuttle?.plate || findShuttlePlateById(item.shuttle_id) || '—';
                    return (
                      <tr
                        key={item.id}
                        className={selectedMaintenance?.id === item.id ? 'selected-row' : ''}
                        onClick={() => setSelectedMaintenance(item)}
                      >
                        <td>{shuttlePlate}</td>
                        <td>{item.technician}</td>
                        <td>{item.start_date || item.date || '—'}</td>
                        <td>{item.end_date || (item.status === 'Done Repairing' ? '—' : 'In Progress')}</td>
                        <td>{item.description}</td>
                        <td>{item.status}</td>
                        <td className="action-buttons">
                          <button
                            className="btn-edit"
                            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                            title="Edit"
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>

                          <button
                            className="btn-delete"
                            onClick={(e) => { e.stopPropagation(); setSelectedMaintenance(item); setConfirmAction('delete'); }}
                            title="Delete"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#777' }}>
                      No maintenance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add Modal */}
      {action === 'add' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => { setAction('view'); resetForm(); }}>&times;</button>
            <h3>Add Maintenance</h3>
            <form className="maintenance-form" onSubmit={handleAddSubmit}>
              <select
                name="shuttle_id"
                value={form.shuttle_id}
                onChange={(e) => setForm({ ...form, shuttle_id: e.target.value })}
                required
              >
                <option value="" disabled>Select Shuttle</option>
                {shuttles.map(s => (
                  <option key={s.id} value={s.id}>
                    {(s.model ? `${s.model} (${s.plate})` : s.plate) || '—'}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="technician"
                placeholder="Technician Name"
                value={form.technician}
                onChange={(e) => setForm({ ...form, technician: e.target.value })}
                required
              />

              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    start_date: value,
                    end_date: prev.status === 'Done Repairing' && prev.end_date && prev.end_date < value ? value : prev.end_date,
                  }));
                }}
                required
                aria-label="Maintenance Start Date"
                title="Maintenance Start Date"
              />

              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                disabled={form.status !== 'Done Repairing'}
                min={form.start_date || undefined}
                aria-label="Maintenance End Date"
                title={form.status === 'Done Repairing' ? 'Maintenance End Date' : 'Set status to Done Repairing to enable'}
              />

              <select
                name="status"
                value={form.status}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    status: value,
                    end_date: value === 'Done Repairing'
                      ? (prev.end_date || prev.start_date || new Date().toISOString().split('T')[0])
                      : '',
                  }));
                }}
                required
              >
                <option value="" disabled>Select Status</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Done Repairing">Done Repairing</option>
              </select>

              <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />

              <div className="file-upload">
                <label htmlFor="file-add"><i className="bi bi-upload"></i> Import Technician Report</label>
                <input id="file-add" type="file" accept=".pdf,.doc,.docx,.jpg,.png,.txt" onChange={handleFileChange} />
                {importedFileName && <p className="filename">Imported: {importedFileName}</p>}
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-confirm">Save</button>
                <button type="button" className="btn-cancel" onClick={() => { setAction('view'); resetForm(); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {action === 'edit' && selectedMaintenance && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => { setAction('view'); setSelectedMaintenance(null); resetForm(); }}>&times;</button>
            <h3>Edit Maintenance</h3>
            <form className="maintenance-form" onSubmit={handleEditSubmit}>
              <select
                name="shuttle_id"
                value={form.shuttle_id}
                onChange={(e) => setForm({ ...form, shuttle_id: e.target.value })}
                required
              >
                <option value="" disabled>Select Shuttle</option>
                {shuttles.map(s => (
                  <option key={s.id} value={s.id}>
                    {(s.model ? `${s.model} (${s.plate})` : s.plate) || '—'}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="technician"
                placeholder="Technician Name"
                value={form.technician}
                onChange={(e) => setForm({ ...form, technician: e.target.value })}
                required
              />

              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    start_date: value,
                    end_date: prev.status === 'Done Repairing' && prev.end_date && prev.end_date < value ? value : prev.end_date,
                  }));
                }}
                required
                aria-label="Maintenance Start Date"
                title="Maintenance Start Date"
              />

              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                disabled={form.status !== 'Done Repairing'}
                min={form.start_date || undefined}
                aria-label="Maintenance End Date"
                title={form.status === 'Done Repairing' ? 'Maintenance End Date' : 'Set status to Done Repairing to enable'}
              />

              <select
                name="status"
                value={form.status}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm(prev => ({
                    ...prev,
                    status: value,
                    end_date: value === 'Done Repairing'
                      ? (prev.end_date || prev.start_date || new Date().toISOString().split('T')[0])
                      : '',
                  }));
                }}
                required
              >
                <option value="" disabled>Select Status</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Done Repairing">Done Repairing</option>
              </select>

              <textarea
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />

              <div className="file-upload">
                <label htmlFor="file-edit"><i className="bi bi-upload"></i> Replace Technician Report</label>
                <input id="file-edit" type="file" accept=".pdf,.doc,.docx,.jpg,.png,.txt" onChange={handleFileChange} />
                {importedFileName && <p className="filename">Imported: {importedFileName}</p>}
                
                {/* Display existing file */}
                {existingFileUrl && !importedFileName && (
                  <div className="existing-file-preview" style={{ marginTop: '10px' }}>
                    <p className="filename" style={{ marginBottom: '8px' }}>Current file:</p>
                    {isImageFile(existingFileUrl) ? (
                      <div style={{ marginTop: '8px' }}>
                        <img 
                          src={existingFileUrl} 
                          alt="Technician Report" 
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '300px', 
                            border: '1px solid #ccc', 
                            borderRadius: '6px',
                            padding: '4px'
                          }} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <a 
                          href={existingFileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'none',
                            color: '#007bff',
                            textDecoration: 'none',
                            marginTop: '8px',
                            display: 'inline-block'
                          }}
                        >
                          View Full Image
                        </a>
                      </div>
                    ) : (
                      <a 
                        href={existingFileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#007bff',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          marginTop: '8px'
                        }}
                      >
                        <i className="bi bi-file-earmark"></i> View Current File
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-confirm">Update</button>
                <button type="button" className="btn-cancel" onClick={() => { setAction('view'); setSelectedMaintenance(null); resetForm(); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmAction === 'delete' && selectedMaintenance && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setConfirmAction(null)}>&times;</button>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete <strong>{selectedMaintenance.technician}'s</strong> maintenance record?</p>
            <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirmAction(null)} className="btn-cancel">Cancel</button>
              <button onClick={() => performConfirmAction()} className="btn-delete">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content small">
            <button
              className="modal-close-btn"
              onClick={() => {
                if (!reportLoading) {
                  setReportModalOpen(false);
                  setReportStartDate('');
                  setReportEndDate('');
                }
              }}
            >
              &times;
            </button>
            <h3>Generate Maintenance Report</h3>
            <p style={{ marginBottom: '1rem', color: '#555' }}>
              Optionally provide a date range to narrow the report.
            </p>
            <div className="report-date-range">
              <label>
                <span>Start Date</span>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
              </label>
              <label>
                <span>End Date</span>
                <input
                  type="date"
                  value={reportEndDate}
                  min={reportStartDate || undefined}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={handleGenerateReport}
                disabled={reportLoading}
              >
                {reportLoading ? 'Generating...' : 'Generate PDF'}
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  if (!reportLoading) {
                    setReportModalOpen(false);
                    setReportStartDate('');
                    setReportEndDate('');
                  }
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MaintenanceManagement;
