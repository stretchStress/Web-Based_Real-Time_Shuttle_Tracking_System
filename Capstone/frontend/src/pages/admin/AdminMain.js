import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard.js';
import UserManagement from './UserManagement.js';
import RouteManagement from './RouteManagment.js';
import ScheduleManagement from './Schedule Management.js';
import ShuttleManagement from './ShuttleManagement.js';
import MaintenanceManagement from './MaintenanceManagement.js';
import ReportManagement from './ReportManagement.js';
import CompanyManagement from './CompanyManagement.js';
import TestMap from './TestMap.js';

const Admin = () => {
  return (
        <Routes>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="routes" element={<RouteManagement />} />
            <Route path="schedules" element={<ScheduleManagement />} />
            <Route path="shuttles" element={<ShuttleManagement />} />
            <Route path="maintenance" element={<MaintenanceManagement />} />
            <Route path="reports" element={<ReportManagement />} />
            <Route path="companies" element={<CompanyManagement />} />
            <Route path='test' element={<TestMap />} />
        </Routes>
  );
};

export default Admin;