import React, { useState } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Dashboard from './Dashboard';
import ReportPage from './ReportPage';

const DriverMain = () => {
  // Keep track of the driver’s current duty status
  const [driverStatus, setDriverStatus] = useState('off-duty');

  // Function to toggle status (used by Dashboard)
  const toggleStatus = (status) => {
    console.log('Driver status changed to:', status);
    setDriverStatus(status);
  };

  return (
    <div>
      <Routes>
        <Route
          index
          element={
            <Dashboard
              driverStatus={driverStatus}
              toggleStatus={toggleStatus}
            />
          }
        />
        <Route path="report" element={<ReportPage />} />
      </Routes>
      <Outlet />
    </div>
  );
};

export default DriverMain;
