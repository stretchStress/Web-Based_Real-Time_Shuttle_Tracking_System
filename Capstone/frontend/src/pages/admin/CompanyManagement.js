import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import HeaderComponent from "./components/HeaderComponent";
import SearchBar from "./components/SearchBarComponent";
import "./styles/admin.css";
import api from "../../api/api";

const API_URL = `${api.defaults.baseURL}/api`;

function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [action, setAction] = useState("view");
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewStart, setRenewStart] = useState("");
  const [renewEnd, setRenewEnd] = useState("");
  const [renewErrors, setRenewErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState("");
  const [alertVariant, setAlertVariant] = useState("success");
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState({});

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
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await axiosAuth.get("/companies");
      setCompanies(res.data || []);
    } catch (err) {
      console.error("Fetch companies error:", err);
      setAlertMessage("Failed to fetch companies.");
      setAlertVariant("danger");
    }
  };

  const handleAdd = () => {
    setSelectedCompany({
      id: null,
      name: "",
      contact_email: "",
      contact_number: "",
      address: "",
      city: "",
      province: "",
      postal_code: "",
      contract_start: "",
      contract_end: "",
      status: "active",
    });
    setAction("edit");
    setShowModal(true);
    setErrors({});
  };

  const handleEdit = () => {
    if (!selectedCompany) return;

    // Only active companies can be edited. Inactive/terminated are view-only.
    if (String(selectedCompany.status).toLowerCase() !== "active") {
      setAlertMessage("Only active companies can be edited. Inactive companies can only be renewed.");
      setAlertVariant("warning");
      setTimeout(() => setAlertMessage(""), 4000);
      return;
    }

    setAction("edit");
    setErrors({});
  };

  const handleSave = async () => {
    if (!selectedCompany) return;

    // Client-side validation: contract_end must be >= contract_start
    if (selectedCompany.contract_start && selectedCompany.contract_end) {
      if (new Date(selectedCompany.contract_end) < new Date(selectedCompany.contract_start)) {
        setErrors({ contract_end: ['Contract end date must be after or equal to contract start date.'] });
        setAlertMessage("Validation failed. Please check the errors below.");
        setAlertVariant("danger");
        return;
      }
    }

    try {
      if (selectedCompany.id) {
        // Update existing
        const res = await axiosAuth.put(`/companies/${selectedCompany.id}`, selectedCompany);
        console.log('Update response:', res);
        // Refresh list from server to ensure UI matches DB
        await fetchCompanies();
        // update selected company from server response if available
        if (res?.data?.data) setSelectedCompany(res.data.data);
        setAlertMessage("Company updated successfully!");
        setAlertVariant("success");
      } else {
        // Create new
        const res = await axiosAuth.post("/companies", selectedCompany);
        console.log('Create response:', res);
        // Refresh list from server
        await fetchCompanies();
        if (res?.data?.data) setSelectedCompany(res.data.data);
        setAlertMessage("Company created successfully!");
        setAlertVariant("success");
      }
      setAction("view");
      setTimeout(() => setAlertMessage(""), 3000);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors || {});
        setAlertMessage("Validation failed. Please check the errors below.");
        setAlertVariant("danger");
      } else {
        setAlertMessage("Failed to save company.");
        setAlertVariant("danger");
      }
    }
  };

  // Open renew modal (replace prompt-based flow)
  const handleOpenRenew = () => {
    if (!selectedCompany || !selectedCompany.id) return;
    setRenewStart(selectedCompany.contract_start || "");
    setRenewEnd(selectedCompany.contract_end || "");
    setRenewErrors({});
    setShowRenewModal(true);
  };

  const handleCloseRenew = () => {
    setShowRenewModal(false);
    setRenewErrors({});
  };

  const submitRenew = async () => {
    if (!selectedCompany || !selectedCompany.id) return;

    // Client-side validation
    if (!renewStart || !renewEnd) {
      setRenewErrors({ general: ['Both start and end dates are required.'] });
      return;
    }
    if (new Date(renewEnd) < new Date(renewStart)) {
      setRenewErrors({ general: ['Contract end date must be after or equal to start date.'] });
      return;
    }

    try {
      const res = await axiosAuth.post(`/companies/${selectedCompany.id}/renew`, {
        contract_start: renewStart,
        contract_end: renewEnd,
      });

      setCompanies((prev) => prev.map((c) => (c.id === selectedCompany.id ? res.data.data : c)));
      setSelectedCompany(res.data.data);
      setAction("view");
      setAlertMessage("Contract renewed and company activated successfully!");
      setAlertVariant("success");
      setTimeout(() => setAlertMessage(""), 3000);
      handleCloseRenew();
    } catch (err) {
      if (err.response?.status === 422) {
        setRenewErrors(err.response.data.errors || {});
      } else {
        setAlertMessage("Failed to renew contract.");
        setAlertVariant("danger");
      }
    }
  };
  const handleDelete = () => {
    setModalAction("delete");
    setShowModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedCompany || !selectedCompany.id) return;

    try {
      await axiosAuth.delete(`/companies/${selectedCompany.id}`);
      setCompanies((prev) => prev.filter((c) => c.id !== selectedCompany.id));
      setAlertMessage("Company deleted successfully!");
      setAlertVariant("danger");
      setSelectedCompany(null);
      setShowModal(false);
      setModalAction(null);
      setTimeout(() => setAlertMessage(""), 3000);
    } catch (err) {
      console.error("Delete error:", err);
      setAlertMessage("Failed to delete company.");
      setAlertVariant("danger");
    }
  };

  const filteredCompanies = companies.filter((company) =>
    `${company.name} ${company.contact_email} ${company.city}`.toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-container">
      <HeaderComponent />

      <div className="admin-main">
        <section className="crud-form-area">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <SearchBar 
              placeholder="Search by company name, email, or city..." 
              onSearch={setSearchTerm}
            />
            <Button variant="success" onClick={handleAdd}>
              <i className="bi bi-plus-circle me-2"></i> Add Company
            </Button>
          </div>

          {alertMessage && (
            <Alert variant={alertVariant} className="mt-2">
              {alertMessage}
            </Alert>
          )}

          <div className="table-responsive mt-3">
            <table className="table table-striped table-hover">
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>Contact Email</th>
                  <th>Contact Number</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Contract Period</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{company.contact_email || "—"}</td>
                    <td>{company.contact_number || "—"}</td>
                    <td>{company.city || "—"}</td>
                    <td>
                      <span
                        className={`badge bg-${
                          company.status === "active"
                            ? "success"
                            : company.status === "inactive"
                            ? "warning"
                            : "danger"
                        }`}
                      >
                        {company.status}
                      </span>
                    </td>
                    <td>
                      {company.contract_start && company.contract_end
                        ? `${company.contract_start} to ${company.contract_end}`
                        : "—"}
                    </td>
                    <td>
                      {/* View is always available */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedCompany(company);
                          setShowModal(true);
                          setAction("view");
                          setErrors({});
                        }}
                      >
                        <i className="bi bi-eye"></i>
                      </Button>

                      {/* Edit only visible for active companies */}
                      {company.status === "active" && (
                        <Button
                          variant="warning"
                          size="sm"
                          className="ms-1"
                          onClick={() => {
                            setSelectedCompany(company);
                            handleEdit();
                            setShowModal(true);
                          }}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                      )}

                      {/* Delete always available */}
                      <Button
                        variant="danger"
                        size="sm"
                        className="ms-1"
                        onClick={() => {
                          setSelectedCompany(company);
                          handleDelete();
                        }}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCompanies.length === 0 && (
              <p className="text-center text-muted mt-3">No companies found.</p>
            )}
          </div>
        </section>
      </div>

      {/* Details Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {action === "edit"
              ? selectedCompany?.id
                ? "Edit Company"
                : "Add Company"
              : "Company Details"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedCompany && (
            <>
              {Object.keys(errors).length > 0 && (
                <Alert variant="danger" className="mb-3">
                  <Alert.Heading>Validation Errors</Alert.Heading>
                  <ul className="mb-0">
                    {Object.entries(errors).map(([field, msgs]) => (
                      <li key={field}>{msgs.join(", ")}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              {action === "view" ? (
                <>
                  <h5>{selectedCompany.name}</h5>
                  <p>
                    <strong>Email:</strong> {selectedCompany.contact_email || "—"}
                  </p>
                  <p>
                    <strong>Phone:</strong> {selectedCompany.contact_number || "—"}
                  </p>
                  <p>
                    <strong>Address:</strong> {selectedCompany.address || "—"}
                  </p>
                  <p>
                    <strong>City:</strong> {selectedCompany.city || "—"} |{" "}
                    <strong>Province:</strong> {selectedCompany.province || "—"} |{" "}
                    <strong>Postal Code:</strong> {selectedCompany.postal_code || "—"}
                  </p>
                  <p>
                    <strong>Contract Start:</strong> {selectedCompany.contract_start || "—"}
                  </p>
                  <p>
                    <strong>Contract End:</strong> {selectedCompany.contract_end || "—"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      className={`badge bg-${
                        selectedCompany.status === "active"
                          ? "success"
                          : selectedCompany.status === "inactive"
                          ? "warning"
                          : "danger"
                      }`}
                    >
                      {selectedCompany.status}
                    </span>
                  </p>
                </>
              ) : (
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedCompany.name}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, name: e.target.value })
                      }
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Contact Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={selectedCompany.contact_email}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, contact_email: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Contact Number</Form.Label>
                    <Form.Control
                      type="tel"
                      value={selectedCompany.contact_number}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, contact_number: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Address</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedCompany.address}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, address: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>City</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedCompany.city}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, city: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Province</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedCompany.province}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, province: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Postal Code</Form.Label>
                    <Form.Control
                      type="text"
                      value={selectedCompany.postal_code}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, postal_code: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Contract Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={selectedCompany.contract_start}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, contract_start: e.target.value })
                      }
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Contract End Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={selectedCompany.contract_end}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, contract_end: e.target.value })
                      }
                      isInvalid={!!errors.contract_end}
                    />
                    {errors.contract_end && (
                      <Form.Control.Feedback type="invalid" className="d-block">
                        {errors.contract_end.join(", ")}
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      value={selectedCompany.status}
                      onChange={(e) =>
                        setSelectedCompany({ ...selectedCompany, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
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
              <Button variant="success" onClick={handleSave} className="w-100">
                <i className="bi bi-check-circle me-2"></i> Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAction("view");
                  setErrors({});
                }}
                className="w-100"
              >
                <i className="bi bi-x-circle me-2"></i> Cancel
              </Button>
            </>
          ) : (
            <>
              {/* Active companies: editable, no renew button */}
              {selectedCompany?.status === "active" && (
                <Button variant="primary" onClick={handleEdit} className="w-100">
                  <i className="bi bi-pencil-square me-2"></i> Edit
                </Button>
              )}

              {/* Inactive companies: view-only but contract can be renewed */}
              {selectedCompany?.status === "inactive" && (
                <Button variant="info" onClick={handleOpenRenew} className="w-100">
                  <i className="bi bi-arrow-repeat me-2"></i> Renew Contract
                </Button>
              )}

              {/* Terminated companies: view-only, cannot be renewed; still deletable */}
              <Button variant="danger" onClick={handleDelete} className="w-100">
                <i className="bi bi-trash me-2"></i> Delete
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      {/* Renew Contract Modal */}
      <Modal show={showRenewModal} onHide={handleCloseRenew} centered>
        <Modal.Header closeButton>
          <Modal.Title>Renew Contract for {selectedCompany?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {renewErrors.general && (
            <Alert variant="danger">{renewErrors.general.join ? renewErrors.general.join(', ') : renewErrors.general}</Alert>
          )}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Contract Start Date</Form.Label>
              <Form.Control type="date" value={renewStart} onChange={(e) => setRenewStart(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contract End Date</Form.Label>
              <Form.Control type="date" value={renewEnd} onChange={(e) => setRenewEnd(e.target.value)} isInvalid={!!renewErrors.contract_end} />
              {renewErrors.contract_end && (
                <Form.Control.Feedback type="invalid" className="d-block">
                  {renewErrors.contract_end.join(', ')}
                </Form.Control.Feedback>
              )}
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseRenew}>Cancel</Button>
          <Button variant="success" onClick={submitRenew}>Renew</Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
  <Modal show={modalAction === "delete" && showModal} onHide={() => { setShowModal(false); setModalAction(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete <strong>{selectedCompany?.name}</strong>? This action cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowModal(false); setModalAction(null); }}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default CompanyManagement;
