import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Sparkles, LogOut, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/HorizontalLogo.svg';

const Navbar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard',      icon: LayoutDashboard },
    { path: '/brands',    label: 'Brand Manager',  icon: Target },
    { path: '/workspace', label: 'AI Workspace',   icon: Sparkles },
    { path: '/schedule',  label: 'Schedule Engine', icon: CalendarDays },
  ];

  return (
    <nav
      className="w-60 h-screen flex-shrink-0 flex flex-col sticky top-0 z-20"
      style={{
        background: 'rgba(8,9,12,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-8 flex items-center">
        <img src={logo} alt="BrandOrbit" className="h-9 w-auto opacity-85" />
      </div>

      {/* Section label */}
      <p className="px-5 text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#2d3340' }}>
        Main Menu
      </p>

      {/* Nav links */}
      <ul className="flex-1 space-y-0.5 px-3">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <li key={path}>
              <Link
                to={path}
                className="flex items-center gap-3 px-3 py-2.5 transition-all duration-200 text-sm font-medium"
                style={{
                  color:      isActive ? '#2dd4bf' : '#4a5568',
                  background: isActive ? 'rgba(45,212,191,0.12)' : 'transparent',
                  borderTop:     isActive ? '1px solid rgba(45,212,191,0.2)' : '1px solid transparent',
                  borderBottom:  isActive ? '1px solid rgba(45,212,191,0.2)' : '1px solid transparent',
                  borderRight:   isActive ? '1px solid rgba(45,212,191,0.2)' : '1px solid transparent',
                  borderLeft:    isActive ? '4px solid #2dd4bf' : '4px solid transparent',
                  borderRadius: isActive ? '0 12px 12px 0' : '12px',
                  marginLeft: isActive ? '-12px' : '0',
                  paddingLeft: isActive ? '24px' : '12px',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#8b949e'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'transparent'; }}}
              >
                <Icon
                  size={18}
                  style={{ color: isActive ? '#2dd4bf' : 'inherit', filter: isActive ? 'drop-shadow(0 0 6px rgba(45,212,191,0.4))' : 'none' }}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* User block */}
      <div className="px-3 pb-6 mt-auto">
        <div
          className="p-3 rounded-xl mb-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.25)' }}
            >
              <span className="text-xs font-bold uppercase" style={{ color: '#2dd4bf' }}>
                {user?.email?.substring(0, 2)}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium truncate" style={{ color: '#8b949e' }}>{user?.email}</p>
              <p className="text-[10px] capitalize" style={{ color: '#3d4450' }}>{user?.role || 'user'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: '#4a5568', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.border = '1px solid rgba(239,68,68,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)'; }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
