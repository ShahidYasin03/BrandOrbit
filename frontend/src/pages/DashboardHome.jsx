import { useEffect, useState } from 'react';
import api from '../api';
import { AlertTriangle, Target, UserCheck, Bot } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const DashboardHome = () => {
  const [activeBrand, setActiveBrand] = useState(null);
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmMode, setConfirmMode] = useState(null);
  const navigate = useNavigate();

  const handleModeSelect = (mode) => {
    if (!activeBrand) return;
    if (activeBrand.automation_mode === mode) {
      navigate(mode === 'manual' ? `/workspace/${activeBrand.id}` : `/schedule/${activeBrand.id}`);
      return;
    }
    setConfirmMode(mode);
  };

  const confirmModeSwitch = () => {
    api.put(`/brands/${activeBrand.id}/mode`, { automation_mode: confirmMode })
      .then(() => {
        const updatedBrand = { ...activeBrand, automation_mode: confirmMode };
        setActiveBrand(updatedBrand);
        setConfirmMode(null);
        navigate(confirmMode === 'manual' ? `/workspace/${activeBrand.id}` : `/schedule/${activeBrand.id}`);
      })
      .catch(err => {
        console.error(err);
        alert("Failed to update mode.");
      });
  };

  useEffect(() => {
    api.get('/brands/')
      .then(res => {
        if (res.data && res.data.length > 0) {
          const brand = res.data[0];
          setActiveBrand(brand);
          // Fetch content counts for this brand
          api.get(`/brands/${brand.id}/content`)
            .then(r => setContents(r.data || []))
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = contents.filter(c => ['DRAFT', 'PENDING_APPROVAL'].includes(c.status)).length;
  const publishedCount = contents.filter(c => c.status === 'PUBLISHED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(45,212,191,0.2)', borderTopColor: '#2dd4bf' }} />
      </div>
    );
  }

  if (!activeBrand) {
    return (
      <div className="flex flex-col items-center justify-center py-24 max-w-lg mx-auto text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
          style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)' }}>
          <AlertTriangle style={{ color: '#2dd4bf' }} size={32} />
        </div>
        <h2 className="text-2xl font-bold" style={{ color: '#dde1e7', letterSpacing: '-0.01em' }}>No Brand Setup Yet</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#4a5568' }}>
          To get started with generating AI content and tracking stats, you first need to configure your brand profile.
        </p>
        <Link to="/brands"
          className="px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
          style={{ background: '#2dd4bf', color: '#071012' }}>
          Setup Your First Brand
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-3xl font-bold" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>System Overview</h2>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>Real-time metrics across all managed brands</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Active Brand */}
        <div className="p-6 rounded-2xl flex flex-col justify-between"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Active Brand</p>
          <div>
            <p className="text-2xl font-bold truncate" style={{ color: '#dde1e7' }}>{activeBrand.name}</p>
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#4a5568' }}>
              <Target size={12} /> {activeBrand.niche || 'No niche set'}
            </p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="p-6 rounded-2xl"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Pending Approvals</p>
          <p className="text-5xl font-bold" style={{ color: '#dde1e7' }}>{pendingCount}</p>
        </div>

        {/* Published Posts */}
        <div className="p-6 rounded-2xl"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Published Posts</p>
          <p className="text-5xl font-bold" style={{ color: '#dde1e7' }}>{publishedCount}</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: '#2dd4bf' }}>Choose Your Posting Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Manual Mode */}
          <div
            onClick={() => handleModeSelect('manual')}
            className="p-7 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: activeBrand?.automation_mode === 'manual' ? 'rgba(45,212,191,0.08)' : '#0e1117',
              border: activeBrand?.automation_mode === 'manual' ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: activeBrand?.automation_mode === 'manual' ? '0 0 40px rgba(45,212,191,0.1)' : 'none',
              backdropFilter: activeBrand?.automation_mode === 'manual' ? 'blur(20px)' : 'none',
              WebkitBackdropFilter: activeBrand?.automation_mode === 'manual' ? 'blur(20px)' : 'none',
            }}
            onMouseEnter={e => { if (activeBrand?.automation_mode !== 'manual') { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'; }}}
            onMouseLeave={e => { if (activeBrand?.automation_mode !== 'manual') { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'; }}}
          >
            <div className="flex justify-between items-start mb-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
                <UserCheck size={24} style={{ color: '#2dd4bf' }} />
              </div>
              {activeBrand?.automation_mode === 'manual' && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }}>Active</span>
              )}
            </div>
            <h4 className="text-lg font-bold mb-2" style={{ color: '#dde1e7' }}>Manual Mode</h4>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#4a5568' }}>You retain full control. Generate posts with AI, edit them manually, and queue them manually.</p>
            <p className="text-xs font-medium" style={{ color: '#2dd4bf' }}>
              {activeBrand?.automation_mode === 'manual' ? 'Enter Workspace →' : 'Select Manual Mode'}
            </p>
          </div>

          {/* Auto-Pilot Mode */}
          <div
            onClick={() => handleModeSelect('auto')}
            className="p-7 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: activeBrand?.automation_mode === 'auto' ? 'rgba(45,212,191,0.08)' : '#0e1117',
              border: activeBrand?.automation_mode === 'auto' ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: activeBrand?.automation_mode === 'auto' ? '0 0 40px rgba(45,212,191,0.1)' : 'none',
              backdropFilter: activeBrand?.automation_mode === 'auto' ? 'blur(20px)' : 'none',
              WebkitBackdropFilter: activeBrand?.automation_mode === 'auto' ? 'blur(20px)' : 'none',
            }}
            onMouseEnter={e => { if (activeBrand?.automation_mode !== 'auto') { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'; }}}
            onMouseLeave={e => { if (activeBrand?.automation_mode !== 'auto') { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'; }}}
          >
            <div className="flex justify-between items-start mb-5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
                <Bot size={24} style={{ color: '#2dd4bf' }} />
              </div>
              {activeBrand?.automation_mode === 'auto' && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Active
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold mb-2" style={{ color: '#dde1e7' }}>Full Auto-Pilot</h4>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#4a5568' }}>AI takes the wheel. Set your posting schedule, define AI volume, and let it automatically fill your queue.</p>
            <p className="text-xs font-medium" style={{ color: '#2dd4bf' }}>
              {activeBrand?.automation_mode === 'auto' ? 'View Schedule Engine →' : 'Activate Auto-Pilot'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl max-w-sm w-full mx-4"
            style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: '#dde1e7', letterSpacing: '-0.01em' }}>Confirm Mode Switch</h3>
            <p className="text-sm leading-relaxed mb-7" style={{ color: '#4a5568' }}>
              Are you sure you want to switch to{' '}
              <span className="font-semibold" style={{ color: '#dde1e7' }}>
                {confirmMode === 'manual' ? 'Manual Mode' : 'Full Auto-Pilot'}
              </span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmMode(null)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4a5568' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModeSwitch}
                className="flex-1 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#2dd4bf', color: '#071012' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
