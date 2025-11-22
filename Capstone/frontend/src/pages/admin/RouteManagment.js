import React, { useState, useEffect } from "react";
import axios from "axios";
import HeaderComponent from "./components/HeaderComponent";
import SearchBar from "./components/SearchBarComponent";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/admin.css";
import "./styles/routeStyle.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import GoogleMap from './components/GoogleMapComponent';
import RouteSetupMapComponent from "./components/RouteSetupMapComponent";
import api from "../../api/api";

const RouteManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRoute, setEditRoute] = useState(null);
  const [editRouteData, setEditRouteData] = useState({
    embarked: null,
    embarkedAddress: "",
    disembarked: null,
    disembarkedAddress: "",
    pickups: [],
  });
  const [actionType, setActionType] = useState(null);
  // const handleBackup = () => {
  // };
  const [newRoute, setNewRoute] = useState({
    company_id: "",
    company: "",
    name: "",
    embarked: "",
    pickupPoints: "",
    pickupPointsTime: "",
    disembarked: "",
    direction: "Incoming",
    status: "Active",
  });

  const [routeData, setRouteData] = useState({
    embarked: null,
    embarkedAddress: "",
    disembarked: null,
    disembarkedAddress: "",
    pickups: [],
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [routeToConfirm, setRouteToConfirm] = useState(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchRoutes();
    }
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await api.get("/api/companies", {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    } catch (error) {
      console.error("Error fetching companies:", error.response?.data || error.message);
    }
  };

  const fetchRoutes = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await api.get("/api/routes", {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter routes by selected company (by company_id if available, else by company name)
      const filtered = res.data.filter(route => {
        if (selectedCompany.id && route.company_id) {
          return route.company_id === selectedCompany.id;
        }
        // Fallback to company name match for backward compatibility
        return route.company === selectedCompany.name;
      });
      setRoutes(filtered);
    } catch (error) {
      console.error("Error fetching routes:", error);
    }
  };

  const handleEditClick = (route) => {
    setEditRoute(route);
    
    // Initialize routeData from existing route
    const pickups = [];
    if (route.pickup_coords && route.pickup_points) {
      const coords = typeof route.pickup_coords === 'string' 
        ? JSON.parse(route.pickup_coords) 
        : route.pickup_coords;
      const points = Array.isArray(route.pickup_points) ? route.pickup_points : [];
      const times = Array.isArray(route.pickup_times) ? route.pickup_times : [];
      
      coords.forEach((coord, index) => {
        pickups.push({
          lat: parseFloat(coord.lat),
          lng: parseFloat(coord.lng),
          name: points[index] || `Pickup ${index + 1}`,
          time: times[index] || "",
          address: `${coord.lat.toFixed(6)}, ${coord.lng.toFixed(6)}`,
        });
      });
    }

    setEditRouteData({
      embarked: route.embarked_lat && route.embarked_lng 
        ? { lat: parseFloat(route.embarked_lat), lng: parseFloat(route.embarked_lng) }
        : null,
      embarkedAddress: route.embarked || "",
      disembarked: route.disembarked_lat && route.disembarked_lng
        ? { lat: parseFloat(route.disembarked_lat), lng: parseFloat(route.disembarked_lng) }
        : null,
      disembarkedAddress: route.disembarked || "",
      pickups: pickups,
    });
    
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      // Prepare pickup points and times from editRouteData
      const pickupPoints = editRouteData.pickups.map((p) => p.name);
      const pickupTimes = editRouteData.pickups.map((p) => p.time);
      const pickupCoords = editRouteData.pickups.map((p) => ({
        lat: p.lat,
        lng: p.lng,
      }));

      const payload = {
        company_id: selectedCompany.id,
        company: selectedCompany.name,
        name: editRoute.name,
        direction: editRoute.direction,
        status: editRoute.status,
        embarked: editRouteData.embarkedAddress || editRoute.embarked,
        embarked_lat: editRouteData.embarked?.lat || null,
        embarked_lng: editRouteData.embarked?.lng || null,
        disembarked: editRouteData.disembarkedAddress || editRoute.disembarked,
        disembarked_lat: editRouteData.disembarked?.lat || null,
        disembarked_lng: editRouteData.disembarked?.lng || null,
        pickup_points: pickupPoints,
        pickup_times: pickupTimes,
        pickup_coords: pickupCoords,
      };

      await api.put(
        `/api/routes/${editRoute.id}`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );

      fetchRoutes();
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating route:", error.response?.data || error.message);
      alert("Error updating route: " + (error.response?.data?.message || error.message));
    }
  };


  const handleDelete = async () => {
    try {
      await api.delete(
        `/api/routes/${routeToConfirm.id}`,
        { headers: { "Content-Type": "application/json" } }
      );

      setShowDeleteModal(false);
      fetchRoutes();
    } catch (error) {
      console.error("Error deleting route:", error.response?.data || error.message);
    }
  };

  const handleAddRoute = async () => {
    try {
      // Prepare pickup points and times from routeData
      const pickupPoints = routeData.pickups.map((p) => p.name);
      const pickupTimes = routeData.pickups.map((p) => p.time);
      const pickupCoords = routeData.pickups.map((p) => ({
        lat: p.lat,
        lng: p.lng,
      }));

      const payload = {
        company_id: selectedCompany.id,
        company: selectedCompany.name,
        name: newRoute.name,
        direction: newRoute.direction,
        status: newRoute.status,
        embarked: routeData.embarkedAddress || newRoute.embarked,
        embarked_lat: routeData.embarked?.lat || null,
        embarked_lng: routeData.embarked?.lng || null,
        disembarked: routeData.disembarkedAddress || newRoute.disembarked,
        disembarked_lat: routeData.disembarked?.lat || null,
        disembarked_lng: routeData.disembarked?.lng || null,
        pickup_points: pickupPoints,
        pickup_times: pickupTimes,
        pickup_coords: pickupCoords,
      };

      await api.post("/api/routes", payload);
      setShowAddModal(false);
      setNewRoute({
        company_id: selectedCompany.id,
        company: "",
        name: "",
        embarked: "",
        pickupPoints: "",
        pickupPointsTime: "",
        disembarked: "",
        direction: "Incoming",
        status: "Active",
      });
      setRouteData({
        embarked: null,
        embarkedAddress: "",
        disembarked: null,
        disembarkedAddress: "",
        pickups: [],
      });
      fetchRoutes();
    } catch (error) {
      console.error("Error adding route:", error);
      alert("Error adding route: " + (error.response?.data?.message || error.message));
    }
  };

  const filteredRoutes = routes.filter(
    (route) =>
      route.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const RouteMap = ({ embarked, disembarked, pickupPoints }) => {
  const embarkedCoords = [14.5995, 120.9842]; 
  const disembarkedCoords = [14.6760, 121.0437];

  const pickupCoords = pickupPoints.map((p, i) => ({
      name: p,
      coords: [14.60 + i * 0.01, 120.98 + i * 0.01],
    }));

    return (
      <MapContainer
        center={embarkedCoords}
        zoom={13}
        style={{ height: "300px", width: "100%", marginTop: "1rem" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={embarkedCoords}>
          <Popup>Embarked: {embarked}</Popup>
        </Marker>
        <Marker position={disembarkedCoords}>
          <Popup>Disembarked: {disembarked}</Popup>
        </Marker>
        {pickupCoords.map((p, i) => (
          <Marker key={i} position={p.coords}>
            <Popup>Pickup: {p.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    );
  };

  return (
    <div className="admin-container">
      <HeaderComponent />
      <div className="admin-main">
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
          <SearchBar
            placeholder="Search by route name..."
            onSearch={setSearchQuery}
          />
          <button
            className="btn btn-success"
            onClick={() => setShowAddModal(true)}
            disabled={!selectedCompany}
          >
            <i className="bi bi-plus-circle me-2"></i> Add Route
          </button>
        </div>

        {/* Add Route Modal */}
        {showAddModal && (
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-xl modal-dialog-centered d-flex justify-content-center">
              <div className="modal-content">
                <div className="modal-header text-black">
                  <h5 className="modal-title">
                    <i className="bi bi-plus-circle"></i> Add New Route
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowAddModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form>
                    <div className="mb-3">
                      <label className="form-label">Route Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newRoute.name}
                        onChange={(e) =>
                          setNewRoute({ ...newRoute, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Company (Auto-assigned)</label>
                      <div className="alert alert-info mb-0">
                        {selectedCompany?.name || 'No company selected'}
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Direction</label>
                      <select
                        className="form-select"
                        value={newRoute.direction}
                        onChange={(e) =>
                          setNewRoute({ ...newRoute, direction: e.target.value })
                        }
                      >
                        <option value="Incoming">Incoming</option>
                        <option value="Outgoing">Outgoing</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Route Setup Map</strong>
                        <br />
                        <small className="text-muted">
                          Use the buttons below the map to set embarked, pickup points, and disembarked locations by clicking on the map.
                        </small>
                      </label>
                      <RouteSetupMapComponent
                        routeData={routeData}
                        setRouteData={setRouteData}
                        editable={true}
                        direction={newRoute.direction}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Embarked (Auto-filled from map)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={routeData.embarkedAddress || newRoute.embarked}
                        onChange={(e) =>
                          setNewRoute({ ...newRoute, embarked: e.target.value })
                        }
                        placeholder="Will be auto-filled when you set embarked on map"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Disembarked (Auto-filled from map)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={routeData.disembarkedAddress || newRoute.disembarked}
                        onChange={(e) =>
                          setNewRoute({
                            ...newRoute,
                            disembarked: e.target.value,
                          })
                        }
                        placeholder="Will be auto-filled when you set disembarked on map"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={newRoute.status}
                        onChange={(e) =>
                          setNewRoute({ ...newRoute, status: e.target.value })
                        }
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleAddRoute}
                    disabled={!routeData.embarked || !routeData.disembarked}
                  >
                    Add Route
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Routes Table */}
        <table className="route-table table table-hover">
          <thead className="route-table table-orange text-white">
            <tr>
              <th>Route</th>
              <th>Direction</th>
              <th style={{ width: "290px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoutes.map((route) => (
              <tr
                key={route.id}
                onClick={() => setSelectedRoute(route)}
                style={{ cursor: "pointer" }}
              >
                <td>{route.name}</td>
                <td>{route.direction}</td>
                <td>
                  <button
                    className="btn btn-sm btn-primary me-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(route);
                    }}
                  >
                    <i className="bi bi-pencil-square"></i>
                  </button>
                  {/* <button
                    className="btn btn-sm btn-success me-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRouteToConfirm(route);
                      setShowBackupModal(true);
                      setActionType("backup");
                    }}
                  >
                    <i className="bi bi-cloud-arrow-down"></i>
                  </button> */}
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRouteToConfirm(route);
                      setShowDeleteModal(true);
                      setActionType("delete");
                    }}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
            {filteredRoutes.length === 0 && (
              <tr>
                <td colSpan="3" className="text-center text-muted">
                  No routes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Route Details Modal */}
        {selectedRoute && (
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header text-black">
                  <h5 className="modal-title">
                    <i className="bi bi-info-circle"></i> Route Details
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedRoute(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <h5 className="fw-bold">{selectedRoute.name}</h5>
                  <p>
                    <strong>Company:</strong> {selectedRoute.company}
                  </p>
                  <p>
                    <strong>Direction:</strong>{selectedRoute.direction}
                  </p>
                  <p>
                    <strong>Embarked:</strong> {selectedRoute.embarked}
                  </p>
                  <p>
                    <strong>{selectedRoute.direction === "Incoming" ? "Pickup Points & Times" : "Drop Off Points & Times"}:</strong><br />
                    {Array.isArray(selectedRoute.pickup_points)
                      ? selectedRoute.pickup_points.map((p, i) => (
                          <div key={i}>
                            {p}{" "}
                            {selectedRoute.pickup_times?.[i]
                              ? `- ${selectedRoute.pickup_times[i]}`
                              : ""}
                          </div>
                        ))
                      : "No data"}
                  </p>
                  <p>
                    <strong>Disembarked:</strong> {selectedRoute.disembarked}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`badge ${
                        selectedRoute.status === "Active"
                          ? "bg-success"
                          : "bg-secondary"
                      }`}
                    >
                      {selectedRoute.status}
                    </span>
                  </p>

                  {/* Map */}
                  <div
                    className="map-placeholder border rounded overflow-hidden"
                    style={{ height: "400px" }}
                  >
                    {selectedRoute && (
                      <RouteSetupMapComponent
                        routeData={{
                          embarked: selectedRoute.embarked_lat && selectedRoute.embarked_lng
                            ? {
                                lat: Number(selectedRoute.embarked_lat),
                                lng: Number(selectedRoute.embarked_lng),
                              }
                            : null,
                          embarkedAddress: selectedRoute.embarked || "",
                          disembarked: selectedRoute.disembarked_lat && selectedRoute.disembarked_lng
                            ? {
                                lat: Number(selectedRoute.disembarked_lat),
                                lng: Number(selectedRoute.disembarked_lng),
                              }
                            : null,
                          disembarkedAddress: selectedRoute.disembarked || "",
                          pickups: (() => {
                            try {
                              const coords = typeof selectedRoute.pickup_coords === "string"
                                ? JSON.parse(selectedRoute.pickup_coords)
                                : Array.isArray(selectedRoute.pickup_coords)
                                ? selectedRoute.pickup_coords
                                : [];
                              
                              const points = Array.isArray(selectedRoute.pickup_points)
                                ? selectedRoute.pickup_points
                                : [];
                              
                              const times = Array.isArray(selectedRoute.pickup_times)
                                ? selectedRoute.pickup_times
                                : [];

                              return coords.map((p, index) => ({
                                lat: Number(p.lat),
                                lng: Number(p.lng),
                                name: points[index] || `Pickup ${index + 1}`,
                                time: times[index] || "",
                                address: "",
                              }));
                            } catch {
                              return [];
                            }
                          })(),
                        }}
                        editable={false}
                        direction={selectedRoute.direction}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Route Modal */}
        {showEditModal && (
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-xl modal-dialog-centered d-flex justify-content-center">
              <div className="modal-content">
                <div className="modal-header text-black">
                  <h5 className="modal-title">
                    <i className="bi bi-pencil-square"></i> Edit Route
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowEditModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form>
                    <div className="mb-3">
                      <label className="form-label">Route Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editRoute.name}
                        onChange={(e) =>
                          setEditRoute({ ...editRoute, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Company</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editRoute.company}
                        onChange={(e) =>
                          setEditRoute({
                            ...editRoute,
                            company: e.target.value,
                          })
                        }
                      />  
                    </div>
                     <div className="mb-3">
                      <label className="form-label">Direction</label>
                      <select
                        className="form-select"
                        value={editRoute.direction}
                        onChange={(e) =>
                          setEditRoute({ ...editRoute, direction: e.target.value })
                        }
                      >
                        <option value="Incoming">Incoming</option>
                        <option value="Outgoing">Outgoing</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label">
                        <strong>Route Setup Map</strong>
                        <br />
                        <small className="text-muted">
                          Use the buttons below the map to set or update embarked, pickup points, and disembarked locations by clicking on the map.
                        </small>
                      </label>
                      <RouteSetupMapComponent
                        routeData={editRouteData}
                        setRouteData={setEditRouteData}
                        editable={true}
                        direction={editRoute.direction}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Embarked (Auto-filled from map)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editRouteData.embarkedAddress || editRoute.embarked}
                        onChange={(e) =>
                          setEditRoute({ ...editRoute, embarked: e.target.value })
                        }
                        placeholder="Will be auto-filled when you set embarked on map"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Disembarked (Auto-filled from map)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editRouteData.disembarkedAddress || editRoute.disembarked}
                        onChange={(e) =>
                          setEditRoute({ ...editRoute, disembarked: e.target.value })
                        }
                        placeholder="Will be auto-filled when you set disembarked on map"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Status</label>
                      <select
                        className="form-select"
                        value={editRoute.status}
                        onChange={(e) =>
                          setEditRoute({ ...editRoute, status: e.target.value })
                        }
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </form>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveEdit}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && routeToConfirm && (
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-sm modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header text-black">
                  <h5 className="modal-title">Confirm Delete</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowDeleteModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  Are you sure you want to soft delete{" "}
                  <strong>{routeToConfirm.name}</strong>? This action can be undone.
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleDelete}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteManagement;