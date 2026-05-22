import { useState, useEffect } from 'react';
import { 
  Shield, Users, Trash2, ShieldAlert,
  UserCheck, RefreshCw, Sliders, X, Search, Eye, AlertTriangle, Sparkles 
} from 'lucide-react';
import api from '../api';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Modals / Overlays
  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);
  const [quotaModalBrand, setQuotaModalBrand] = useState(null);
  const [inspectModalBrand, setInspectModalBrand] = useState(null);
  
  // Quota Modifications Form State
  const [quotaForm, setQuotaForm] = useState({ generations_today: 0, posts_today: 0 });

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const usersRes = await api.get('/admin/users');
      const usersData = usersRes.data || [];
      setUsers(usersData);
      
      // Auto select first user if none selected or the selected user is gone
      if (usersData.length > 0) {
        setSelectedUserId(prev => {
          if (prev && usersData.some(u => u.id === prev)) {
            return prev;
          }
          return usersData[0].id;
        });
      } else {
        setSelectedUserId(null);
      }
    } catch (err) {
      console.error("Failed to load admin profiles", err);
      alert("Failed to pull administrative records.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const targetRole = currentRole === 'ADMIN' ? 'EDITOR' : 'ADMIN';
    const message = targetRole === 'ADMIN'
      ? "Are you sure you want to elevate this profile to an ADMINISTRATOR? This grants full system administration privileges, system auditing access, and brand quota overrides."
      : "Are you sure you want to demote this administrator to an EDITOR? This will immediately revoke administrative panel access and database controls.";
    
    if (!window.confirm(message)) return;

    setActionLoading(true);
    try {
      await api.put(`/admin/users/${userId}/role`, { role: targetRole });
      await fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to switch role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    setActionLoading(true);
    try {
      await api.delete(`/admin/users/${selectedUserForDelete.id}`);
      setSelectedUserForDelete(null);
      await fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenQuotaModal = (brand) => {
    setQuotaModalBrand(brand);
    setQuotaForm({ 
      generations_today: brand.generations_today, 
      posts_today: brand.posts_today 
    });
  };

  const handleSaveQuota = async () => {
    if (!quotaModalBrand) return;
    setActionLoading(true);
    try {
      await api.put(`/admin/brands/${quotaModalBrand.id}/quota`, quotaForm);
      setQuotaModalBrand(null);
      await fetchAdminData();
    } catch (err) {
      alert("Failed to modify quota values");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4" style={{ background: '#08090c' }}>
        <RefreshCw className="animate-spin text-teal-400" size={32} />
        <p className="text-sm font-medium" style={{ color: '#8b949e' }}>Aggregating system statistics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20">
      
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
            <Shield style={{ color: '#2dd4bf' }} size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>Admin Control Center</h2>
            <p className="text-sm mt-1" style={{ color: '#4a5568' }}>Monitor real-time engine limits, manage user access, and audit brands.</p>
          </div>
        </div>
        <button 
          onClick={fetchAdminData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all border duration-200"
          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#dde1e7' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
        >
          <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""} />
          Refresh Stats
        </button>
      </div>

      {/* Interactive Account Registry - Split Pane Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Registered Users List (Master Panel) */}
        <div className="lg:col-span-4 p-6 rounded-2xl relative overflow-hidden space-y-6 flex flex-col"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)', minHeight: '600px' }}>
          
          <div>
            <h3 className="text-base font-bold text-[#dde1e7]">User Profiles</h3>
            <p className="text-[10px] mt-0.5 text-[#4a5568]">Registered accounts in database</p>
          </div>

          {/* Search box with perfectly styled inner icon */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              display: 'flex', 
              alignItems: 'center', 
              pointerEvents: 'none' 
            }}>
              <Search size={14} style={{ color: '#4a5568' }} />
            </div>
            <input 
              type="text" 
              placeholder="Search users by email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '36px',
                paddingRight: '12px',
                paddingTop: '10px',
                paddingBottom: '10px',
                borderRadius: '10px',
                fontSize: '11px',
                outline: 'none',
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#dde1e7',
                transition: 'all 0.2s'
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(45,212,191,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
            />
          </div>

          {/* Compact Scrollable Registry list with increased height */}
          <div className="space-y-3 overflow-y-auto pr-1 flex-1" style={{ maxHeight: '480px' }}>
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-[#4a5568]">
                No profiles match search.
              </div>
            ) : (
              filteredUsers.map(user => {
                const isActive = selectedUserId === user.id;
                return (
                  <div 
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className="p-5 rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between border"
                    style={{
                      background: isActive ? 'rgba(45,212,191,0.08)' : 'rgba(0,0,0,0.1)',
                      borderColor: isActive ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.03)',
                      boxShadow: isActive ? '0 0 15px rgba(45,212,191,0.05)' : 'none'
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)';
                      }
                    }}
                  >
                    <div className="flex items-center gap-4 overflow-hidden min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
                        style={{ 
                          background: isActive ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.02)', 
                          border: isActive ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.05)',
                          color: isActive ? '#2dd4bf' : '#8b949e'
                        }}>
                        {user.email.substring(0, 2).toUpperCase()}
                      </div>
                      
                      <div className="overflow-hidden space-y-0.5">
                        <p className="text-xs font-bold truncate text-[#dde1e7]">{user.email}</p>
                        <p className="text-[9px] text-[#4a5568] flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_verified ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                          {user.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex-shrink-0 pl-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-md font-semibold text-[#8b949e]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {user.brands?.length || 0}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: User Detail Inspector (Detail Panel) */}
        <div className="lg:col-span-8 p-8 rounded-2xl relative overflow-hidden space-y-8 flex flex-col"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)', minHeight: '600px' }}>
          
          {(() => {
            const selectedUser = users.find(u => u.id === selectedUserId) || null;
            if (!selectedUser) {
              return (
                <div className="flex-grow flex flex-col items-center justify-center text-center space-y-4 py-20">
                  <Users size={48} className="text-[#4a5568] opacity-40 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-bold text-[#dde1e7]">Select Profile to Audit</h4>
                    <p className="text-xs mt-1 max-w-xs mx-auto text-[#4a5568]">
                      Choose an active administrator or editor from the registry panel to inspect live brand metrics, daily queues, or adjust posting quotas.
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <>
                {/* Profile Header Block */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.12)' }}>
                      <span className="text-sm font-bold uppercase text-[#2dd4bf]">{selectedUser.email.substring(0, 2)}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#dde1e7] flex items-center gap-2 flex-wrap">
                        {selectedUser.email}
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                          style={{ 
                            background: selectedUser.role === 'ADMIN' ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.02)',
                            border: selectedUser.role === 'ADMIN' ? '1px solid rgba(167,139,250,0.2)' : '1px solid rgba(255,255,255,0.05)',
                            color: selectedUser.role === 'ADMIN' ? '#a78bfa' : '#8b949e'
                          }}>
                          {selectedUser.role}
                        </span>
                      </h3>
                      <p className="text-xs text-[#4a5568] mt-1 flex items-center gap-2">
                        <span>User ID: #{selectedUser.id}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1" style={{ color: selectedUser.is_verified ? '#10b981' : '#f59e0b' }}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedUser.is_verified ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                          {selectedUser.is_verified ? 'Verified Profile' : 'Pending OTP'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Header Profile Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleToggleRole(selectedUser.id, selectedUser.role)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide border transition-all duration-200 bg-slate-900/30 hover:bg-[#2dd4bf]/5 hover:border-[#2dd4bf]/30 text-[#dde1e7]"
                      title="Toggle system administrator permissions"
                    >
                      <UserCheck size={12} className="text-[#2dd4bf]" />
                      Toggle Role
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={() => setSelectedUserForDelete(selectedUser)}
                      className="p-2 rounded-lg transition-all border duration-200 inline-flex items-center justify-center border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 bg-red-500/5"
                      title="Permanently delete user profile"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Registered Brands Section */}
                <div className="space-y-4 flex-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a5568] pl-1">Registered Brands</h4>

                  {(!selectedUser.brands || selectedUser.brands.length === 0) ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-800/40 text-center text-xs font-semibold italic text-[#4a5568]">
                      No brands linked to this profile.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedUser.brands.map(brand => (
                        <div key={brand.id} className="p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between border space-y-5 bg-slate-900/10 border-slate-800/30">
                          
                          {/* Brand Identification */}
                          <div className="flex items-center justify-between gap-4">
                            <h5 className="text-sm font-bold text-[#dde1e7] truncate">{brand.name}</h5>
                            
                            {brand.twitter_username ? (
                              <span className="text-[9px] px-2.5 py-1 rounded-md font-bold uppercase flex-shrink-0" style={{ background: 'rgba(29,155,240,0.08)', color: '#1d9bf0', border: '1px solid rgba(29,155,240,0.15)' }}>
                                @{brand.twitter_username}
                              </span>
                            ) : (
                              <span className="text-[9px] px-2.5 py-1 rounded-md font-bold uppercase flex-shrink-0" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)' }}>
                                No X linked
                              </span>
                            )}
                          </div>

                          {/* Brand-Specific Content Stats */}
                          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/20 border border-slate-800/10 text-center">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider font-bold text-[#4a5568]">Scheduled Posts</span>
                              <p className="text-lg font-black text-[#2dd4bf] mt-1">{brand.scheduled_count || 0}</p>
                            </div>
                            <div className="border-l border-slate-800/10">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-[#4a5568]">Published Posts</span>
                              <p className="text-lg font-black text-[#3b82f6] mt-1">{brand.published_count || 0}</p>
                            </div>
                          </div>

                          {/* Action buttons footer (Enlarged) */}
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <button
                              onClick={() => setInspectModalBrand(brand)}
                              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold tracking-wide border transition-all duration-200 bg-slate-900/50 hover:bg-[#2dd4bf]/10 hover:border-[#2dd4bf]/30 text-[#dde1e7]"
                              style={{ cursor: 'pointer' }}
                            >
                              <Eye size={14} className="text-[#2dd4bf]" />
                              Brand Details
                            </button>
                            
                            <button
                              onClick={() => handleOpenQuotaModal(brand)}
                              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold tracking-wide border transition-all duration-200 bg-slate-900/50 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-[#dde1e7]"
                              style={{ cursor: 'pointer' }}
                            >
                              <Sliders size={14} className="text-[#10b981]" />
                              Quota Manager
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

        </div>

      </div>

      {/* MODAL 1: CASCADING DELETE CONFIRMATION */}
      {selectedUserForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md p-8 rounded-2xl relative overflow-hidden space-y-6"
            style={{ background: '#0e1117', border: '1px solid rgba(239,68,68,0.2)' }}>
            
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert size={24} />
              <h4 className="text-lg font-bold">Cascading Delete Notice</h4>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: '#8b949e' }}>
              You are about to permanently remove the user <strong style={{ color: '#dde1e7' }}>{selectedUserForDelete.email}</strong>. 
              <br /><br />
              This is a <strong className="text-red-400">destructive operation</strong>. Due to relational cascading integrity, this will instantly purge:
            </p>

            <ul className="text-[10px] font-semibold space-y-1.5 pl-4 list-disc text-red-300">
              <li>All brands owned by this profile</li>
              <li>Active posting plans configured</li>
              <li>Workspace validation rules & templates</li>
              <li>Entire drafting, scheduled, and published content logs</li>
            </ul>

            <p className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
              <AlertTriangle size={12} />
              This database purge cannot be undone.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setSelectedUserForDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#dde1e7' }}
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleDeleteUser}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all outline-none bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading ? "Purging Record..." : "Confirm & Purge"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: LIMITS & QUOTA CONFIGURATION MODAL */}
      {quotaModalBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm p-8 rounded-2xl relative overflow-hidden space-y-6"
            style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-teal-400">
                <Sliders size={18} />
                <h4 className="text-sm font-bold text-slate-200">Quota Manager</h4>
              </div>
              <button onClick={() => setQuotaModalBrand(null)} className="text-slate-500 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs" style={{ color: '#8b949e' }}>
              Adjust used limits for <strong style={{ color: '#dde1e7' }}>{quotaModalBrand.name}</strong>. Reducing this count gives the brand more operational capacity today.
            </p>

            <div className="space-y-4">
              {/* Generation Used Limits */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AI Generations Today (Max 4)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="4" 
                    value={quotaForm.generations_today}
                    onChange={e => setQuotaForm({ ...quotaForm, generations_today: parseInt(e.target.value) })}
                    className="flex-1 accent-teal-400 bg-slate-800 h-1 rounded-lg outline-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-teal-400 w-8 text-right">{quotaForm.generations_today} / 4</span>
                </div>
              </div>

              {/* Posting Used Limits */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dispatched Posts Today (Max 3)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="3" 
                    value={quotaForm.posts_today}
                    onChange={e => setQuotaForm({ ...quotaForm, posts_today: parseInt(e.target.value) })}
                    className="flex-1 accent-blue-500 bg-slate-800 h-1 rounded-lg outline-none cursor-pointer"
                  />
                  <span className="text-xs font-bold text-blue-400 w-8 text-right">{quotaForm.posts_today} / 3</span>
                </div>
              </div>
            </div>

            <div className="flex-items-center gap-3 pt-2 flex">
              <button
                onClick={() => setQuotaModalBrand(null)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all border outline-none"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#dde1e7' }}
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleSaveQuota}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all outline-none bg-teal-500 hover:bg-teal-600 text-slate-900"
              >
                {actionLoading ? "Saving..." : "Save Quota"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: BRAND INSPECTION (Live Impersonation details) */}
      {inspectModalBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg p-8 rounded-2xl relative overflow-hidden space-y-6 flex flex-col h-[500px]"
            style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
            
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5 text-teal-400">
                <Eye size={18} />
                <h4 className="text-sm font-bold text-slate-200">Brand Workspace Details</h4>
              </div>
              <button onClick={() => setInspectModalBrand(null)} className="text-slate-500 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl space-y-1 bg-slate-900/40 border border-slate-800/50">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Selected Niche</span>
                  <p className="text-xs font-bold" style={{ color: '#dde1e7' }}>{inspectModalBrand.niche || "Not specified"}</p>
                </div>
                <div className="p-4 rounded-xl space-y-1 bg-slate-900/40 border border-slate-800/50">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Automation Autopilot</span>
                  <p className="text-xs font-bold uppercase tracking-wider" 
                    style={{ color: inspectModalBrand.automation_mode === 'auto' ? '#10b981' : '#8b949e' }}>
                    {inspectModalBrand.automation_mode || "manual"}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">Description</span>
                <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <p style={{ color: '#8b949e' }}>{inspectModalBrand.description || "No description provided."}</p>
                </div>
              </div>

              {/* Quirks & Guidelines */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Sparkles size={11} className="text-teal-400" />
                  Brand Quirks & Guidelines
                </span>
                <div className="p-4 rounded-xl text-xs space-y-3" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div>
                    <span className="font-semibold block text-slate-400 mb-1">Tone & Mannerisms</span>
                    <p style={{ color: '#8b949e' }} className="italic font-medium">"{inspectModalBrand.quirks || "No unique tone or quirks specified"}"</p>
                  </div>
                  <div>
                    <span className="font-semibold block text-slate-400 mb-1">Persona Directives</span>
                    <p style={{ color: '#8b949e' }}>{inspectModalBrand.persona_guidelines || "No customized guidelines logged."}</p>
                  </div>
                </div>
              </div>

              {/* Active Plan details */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">Posting Calendar Configuration</span>
                {inspectModalBrand.posting_plan ? (
                  <div className="p-4 rounded-xl text-xs space-y-2.5" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Scheduled days:</span>
                      <span className="font-bold text-teal-400">{JSON.stringify(inspectModalBrand.posting_plan.active_days)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Posting Hours:</span>
                      <span className="font-bold text-teal-400">{JSON.stringify(inspectModalBrand.posting_plan.time_slots)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Volume Strategy:</span>
                      <span className="font-bold uppercase tracking-wider text-teal-400">{inspectModalBrand.posting_plan.volume}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-semibold italic text-slate-600 pl-1">No posting plan setup yet.</p>
                )}
              </div>

            </div>

            <div className="flex-shrink-0 pt-3 border-t border-slate-800/40">
              <button
                onClick={() => setInspectModalBrand(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all border outline-none"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)', color: '#dde1e7' }}
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
