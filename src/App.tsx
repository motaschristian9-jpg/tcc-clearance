import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InstallGate } from './components/common/InstallGate';
import { StudentPage } from './pages/StudentPage';
import { SBOPage } from './pages/SBOPage';

export default function App() {
  return (
    <InstallGate>
      <BrowserRouter>
        <Routes>
          {/* Public Home: Students directly see their activity card & live QR */}
          <Route path="/" element={<StudentPage />} />
          <Route path="/student" element={<StudentPage />} />

          {/* Hidden/Restricted SBO Officer Portal: Protected by PIN Lock */}
          <Route path="/sbo" element={<SBOPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </InstallGate>
  );
}
