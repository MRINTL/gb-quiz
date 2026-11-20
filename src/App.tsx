import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { HostGate } from './components/HostGate';
import { HomePage } from './pages/HomePage';
import { CreateRoom } from './pages/CreateRoom';
import { HostDashboard } from './pages/HostDashboard';
import { PlayerBoard } from './pages/PlayerBoard';
import { isDemoMode } from './services/firebaseService';

function DemoModeBadge() {
  return (
    <div className="demo-badge" role="note">
      Демо-режим: синхронизация только между вкладками этого браузера. Для телефонов подключите Firebase (README).
    </div>
  );
}

export function App() {
  // HashRouter: GitHub Pages serves only static files, so all routes live after "#/".
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<HostGate><CreateRoom /></HostGate>} />
          <Route path="/host/:roomId" element={<HostGate><HostDashboard /></HostGate>} />
          <Route path="/room/:roomId" element={<PlayerBoard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      {isDemoMode && <DemoModeBadge />}
    </MotionConfig>
  );
}
