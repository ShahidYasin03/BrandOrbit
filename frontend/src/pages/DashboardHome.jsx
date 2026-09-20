import { useEffect, useState } from 'react';
import api from '../api';
import { useBrand } from '../context/BrandContext';
import {
  AlertTriangle, Target, UserCheck, Bot, Plus, Trash2,
  X as XIcon, Sparkles, Settings, Key, Loader2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

/* ───────────── quick-suggestion chips ───────────── */
const SUGGESTIONS = {
  niche: ['Tech Startup', 'Fitness & Health', 'Finance & Crypto', 'E-commerce', 'Travel & Lifestyle'],
  quirks: ['Uses Gen-Z slang', 'Extremely sarcastic', 'Lots of emojis 🚀🔥', 'Poetic & thoughtful', 'Data-driven'],
  persona: ['Highly Professional', 'Friendly & Approachable', 'Educational & Authoritative', 'Humorous & Witty', 'Direct & Bold'],
};

/* ───────────── reusable chip ───────────── */
const Chip = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest font-bold transition-all duration-200"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#4a5568',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'; e.currentTarget.style.color = '#2dd4bf'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#4a5568'; }}
  >
    + {label}
  </button>
);

/* ───────────── inline input style ───────────── */
const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#dde1e7',
  fontSize: 14,
  outline: 'none',
};

