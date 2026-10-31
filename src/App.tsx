import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import LoginGate from './components/LoginGate';

// Memory DB pages
import Browse from './pages/Browse';
import Gallery from './pages/Gallery';
import Messages from './pages/Messages';
import Cleanup from './pages/Cleanup';
import Sources from './pages/Sources';
import People from './pages/People';
import Attachments from './pages/Attachments';
import Tokens from './pages/Tokens';
import Settings from './pages/Settings';

import IMessageConversations from './pages/imessage/Conversations';

// Unified reusable components
import ServiceMessages from './components/ServiceMessages';
import ServiceDashboard from './components/ServiceDashboard';

import { getServiceConfig, checkHealth, ServiceConfig } from './api';

/* iMessage is local (Mac Mini), no ingestor — custom sidebar */
const IMESSAGE_SECTION: SidebarSection = {
  key: 'imessage',
  icon: '💬',
  label: 'iMessage',
  items: [
    { to: '/imessage/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/imessage/messages',  icon: '✉️', label: 'Messages' },
    { to: '/imessage/conversations', icon: '💬', label: 'Conversations' },
  ],
};

/* ── Sidebar section type ───────────────────────────────── */

interface SidebarSection {
  key: string;
  icon: string;
  label: string;
  serviceKey?: string;
  items: { to: string; icon: string; label: string }[];
}

/* ── Build sidebar sections ─────────────────────────────── */

/* The everyday pages sit at the top; admin tools and iMessage are tucked into menus below. Ingestor status lives on the Sources page. */
const MAIN_LINKS = [
  { to: '/memory/browse',      icon: '🔎', label: 'Browse' },
  { to: '/memory/attachments', icon: '📎', label: 'Attachments' },
  { to: '/memory/sources',     icon: '📡', label: 'Sources' },
  { to: '/memory/people',      icon: '👤', label: 'People' },
];

const ADMIN_SECTION: SidebarSection = {
  key: 'memory-admin', icon: '🛠️', label: 'Admin', serviceKey: 'memory-api',
  items: [
    { to: '/memory/messages',          icon: '✉️', label: 'Messages table' },
    { to: '/memory/attachments-table', icon: '📋', label: 'Attachments table' },
    { to: '/memory/cleanup',           icon: '🧹', label: 'Cleanup' },
    { to: '/memory/tokens',            icon: '🔑', label: 'Tokens' },
    { to: '/memory/settings',          icon: '⚙️', label: 'Settings' },
  ],
};

const sections: SidebarSection[] = [ADMIN_SECTION, IMESSAGE_SECTION];

/* ── Collapsed state persistence ────────────────────────── */

function loadCollapsed(): Record<string, boolean> {
  const defaults: Record<string, boolean> = Object.fromEntries(sections.map(s => [s.key, true]));
  try {
    const saved = JSON.parse(localStorage.getItem('sidebar-collapsed') || '{}');
    return { ...defaults, ...saved };
  } catch { return defaults; }
}

/* ── App ────────────────────────────────────────────────── */

export default function App() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({});
  const [health, setHealth] = useState<Record<string, boolean>>({});
  const location = useLocation();

  useEffect(() => {
    getServiceConfig().then(setServiceConfig).catch(() => {});
  }, []);

  useEffect(() => {
    for (const section of sections) {
      if (section.serviceKey && serviceConfig[section.serviceKey]?.configured) {
        checkHealth(section.serviceKey).then(ok => {
          setHealth(h => ({ ...h, [section.serviceKey!]: ok }));
        });
      }
    }
  }, [serviceConfig]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  const wide = /^\/memory\/(browse|attachments)$/.test(location.pathname);

  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sidebar-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  const getStatusDot = (serviceKey?: string) => {
    if (!serviceKey) return null;
    const cfg = serviceConfig[serviceKey];
    if (!cfg?.configured) return <span className="status-dot grey" title="Not configured" />;
    const ok = health[serviceKey];
    if (ok === undefined) return <span className="status-dot grey" title="Checking..." />;
    return <span className={`status-dot ${ok ? 'green' : 'red'}`} title={ok ? 'Connected' : 'Unreachable'} />;
  };

  const renderSection = (section: SidebarSection) => {
    return (
      <div key={section.key} className="sidebar-section">
        <button className="section-header" onClick={() => toggle(section.key)}>
          <span className="section-icon">{section.icon}</span>
          <span className="section-label">{section.label}</span>
          {getStatusDot(section.serviceKey)}
          <span className={`chevron ${collapsed[section.key] ? 'collapsed' : ''}`}>▾</span>
        </button>
        {!collapsed[section.key] && (
          <div className="section-items">
            {section.items.map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <LoginGate>
    <div className="app-layout">
      <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          🧠 Data Hub
          {import.meta.env.VITE_BUILD_DATE && (
            <div style={{ fontSize: 10, color: '#555', fontWeight: 400, marginTop: 2 }}>
              {import.meta.env.VITE_BUILD_DATE}{import.meta.env.VITE_BUILD_SHA ? ` (${import.meta.env.VITE_BUILD_SHA})` : ''}
            </div>
          )}
        </div>
        <div className="sidebar-nav">
          {MAIN_LINKS.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link main-link ${isActive ? 'active' : ''}`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          <div className="sidebar-divider" />
          {renderSection(ADMIN_SECTION)}
          {renderSection(IMESSAGE_SECTION)}
        </div>
      </nav>
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <main className={`main-content ${wide ? 'wide' : ''}`}>
        <Routes>
          {/* ── Memory DB ─────────────────────────────────── */}
          <Route path="/memory/browse" element={<Browse />} />
          <Route path="/memory/messages" element={<Messages />} />
          <Route path="/memory/cleanup" element={<Cleanup />} />
          <Route path="/memory/sources" element={<Sources />} />
          <Route path="/memory/people" element={<People />} />
          <Route path="/memory/attachments" element={<Gallery />} />
          <Route path="/memory/attachments-table" element={<Attachments />} />
          <Route path="/memory/tokens" element={<Tokens />} />
          <Route path="/memory/settings" element={<Settings />} />

          {/* ── iMessage (local, no ingestor) ────────────── */}
          <Route path="/imessage/dashboard" element={<ServiceDashboard service="imessage" serviceLabel="iMessage" serviceIcon="💬" serviceKey="" sourceName="imessage" />} />
          <Route path="/imessage/messages" element={<ServiceMessages source="imessage" serviceLabel="iMessage" serviceIcon="💬" />} />
          <Route path="/imessage/conversations" element={<IMessageConversations />} />

          {/* ── Default ───────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/memory/browse" replace />} />
        </Routes>
      </main>
    </div>
    </LoginGate>
  );
}
