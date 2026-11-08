import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InstallGate } from './components/common/InstallGate';
import { HomePage } from './pages/HomePage';
import { StudentPage } from './pages/StudentPage';
import { SBOPage } from './pages/SBOPage';

export default function App() {
  return (
    <InstallGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/student" element={<StudentPage />} />
          <Route path="/sbo" element={<SBOPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </InstallGate>
  );
}