/* ═══════════════════════════════════════════════════════════ */
const DashboardHome = () => {
  // Pull global brand state — selection here auto-propagates to Workspace & Schedule
  const { brands, setBrands, brandsLoading, refreshBrands, selectedBrandId, setSelectedBrandId, selectedBrand } = useBrand();
  const activeBrand = selectedBrand;
  const setActiveBrand = (b) => setSelectedBrandId(b?.id ?? null);
  const loading = brandsLoading;

  const [contents, setContents]         = useState([]);
  const [confirmMode, setConfirmMode]   = useState(null);

  /* add-brand modal */
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm]           = useState({ name: '', description: '', niche: '', quirks: '', persona_guidelines: '' });
  const [addSaving, setAddSaving]       = useState(false);
  const [addError, setAddError]         = useState('');

  /* delete-brand modal */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteTyped, setDeleteTyped]   = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const navigate = useNavigate();

  /* ── fetch brands delegated to context; just use refreshBrands ── */
  const fetchBrands = refreshBrands;

  /* ── fetch content for active brand ── */
  useEffect(() => {
    if (!activeBrand) { setContents([]); return; }
    api.get(`/brands/${activeBrand.id}/content`)
      .then(r => setContents(r.data || []))
      .catch(console.error);
  }, [activeBrand]);

  const pendingCount   = contents.filter(c => ['DRAFT', 'PENDING_APPROVAL'].includes(c.status)).length;
  const publishedCount = contents.filter(c => c.status === 'PUBLISHED').length;
  const scheduledCount = contents.filter(c => c.status === 'SCHEDULED').length;

  /* ── mode switch ── */
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
        const updated = { ...activeBrand, automation_mode: confirmMode };
        setActiveBrand(updated);
        setBrands(prev => prev.map(b => b.id === updated.id ? updated : b));
        setConfirmMode(null);
        navigate(confirmMode === 'manual' ? `/workspace/${activeBrand.id}` : `/schedule/${activeBrand.id}`);
      })
      .catch(() => alert('Failed to update mode.'));
  };

  /* ── add brand ── */
  const appendSuggestion = (field, val) =>
    setAddForm(prev => ({ ...prev, [field]: prev[field] ? prev[field] + ', ' + val : val }));

  const handleAddBrand = async (e) => {
    e.preventDefault();
    setAddSaving(true);
    setAddError('');
    try {
      const res = await api.post('/brands/', addForm);
      const newBrand = res.data;
      setShowAddModal(false);
      setAddForm({ name: '', description: '', niche: '', quirks: '', persona_guidelines: '' });
      fetchBrands();
      setActiveBrand(newBrand);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setAddError(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : (detail || 'Failed to create brand.'));
    } finally {
      setAddSaving(false);
    }
  };

  /* ── connect X for newly created brand ── */
  const handleConnectX = (brandId) => {
    api.get(`/auth/twitter/login?brand_id=${brandId}`)
      .then(res => { if (res.data?.auth_url) window.location.href = res.data.auth_url; })
      .catch(() => alert('Failed to initiate X connection. Please try again or contact support.'));
  };

  /* ── delete brand ── */
  const openDeleteModal = (brand, e) => {
    e.stopPropagation();
    setDeleteTarget(brand);
    setDeleteTyped('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/brands/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteTyped('');
      fetchBrands();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete brand.');
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ─── loading ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(45,212,191,0.2)', borderTopColor: '#2dd4bf' }} />
      </div>
    );
  }

  /* ─── no brand yet ─── */
  if (!activeBrand && brands.length === 0) {
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
    <div className="space-y-8 max-w-5xl mx-auto pb-14">

      {/* ── Header ── */}
      <div className="mb-2">
        <h2 className="text-3xl font-bold" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>System Overview</h2>
        <p className="text-sm mt-1" style={{ color: '#4a5568' }}>Real-time metrics across all managed brands</p>
      </div>

      {/* ── Brand Switcher Row ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#2dd4bf' }}>
          All Brands
        </p>
        <div className="flex flex-wrap gap-3">
          {brands.map(brand => {
            const isActive = activeBrand?.id === brand.id;
            return (
              <div
                key={brand.id}
                onClick={() => setActiveBrand(brand)}
                className="group relative flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(45,212,191,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isActive ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: isActive ? '0 0 20px rgba(45,212,191,0.08)' : 'none',
                }}
              >
                {/* pulse dot */}
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isActive ? '#2dd4bf' : 'rgba(255,255,255,0.15)' }} />
                <span className="text-sm font-semibold truncate max-w-[140px]"
                  style={{ color: isActive ? '#dde1e7' : '#6b7280' }}>
                  {brand.name}
                </span>
                {brand.twitter_username && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(29,161,242,0.12)', color: '#38bdf8', border: '1px solid rgba(29,161,242,0.2)' }}>
                    @{brand.twitter_username}
                  </span>
                )}
                {/* delete icon – appears on hover */}
                <button
                  onClick={(e) => openDeleteModal(brand, e)}
                  title="Delete brand"
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded-lg"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}

          {/* ── Add Brand button ── */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(45,212,191,0.04)',
              border: '1px dashed rgba(45,212,191,0.25)',
              color: '#2dd4bf',
              fontSize: 13,
              fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.08)'; e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.04)'; e.currentTarget.style.borderColor = 'rgba(45,212,191,0.25)'; }}
          >
            <Plus size={15} /> Add Brand
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Active Brand */}
        <div className="p-6 rounded-2xl flex flex-col justify-between"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Active Brand</p>
          <div>
            <p className="text-2xl font-bold truncate" style={{ color: '#dde1e7' }}>{activeBrand?.name}</p>
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#4a5568' }}>
              <Target size={12} /> {activeBrand?.niche || 'No niche set'}
            </p>
          </div>
        </div>

        {/* Pending / Scheduled */}
        <div className="p-6 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Pending / Scheduled</p>
          <p className="text-5xl font-bold" style={{ color: '#dde1e7' }}>{pendingCount + scheduledCount}</p>
          <p className="text-xs mt-2" style={{ color: '#4a5568' }}>{pendingCount} pending · {scheduledCount} queued</p>
        </div>

        {/* Published Posts */}
        <div className="p-6 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Published Posts</p>
          <p className="text-5xl font-bold" style={{ color: '#dde1e7' }}>{publishedCount}</p>
        </div>
      </div>

      {/* ── Mode selector ── */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest mb-5" style={{ color: '#2dd4bf' }}>Choose Your Posting Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Manual */}
          <div
            onClick={() => handleModeSelect('manual')}
            className="p-7 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: activeBrand?.automation_mode === 'manual' ? 'rgba(45,212,191,0.08)' : '#0e1117',
              border: activeBrand?.automation_mode === 'manual' ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: activeBrand?.automation_mode === 'manual' ? '0 0 40px rgba(45,212,191,0.1)' : 'none',
            }}
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
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#4a5568' }}>
              You retain full control. Generate posts with AI, edit them manually, and queue them manually.
            </p>
            <p className="text-xs font-medium" style={{ color: '#2dd4bf' }}>
              {activeBrand?.automation_mode === 'manual' ? 'Enter Workspace →' : 'Select Manual Mode'}
            </p>
          </div>

          {/* Auto-Pilot */}
          <div
            onClick={() => handleModeSelect('auto')}
            className="p-7 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: activeBrand?.automation_mode === 'auto' ? 'rgba(45,212,191,0.08)' : '#0e1117',
              border: activeBrand?.automation_mode === 'auto' ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
              boxShadow: activeBrand?.automation_mode === 'auto' ? '0 0 40px rgba(45,212,191,0.1)' : 'none',
            }}
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
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#4a5568' }}>
              AI takes the wheel. Set your posting schedule, define AI volume, and let it automatically fill your queue.
            </p>
            <p className="text-xs font-medium" style={{ color: '#2dd4bf' }}>
              {activeBrand?.automation_mode === 'auto' ? 'View Schedule Engine →' : 'Activate Auto-Pilot'}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          ADD BRAND MODAL
      ══════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
          onClick={() => setShowAddModal(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-7 py-5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)' }}>
                  <Plus size={18} style={{ color: '#2dd4bf' }} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: '#dde1e7' }}>Add New Brand</h3>
                  <p className="text-xs" style={{ color: '#4a5568' }}>Configure personality & connect X account</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568' }}
                onMouseEnter={e => e.currentTarget.style.color = '#dde1e7'}
                onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}>
                <XIcon size={16} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleAddBrand} className="p-7 space-y-6 max-h-[75vh] overflow-y-auto">
              {addError && (
                <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  {addError}
                </div>
              )}

              {/* ── Basic Identity ── */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest pb-2 flex items-center gap-2"
                  style={{ color: '#4a5568', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Settings size={13} /> Basic Identity
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>Brand Name *</label>
                    <input required type="text" value={addForm.name}
                      onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. NexusTech" style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>Niche / Industry *</label>
                    <input required type="text" value={addForm.niche}
                      onChange={e => setAddForm(p => ({ ...p, niche: e.target.value }))}
                      placeholder="e.g. AI Startups" style={inputStyle} />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {SUGGESTIONS.niche.map(s => <Chip key={s} label={s} onClick={() => appendSuggestion('niche', s)} />)}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>Description</label>
                  <textarea value={addForm.description}
                    onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief overview of the brand..." rows={2}
                    style={{ ...inputStyle, resize: 'none' }} />
                </div>
              </div>

              {/* ── AI Persona ── */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest pb-2 flex items-center gap-2"
                  style={{ color: '#4a5568', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Sparkles size={13} /> AI Persona Tuning
                </h4>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>Brand Quirks</label>
                  <textarea value={addForm.quirks}
                    onChange={e => setAddForm(p => ({ ...p, quirks: e.target.value }))}
                    placeholder="e.g. Uses a lot of rocket emojis, sarcastic tone..." rows={2}
                    style={{ ...inputStyle, resize: 'none' }} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SUGGESTIONS.quirks.map(s => <Chip key={s} label={s} onClick={() => appendSuggestion('quirks', s)} />)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#8b949e' }}>Persona Guidelines</label>
                  <textarea value={addForm.persona_guidelines}
                    onChange={e => setAddForm(p => ({ ...p, persona_guidelines: e.target.value }))}
                    placeholder="Professional tone, avoid political topics..." rows={2}
                    style={{ ...inputStyle, resize: 'none' }} />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SUGGESTIONS.persona.map(s => <Chip key={s} label={s} onClick={() => appendSuggestion('persona_guidelines', s)} />)}
                  </div>
                </div>
              </div>

              {/* ── X Connect note ── */}
              <div className="p-4 rounded-xl flex items-start gap-3"
                style={{ background: 'rgba(29,161,242,0.05)', border: '1px solid rgba(29,161,242,0.15)' }}>
                <Key size={16} style={{ color: '#38bdf8', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#38bdf8' }}>Connect X Account</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#4a5568' }}>
                    After creating the brand, you can connect its X (Twitter) account via the <strong style={{ color: '#8b949e' }}>Brand Manager</strong> page or click the button below to go straight to OAuth after saving.
                  </p>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4a5568' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: '#2dd4bf', color: '#071012', opacity: addSaving ? 0.7 : 1 }}>
                  {addSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {addSaving ? 'Creating...' : 'Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MODE CONFIRM MODAL
      ══════════════════════════════════════════════ */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
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
              <button onClick={() => setConfirmMode(null)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4a5568' }}>
                Cancel
              </button>
              <button onClick={confirmModeSwitch}
                className="flex-1 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#2dd4bf', color: '#071012' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DELETE BRAND MODAL
      ══════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
          onClick={() => { setDeleteTarget(null); setDeleteTyped(''); }}>
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#0d1117', border: '1px solid rgba(239,68,68,0.2)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Danger header strip */}
            <div className="px-7 py-5 flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <Trash2 size={18} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: '#f87171' }}>Delete Brand</h3>
                <p className="text-xs mt-0.5" style={{ color: '#4a5568' }}>This action cannot be undone</p>
              </div>
            </div>

            <div className="p-7 space-y-5">
              {/* Warning box */}
              <div className="p-4 rounded-xl space-y-2"
                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#ef4444' }}>
                  ⚠ Permanent Deletion — No Recovery
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                  Deleting <strong style={{ color: '#dde1e7' }}>"{deleteTarget.name}"</strong> will permanently remove:
                </p>
                <ul className="text-xs space-y-1 pl-3" style={{ color: '#6b7280' }}>
                  <li>• All content items (drafts, scheduled, published)</li>
                  <li>• Posting plan & schedule configuration</li>
                  <li>• X (Twitter) OAuth connection</li>
                  <li>• All validation rules</li>
                </ul>
                <p className="text-xs font-semibold pt-1" style={{ color: '#ef4444' }}>
                  There is no way to retrieve this data after deletion.
                </p>
              </div>

              {/* Type to confirm */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#8b949e' }}>
                  Type <span className="font-bold" style={{ color: '#dde1e7' }}>{deleteTarget.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteTyped}
                  onChange={e => setDeleteTyped(e.target.value)}
                  placeholder={deleteTarget.name}
                  style={{
                    ...inputStyle,
                    border: deleteTyped === deleteTarget.name
                      ? '1px solid rgba(239,68,68,0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteTyped(''); }}
                  className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteTyped !== deleteTarget.name || deleteLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: deleteTyped === deleteTarget.name ? 'rgba(239,68,68,0.85)' : 'rgba(239,68,68,0.2)',
                    color: deleteTyped === deleteTarget.name ? '#fff' : 'rgba(239,68,68,0.5)',
                    cursor: deleteTyped !== deleteTarget.name ? 'not-allowed' : 'pointer',
                  }}>
                  {deleteLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  {deleteLoading ? 'Deleting...' : 'Delete Brand'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
