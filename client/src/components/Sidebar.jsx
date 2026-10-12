import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  ListChecks,
  Users,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={20} strokeWidth={1.5} />, label: 'Dashboard' },
    { to: '/reports', icon: <FileText size={20} strokeWidth={1.5} />, label: 'Reports / Invoices' },
    { to: '/audit-logs', icon: <ClipboardList size={20} strokeWidth={1.5} />, label: 'Audit Logs' },
  ];

  if (user?.role === 'logger') {
    navItems.splice(2, 0, { to: '/my-invoices', icon: <ListChecks size={20} strokeWidth={1.5} />, label: 'My Invoices' });
  }

  if (user?.role === 'admin') {
    navItems.push({ to: '/users', icon: <Users size={20} strokeWidth={1.5} />, label: 'User Management' });
  }

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'A';

  const panelName = user?.role === 'admin' ? 'Admin Panel' : user?.role === 'logger' ? 'Logger Panel' : 'Guest Panel';

  return (
    <>
      <div className="mobile-header">
        <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="logo-icon" style={{ width: '32px', height: '32px', fontSize: '16px', background: 'var(--gradient-primary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>E</div>
          <h1 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--accent-primary)', fontWeight: 700 }}>Elite Residency</h1>
        </div>
      </div>

      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)} />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">E</div>
          <div>
            <h1>Elite Residency</h1>
            <div className="subtitle">{panelName}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-label">Main Menu</div>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link ${isActive && (item.to === '/' ? location.pathname === '/' : true) ? 'active' : ''}`
                }
                end={item.to === '/'}
                onClick={() => setIsOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={logout} title="Click to logout">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <LogOut size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </aside>
    </>
  );
}
