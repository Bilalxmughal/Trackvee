import { Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<div className="p-8 text-gray-900">YoTrack Portal — Dashboard (Phase 6)</div>} />
      <Route path="/login" element={<div className="p-8 text-gray-900">YoTrack Portal — Login (Phase 4)</div>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
