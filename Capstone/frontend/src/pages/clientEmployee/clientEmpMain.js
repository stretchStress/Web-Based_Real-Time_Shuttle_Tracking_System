import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TrackPage from './TrackPage';
import PickupPage from './PickupPage';

const ClientEmployeeMain = () => {
  return (
    <Routes>
      <Route index element={<Navigate to="pickup" replace />} />
      {/* <Route path="track" element={<TrackPage />} />
      <Route path="pickup" element={<PickupPage />} /> */}
    </Routes>
  );
};

export default ClientEmployeeMain;
