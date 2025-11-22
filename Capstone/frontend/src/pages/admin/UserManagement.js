import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/admin.css';
import './styles/userStyle.css';
import HeaderComponent from './components/HeaderComponent';
import SearchBar from './components/SearchBarComponent';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import api from '../../api/api';

const API_URL = `${api.defaults.baseURL}/api`; // Laravel backend

const UserManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [userType, setUserType] = useState('driver');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(""); // add, edit, delete
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({}); // server validation errors
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [importCompleted, setImportCompleted] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchCompanies();
    // Fetch drivers on initial load
    setUserType('driver');
  }, []);

  useEffect(() => {
    // Fetch whenever userType or selectedCompany changes
    fetchUsers();
  }, [userType, selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.get(`${API_URL}/companies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Only include active companies for client management
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
    } catch (error) {
      console.error("Error fetching companies:", error.response?.data || error.message);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      
      let endpoint;
      
      // Drivers are global (not company-scoped), Clients are company-scoped
      if (userType === 'driver') {
        // Always fetch all drivers regardless of company selection
        endpoint = `${API_URL}/users/${userType}`;
      } else {
        // Clients require company selection
        if (!selectedCompany) {
          setUsers([]);
          setLoading(false);
          return;
        }
        endpoint = `${API_URL}/companies/${selectedCompany.id}/users?user_type=${userType}`;
      }
      
      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const normalized = res.data.map(item => {
        const obj = { ...item };

        // Ensure first/last/email are present at top-level (from user relation if needed)
        if (!obj.first_name && obj.user) {
          obj.first_name = obj.user.first_name;
          obj.last_name = obj.user.last_name;
          obj.email = obj.user.email;
        }

        // Ensure cellphone fallback exists whether it's top-level or under user
        obj.cellphone_num = obj.cellphone_num ?? obj.user?.cellphone_num ?? null;

        // Normalize company: if API returned the full company object, use its name
        if (obj.company && typeof obj.company === 'object') {
          obj.company = obj.company.name ?? null;
        } else {
          obj.company = obj.company ?? obj.user?.company?.name ?? null;
        }

        // Prefer the user id if present
        obj.id = obj.user?.id ?? obj.id;

        return obj;
      });

      setUsers(normalized);
    } catch (error) {
      console.error("Error fetching users:", error.response?.data || error.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModalOpen = (user, type) => {
    setErrors({});

    if (user) {
      setSelectedUser({
        user_id: user.user?.id ?? user.id,
        id: user.id,                     
        first_name: user.first_name ?? user.user?.first_name ?? "",
        last_name: user.last_name ?? user.user?.last_name ?? "",
        email: user.email ?? user.user?.email ?? "",
        cellphone_num: user.cellphone_num ?? "",
        password: ""
      });
    } else {
      setSelectedUser({
        user_id: null,
        id: null,
        first_name: "",
        last_name: "",
        email: "",
        cellphone_num: "",
        password: ""
      });
    }

    setModalType(type);
    setShowModal(true);
    setShowPassword(false);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedUser(null);
    setModalType('');
    setErrors({});
    setShowPassword(false);
  };

  const buildPayload = () => {
    if (!selectedUser) return {};

    const payload = {
      first_name: selectedUser.first_name,
      last_name: selectedUser.last_name,
      email: selectedUser.email,
    };

    if (userType === 'driver') payload.cellphone_num = selectedUser.cellphone_num;
    // Company is auto-set by the endpoint for clients

    if (selectedUser.password && selectedUser.password.trim() !== '') {
      payload.password = selectedUser.password;
    }

    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    return payload;
  };

  const handleConfirm = async () => {
    try {
      const token = localStorage.getItem("authToken");

      if (modalType === "delete" && selectedUser) {
        await axios.delete(
          `${API_URL}/users/${userType}/${selectedUser.user_id ?? selectedUser.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setShowModal(false);
        fetchUsers();
        return;
      }

      const payload = buildPayload();

      if (modalType === "edit" && selectedUser.id) {
        await axios.put(
          `${API_URL}/users/${userType}/${selectedUser.user_id ?? selectedUser.id}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Create new user: drivers are global, clients are company-scoped
        const createEndpoint = userType === 'driver'
          ? `${API_URL}/users/${userType}`
          : `${API_URL}/companies/${selectedCompany.id}/users/${userType}`;
        
        await axios.post(createEndpoint, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setShowModal(false);
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error.response?.data || error.message);
      if (error.response?.status === 422) {
        setErrors(error.response.data.errors || {});
      }
    }
  };

  // Parse CSV and import multiple clients
  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert("Please select a file");
      return;
    }

    if (userType !== 'client') {
      alert("Bulk import is only available for clients");
      return;
    }

    if (!selectedCompany) {
      alert("Please select a company first");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csv = event.target.result;
        // Split on CRLF or LF and trim possible \r; ignore empty lines
        const lines = csv.split(/\r?\n/).map(l => l.replace(/\r/g, '')).filter(line => line.trim());

        // Detect if first line is a header (contains column names)
        let dataRows = lines;
        const first = lines[0] || '';
        if (/first\s*name|last\s*name|email/i.test(first)) {
          // header detected — skip it
          dataRows = lines.slice(1);
        }
        
        const results = {
          success: 0,
          failed: 0,
          errors: []
        };

  setImportProgress({ current: 0, total: dataRows.length, results });
  setImportResults(null);
  setImportCompleted(false);

        const token = localStorage.getItem("authToken");

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const [first_name, last_name, email, password] = row.split(',').map(col => col.trim());

          if (!first_name || !last_name) {
            results.failed++;
            results.errors.push(`Row ${i + 2}: Missing first_name or last_name`);
            setImportProgress({ current: i + 1, total: dataRows.length, results });
            continue;
          }

          try {
            const payload = {
              first_name,
              last_name,
              email: email || null,
              password: password || Math.random().toString(36).slice(-8) // Generate random password if not provided
            };

            await axios.post(
              `${API_URL}/companies/${selectedCompany.id}/users/client`,
              payload,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            results.success++;
          } catch (err) {
            results.failed++;
            const errorMsg = err.response?.data?.errors 
              ? Object.entries(err.response.data.errors).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')
              : err.message;
            results.errors.push(`Row ${i + 2} (${first_name} ${last_name}): ${errorMsg}`);
          }

          setImportProgress({ current: i + 1, total: dataRows.length, results });
        }

  // Keep the modal open and show results; let the user close it when ready
  setImportProgress(null);
  setImportResults(results);
  setImportCompleted(true);
  setImportFile(null);
  // Refresh users so newly imported rows appear — backend inserts awaited above
  fetchUsers();
      } catch (error) {
        console.error("Error parsing CSV:", error);
        alert("Error parsing CSV file");
      }
    };
    reader.readAsText(importFile);
  };

  const filteredUsers = users.filter(user =>
    `${user.first_name} ${user.last_name} ${user.email || ""} ${user.cellphone_num}`.toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-container">
      <HeaderComponent />
      <div className="admin-main user-management">
        <section className="crud-form-area">
          <div className="user-type-toggle mb-3 d-flex justify-content-between align-items-center">
            <div>
              <button className={`me-2 ${userType === 'driver' ? 'active' : ''}`} onClick={() => setUserType('driver')}>
                Drivers <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Alcedon Fleet)</span>
              </button>
              <button className={userType === 'client' ? 'active' : ''} onClick={() => setUserType('client')}>
                Clients <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>(Company Employees)</span>
              </button>
            </div>
            <div>
              <button
                className="btn btn-sm btn-success"
                onClick={() => handleModalOpen(null, "add")}
              >
                <i className="bi bi-plus-circle me-1"></i> Add {userType === "driver" ? "Driver" : "Client"}
              </button>

              {userType === 'client' && (
                <button
                  className="btn btn-sm btn-info ms-2"
                  onClick={() => setShowImportModal(true)}
                >
                  <i className="bi bi-file-earmark-spreadsheet me-1"></i> Bulk Import
                </button>
              )}
            </div>
          </div>

          {userType === 'client' && (
            <div className="company-selector mb-3">
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
          )}

          {userType === 'driver' || selectedCompany ? (
            <>
              <div className="mb-3">
                <SearchBar
                  placeholder={`Search ${userType === "driver" ? "Drivers" : "Clients"}...`}
                  onSearch={(value) => setSearchTerm(value)}
                />
              </div>

              {loading ? (
                <div className="text-center text-muted">Loading users...</div>
              ) : (
                <div className="user-table-container">
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>First Name</th>
                        <th>Last Name</th>
                        {userType === 'driver' ? (
                          <>
                            <th>Contact Number</th>
                            <th>Email</th>
                          </>
                        ) : (
                          <>
                            <th>Email</th>
                            <th>Company</th>
                          </>
                        )}
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id}>
                          <td>{user.first_name}</td>
                          <td>{user.last_name}</td>
                          {userType === 'driver' ? (
                            <>
                              <td>{user.cellphone_num}</td>
                              <td>{user.email}</td>
                            </>
                          ) : (
                            <>
                              <td>{user.email}</td>
                              <td>{user.company}</td>
                            </>
                          )}
                          <td className="text-center">
                            <button className="btn btn-sm btn-primary me-2" onClick={() => handleModalOpen(user, "edit")}>
                              <i className="bi bi-pencil-square"></i>
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleModalOpen(user, "delete")}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={userType === "driver" ? 5 : 6} className="text-center text-muted">
                            No {userType === "driver" ? "Drivers" : "Clients"} found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="alert alert-info">
              Please select a company to view and manage clients.
            </div>
          )}
        </section>
      </div>

      {/* Modal */}
      {showModal && selectedUser && (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-lg rounded-3">
              <div className="modal-header">
                <h5 className="modal-title">
                  {modalType === "add" ? `Add ${userType === "driver" ? "Driver" : "Client"}` :
                    modalType === "edit" ? "Edit User" : "Delete User"}
                </h5>
                <button type="button" className="btn-close" onClick={handleModalClose}></button>
              </div>

              <div className="modal-body">
                {errors.general && (
                  <div className="alert alert-danger">
                    {errors.general.join(' ')}
                  </div>
                )}

                {(modalType === "add" || modalType === "edit") && (
                  <form className="user-form">
                    <div className="mb-2">
                      <input
                        type="text"
                        value={selectedUser.first_name}
                        placeholder="First Name"
                        className="form-control"
                        onChange={(e) => setSelectedUser({ ...selectedUser, first_name: e.target.value })}
                      />
                      {errors.first_name && <small className="text-danger">{errors.first_name.join(' ')}</small>}
                    </div>

                    <div className="mb-2">
                      <input
                        type="text"
                        value={selectedUser.last_name}
                        placeholder="Last Name"
                        className="form-control"
                        onChange={(e) => setSelectedUser({ ...selectedUser, last_name: e.target.value })}
                      />
                      {errors.last_name && <small className="text-danger">{errors.last_name.join(' ')}</small>}
                    </div>

                    <div className="mb-2 position-relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={selectedUser.password || ""}
                        placeholder={modalType === "add" ? "Password (required)" : "Password (leave blank to keep)"}
                        className="form-control"
                        onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })}
                      />
                      <i
                        className={`bi position-absolute end-0 top-50 translate-middle-y me-3 ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowPassword(!showPassword)}
                      />
                      {errors.password && <small className="text-danger d-block">{errors.password.join(' ')}</small>}
                    </div>

                    {userType === "driver" ? (
                      <>
                        <div className="mb-2">
                          <input
                            type="text"
                            value={selectedUser.cellphone_num || ""}
                            placeholder="Contact Number"
                            className="form-control"
                            onChange={(e) => setSelectedUser({ ...selectedUser, cellphone_num: e.target.value })}
                          />
                          {errors.cellphone_num && <small className="text-danger">{errors.cellphone_num.join(' ')}</small>}
                        </div>

                        <div className="mb-2">
                          <input
                            type="email"
                            value={selectedUser.email || ""}
                            placeholder="Email Address"
                            className="form-control"
                            onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                          />
                          {errors.email && <small className="text-danger">{errors.email.join(' ')}</small>}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2">
                          <input
                            type="email"
                            value={selectedUser.email || ""}
                            placeholder="Email Address"
                            className="form-control"
                            onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                          />
                          {errors.email && <small className="text-danger">{errors.email.join(' ')}</small>}
                        </div>

                        <div className="mb-2">
                          <label className="form-label fw-bold">Company (Auto-assigned)</label>
                          <div className="alert alert-info mb-0">
                            {selectedCompany?.name || 'No company selected'}
                          </div>
                        </div>
                      </>
                    )}
                  </form>
                )}

                {modalType === "delete" && (
                  <p className="text-danger">
                    Are you sure you want to soft delete <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>? This action can be undone.
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleModalClose}>Cancel</button>

                {modalType === "delete" ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleConfirm}
                  >
                    Confirm Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`btn ${modalType === "add" ? "btn-success" : "btn-primary"}`}
                    onClick={handleConfirm}
                  >
                    {modalType === "add" ? "Add User" : "Save Changes"}
                  </button>
                )}

                {/* <button
                  type="button"
                  className={`btn ${modalType === "add" ? "btn-success" : modalType === "edit" ? "btn-primary" : "btn-danger"}`}
                  onClick={handleConfirm}
                >
                  {modalType === "add" ? "Add User" : modalType === "edit" ? "Save Changes" : "Confirm Delete"}
                </button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="modal fade show d-block" tabIndex="-1" role="dialog">
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-lg rounded-3">
              <div className="modal-header">
                <h5 className="modal-title">Bulk Import Clients</h5>
                <button type="button" className="btn-close" onClick={() => setShowImportModal(false)}></button>
              </div>

              <div className="modal-body">
                <p className="mb-3">
                  Upload a CSV file with columns: <strong>First Name, Last Name, Email, Password (Password must include at least one uppercase letter and one number.)</strong>
                </p>

                <div className="mb-3">
                  <a href="/clients_import_template.csv" download className="btn btn-sm btn-outline-secondary">
                    <i className="bi bi-download me-1"></i> Download Template
                  </a>
                </div>

                <div className="mb-3">
                  <label className="form-label">Company: <strong>{selectedCompany?.name}</strong></label>
                </div>

                <div className="mb-3">
                  <label className="form-label">CSV File</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    className="form-control"
                    onChange={(e) => setImportFile(e.target.files[0])}
                  />
                  <small className="text-muted">
                    Sample format: John,Doe,john@email.com,password123
                  </small>
                </div>

                {importProgress && (
                  <div className="mb-3">
                    <div className="progress mb-2">
                      <div
                        className="progress-bar bg-success"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      >
                        {importProgress.current} / {importProgress.total}
                      </div>
                    </div>
                    <small className="d-block text-success mb-2">
                      ✓ Success: {importProgress.results.success}
                    </small>
                    {importProgress.results.failed > 0 && (
                      <small className="d-block text-danger mb-2">
                        ✗ Failed: {importProgress.results.failed}
                      </small>
                    )}
                    {importProgress.results.errors.length > 0 && (
                      <div className="alert alert-warning small mb-0" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <strong>Errors:</strong>
                        <ul className="mb-0 mt-2">
                          {importProgress.results.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                  {importCompleted && importResults && (
                    <div className="mb-3">
                      <div className="alert alert-success">
                        Import finished — <strong>Success:</strong> {importResults.success} &nbsp; <strong>Failed:</strong> {importResults.failed}
                      </div>
                      {importResults.errors.length > 0 && (
                        <div className="alert alert-warning small mb-0" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <strong>Errors:</strong>
                          <ul className="mb-0 mt-2">
                            {importResults.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
              </div>

                <div className="modal-footer">
                  {!importCompleted ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowImportModal(false);
                          setImportFile(null);
                          setImportProgress(null);
                        }}
                        disabled={!!importProgress}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={handleBulkImport}
                        disabled={!importFile || !!importProgress}
                      >
                        {importProgress ? 'Importing...' : 'Import'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setShowImportModal(false);
                        setImportFile(null);
                        setImportProgress(null);
                        setImportResults(null);
                        setImportCompleted(false);
                      }}
                    >
                      Done
                    </button>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
