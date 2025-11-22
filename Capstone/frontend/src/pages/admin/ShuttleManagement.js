import React, { useEffect, useState } from 'react';
import HeaderComponent from './components/HeaderComponent';
import SearchBar from './components/SearchBarComponent';
import ShuttleMapComponent from './components/ShuttleMapComponent';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { Modal, Button, Form } from 'react-bootstrap';
import './styles/admin.css';
import './styles/shuttleStyle.css';
import axios from "axios";
// import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import GoogleMap from './components/GoogleMapComponent';
import api from '../../api/api';


const ShuttleManagement = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shuttles, setShuttles] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [action, setAction] = useState('');
  const [selectedShuttle, setSelectedShuttle] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trafficAnalysis, setTrafficAnalysis] = useState(null);

  const API_URL = `${api.defaults.baseURL}/api`;
  const token = localStorage.getItem("authToken");

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  // Fetch shuttles
  const fetchShuttles = async () => {
    try {
      const res = await axiosAuth.get('/shuttles');
      setShuttles(res.data || []);
    } catch (err) {
      console.error("Failed to fetch shuttles:", err);
    }
  };

  // Fetch maintenance records to check which shuttles are under maintenance
  const fetchMaintenanceRecords = async () => {
    try {
      const res = await axiosAuth.get('/maintenance');
      setMaintenanceRecords(res.data || []);
    } catch (err) {
      console.error("Failed to fetch maintenance records:", err);
    }
  };

  useEffect(() => {
    fetchShuttles();
    fetchMaintenanceRecords();
  }, []);

  // Periodically refresh shuttles so driver/route reflect the current schedule
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchShuttles();
    }, 60000); // refresh every 60 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Check if shuttle is under maintenance
  const isShuttleUnderMaintenance = (shuttleId) => {
    return maintenanceRecords.some(
      record => record.shuttle_id === shuttleId && record.status === 'Under Maintenance'
    );
  };

  const filteredShuttles = shuttles.filter(shuttle =>
    shuttle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shuttle.plate.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      model: e.target.model.value,
      capacity: e.target.capacity.value,
      plate: e.target.plate.value,
      status: e.target.status.value,
    };

    try {
      if (action === 'edit' && selectedShuttle) {
        await axiosAuth.put(`/shuttles/${selectedShuttle.id}`, payload);
      } else {
        await axiosAuth.post('/shuttles', payload);
      }
      fetchShuttles();
      setAction('');
      setSelectedShuttle(null);
    } catch (err) {
      console.error("Failed to submit shuttle:", err);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await axiosAuth.delete(`/shuttles/${selectedShuttle.id}`);
      fetchShuttles();
      setAction('');
      setSelectedShuttle(null);
    } catch (err) {
      console.error("Failed to delete shuttle:", err);
    }
  };

  const handleConfirmBackup = () => {
    alert(`Backup created for ${selectedShuttle.model}`);
    setAction('');
    setSelectedShuttle(null);
  };

  // Analyze traffic conditions for selected shuttle
  const analyzeTraffic = () => {
    if (!selectedShuttle || !selectedShuttle.route) return;

    // Simulated traffic analysis based on time of day
    const now = new Date();
    const hour = now.getHours();
    
    let congestionLevel = 'Light';
    let avgDelay = 5;
    let recommendation = 'Optimal conditions';

    // Peak hours: 7-9 AM, 5-7 PM
    if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
      congestionLevel = 'Heavy';
      avgDelay = 25;
      recommendation = 'Consider alternative routes or timing adjustments';
    } else if ((hour >= 9 && hour < 11) || (hour >= 14 && hour < 17)) {
      congestionLevel = 'Moderate';
      avgDelay = 12;
      recommendation = 'Monitor route conditions periodically';
    }

    setTrafficAnalysis({
      routeName: selectedShuttle.route.name,
      congestionLevel,
      avgDelay,
      recommendation,
      timestamp: now.toLocaleTimeString(),
      activeShuttles: shuttles.filter(s => s.route?.id === selectedShuttle.route.id).length,
    });
  };

  // Trigger traffic analysis when modal opens
  useEffect(() => {
    if (action === 'view' && selectedShuttle) {
      analyzeTraffic();
    }
  }, [action, selectedShuttle]);

  return (
    <div className="admin-container">
      <HeaderComponent />
      <div className="admin-main shuttle-management">
        <section className="crud-form-area">
          <div className="search-add-row">
            <SearchBar placeholder="Search by model or plate number..." onSearch={setSearchQuery} />
            <button
              className="add-btn"
              onClick={() => { setAction('add'); setSelectedShuttle(null); }}
            >
              <i className="bi bi-plus-circle"></i> Add Shuttle
            </button>
          </div>

          <div className="shuttle-table-container">
            <table className="shuttle-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Capacity</th>
                  <th>Plate</th>
                  <th>Status</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShuttles.map(shuttle => (
                  <tr
                    key={shuttle.id}
                    onClick={() => { 
                      if (!isShuttleUnderMaintenance(shuttle.id)) {
                        setSelectedShuttle(shuttle); 
                        setAction('view');
                      }
                    }}
                    className={`${selectedShuttle?.id === shuttle.id ? 'selected' : ''} ${isShuttleUnderMaintenance(shuttle.id) ? 'maintenance-disabled' : ''}`}
                    style={{
                      opacity: isShuttleUnderMaintenance(shuttle.id) ? 0.6 : 1,
                      cursor: isShuttleUnderMaintenance(shuttle.id) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <td>
                      {shuttle.model}
                    </td>
                    <td>{shuttle.capacity}</td>
                    <td>{shuttle.plate}</td>
                    <td>
                      {isShuttleUnderMaintenance(shuttle.id) ? (
                        <span className="badge bg-warning text-dark">
                          <i className="bi bi-tools"></i> Under Maintenance
                        </span>
                      ) : (
                        <span className={`badge ${shuttle.status === 'Active' ? 'bg-success' : shuttle.status === 'Maintenance' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                          {shuttle.status}
                        </span>
                      )}
                    </td>
                    <td>{shuttle.driver ? `${shuttle.driver.first_name} ${shuttle.driver.last_name}` : 'Unassigned'}</td>
                    <td>{shuttle.route ? shuttle.route.name : 'No Route'}</td>
                    <td className="table-actions" onClick={e => e.stopPropagation()}>
                      <button 
                        className="action-btn edit" 
                        onClick={() => { 
                          if (!isShuttleUnderMaintenance(shuttle.id)) {
                            setSelectedShuttle(shuttle); 
                            setAction('edit');
                          }
                        }} 
                        title={isShuttleUnderMaintenance(shuttle.id) ? "Cannot edit - Under Maintenance" : "Edit"}
                        disabled={isShuttleUnderMaintenance(shuttle.id)}
                        style={{ opacity: isShuttleUnderMaintenance(shuttle.id) ? 0.5 : 1 }}
                      >
                        <i className="bi bi-pencil-square"></i>
                      </button>
                      <button 
                        className="action-btn delete" 
                        onClick={() => { 
                          if (!isShuttleUnderMaintenance(shuttle.id)) {
                            setSelectedShuttle(shuttle); 
                            setAction('delete');
                          }
                        }} 
                        title={isShuttleUnderMaintenance(shuttle.id) ? "Cannot delete - Under Maintenance" : "Delete"}
                        disabled={isShuttleUnderMaintenance(shuttle.id)}
                        style={{ opacity: isShuttleUnderMaintenance(shuttle.id) ? 0.5 : 1 }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add/Edit Modal */}
      <Modal show={action === 'add' || action === 'edit'} onHide={() => setAction('')}>
        <Modal.Header closeButton>
          <Modal.Title>{action === 'edit' ? 'Edit Shuttle' : 'Add Shuttle'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Shuttle Model</Form.Label>
              <Form.Control type="text" name="model" defaultValue={selectedShuttle?.model || ''} required />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Capacity</Form.Label>
              <Form.Control type="number" name="capacity" defaultValue={selectedShuttle?.capacity || 50} disabled />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Plate Number</Form.Label>
              <Form.Control type="text" name="plate" defaultValue={selectedShuttle?.plate || ''} required />
            </Form.Group>

            <div className="mb-3">
              <p className="text-muted small">
                <strong>Note:</strong> Driver and Route assignments are managed through the Schedule Management page.
              </p>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select 
                name="status" 
                defaultValue={selectedShuttle?.status === 'Maintenance' ? 'Active' : selectedShuttle?.status || 'Active'}
                disabled={selectedShuttle?.status === 'Maintenance'}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive (Reserve)</option>
              </Form.Select>
              {selectedShuttle?.status === 'Maintenance' && (
                <Form.Text className="text-warning">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  This shuttle is under maintenance. Status can only be changed in Maintenance Management.
                </Form.Text>
              )}
            </Form.Group>

            <Button variant="success" type="submit">{action === 'edit' ? 'Update Shuttle' : 'Add Shuttle'}</Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Delete Modal */}
      <Modal show={action === 'delete'} onHide={() => setAction('')}>
        <Modal.Header closeButton><Modal.Title>Confirm Delete</Modal.Title></Modal.Header>
        <Modal.Body>Are you sure you want to soft delete <strong>{selectedShuttle?.model}</strong>?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAction('')}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Backup Modal */}
      <Modal show={action === 'backup'} onHide={() => setAction('')}>
        <Modal.Header closeButton><Modal.Title>Confirm Backup</Modal.Title></Modal.Header>
        <Modal.Body>Do you want to create a backup for <strong>{selectedShuttle?.model}</strong>?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAction('')}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirmBackup}>Confirm</Button>
        </Modal.Footer>
      </Modal>

      {/* Live Tracking Modal */}
      <Modal 
        show={action === 'view'} 
        onHide={() => setAction('')} 
        fullscreen={isFullscreen ? true : "sm-down"} 
        size="xl"
        centered
        dialogClassName="map-modal"
        id="shuttleTrackingMapModal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{selectedShuttle?.model} - Live Tracking</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ marginBottom: "15px" }}>
            <p><strong>Shuttle ID:</strong> {selectedShuttle?.id}</p>
            <p><strong>Plate Number:</strong> {selectedShuttle?.plate}</p>
            {selectedShuttle?.route && <p><strong>Route:</strong> {selectedShuttle.route.name}</p>}
          </div>

          {/* Traffic Analysis Panel */}
          {trafficAnalysis && (
            <div style={{
              marginBottom: '15px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              borderLeft: `4px solid ${
                trafficAnalysis.congestionLevel === 'Heavy' ? '#dc3545' :
                trafficAnalysis.congestionLevel === 'Moderate' ? '#ffc107' :
                '#28a745'
              }`,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6c757d' }}>
                    <strong>Congestion Level</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                    <i className={`bi bi-${
                      trafficAnalysis.congestionLevel === 'Heavy' ? 'exclamation-triangle-fill text-danger' :
                      trafficAnalysis.congestionLevel === 'Moderate' ? 'exclamation-circle-fill text-warning' :
                      'check-circle-fill text-success'
                    }`}></i>
                    {' '}{trafficAnalysis.congestionLevel}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6c757d' }}>
                    <strong>Avg. Delay</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                    {trafficAnalysis.avgDelay} min
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6c757d' }}>
                    <strong>Active on Route</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                    {trafficAnalysis.activeShuttles} shuttle(s)
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6c757d' }}>
                    <strong>Updated</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: '12px' }}>
                    {trafficAnalysis.timestamp}
                  </p>
                </div>
              </div>
              <div style={{ marginTop: '10px', padding: '8px', backgroundColor: 'white', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#495057' }}>
                  <strong>Recommendation:</strong> {trafficAnalysis.recommendation}
                </p>
              </div>
            </div>
          )}

          {selectedShuttle?.status === 'Active' ? (
            <div className="map-wrapper">
              <button 
                className="map-maximize-btn"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <i className="bi bi-arrows-angle-contract"></i> : <i className="bi bi-arrows-angle-expand"></i>}
              </button>
              <GoogleMap
                shuttleId={selectedShuttle?.id}
                zoom={14}
              />
            </div>
          ) : (
            <p className="text-muted">This shuttle is not active for tracking.</p>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default ShuttleManagement;
