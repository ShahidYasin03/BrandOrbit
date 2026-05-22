import { useEffect, useState } from 'react';
import api from '../api';
import { Settings, Target, Key, Plus, Sparkles, Edit3 } from 'lucide-react';

const SUGGESTIONS = {
  niche: ["Tech Startup", "Fitness & Health", "Finance & Crypto", "E-commerce", "Travel & Lifestyle"],
  quirks: ["Uses Gen-Z slang", "Extremely sarcastic", "Lots of emojis 🚀🔥", "Poetic & thoughtful", "Data-driven & analytical"],
  persona: ["Highly Professional", "Friendly & Approachable", "Educational & Authoritative", "Humorous & Witty", "Direct & Bold"]
};

const BrandManager = () => {
  const [brands, setBrands] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [newBrand, setNewBrand] = useState({ 
    name: '', description: '', niche: '', quirks: '', persona_guidelines: ''
  });

  useEffect(() => {
    fetchBrands();
    
    // Check URL parameters for OAuth status notifications
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');
    if (oauthStatus === 'success') {
      const username = params.get('username');
      alert(`Successfully connected X account @${username}!`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthStatus === 'failed') {
      const reason = params.get('reason') || 'Unknown error';
      alert(`Failed to connect X account: ${reason}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  function fetchBrands() {
    setFetchError(null);
    api.get('/brands/')
      .then(res => {
        console.log('Brands fetched:', res.data);
        setBrands(res.data);
      })
      .catch(err => {
        console.error('Failed to fetch brands:', err?.response?.data || err);
        setFetchError(err?.response?.data?.detail || 'Failed to load brands. Are you logged in?');
      });
  }

  const handleCreateBrand = (e) => {
    e.preventDefault();

    const payload = { ...newBrand };

    const request = isEditing
      ? api.put(`/brands/${payload.id}`, payload)
      : api.post('/brands/', payload);

    request
      .then(() => {
        fetchBrands();
        setNewBrand({ 
          name: '', description: '', niche: '', quirks: '', persona_guidelines: ''
        });
        setIsEditing(false);
      })
      .catch(err => {
        console.error('Brand save error:', err);
        console.error('Response data:', err?.response?.data);
        const detail = err?.response?.data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map(d => `${d.loc?.join('.')} — ${d.msg}`).join('\n')
          : (detail || 'Unknown error. Check console.');
        alert(`Failed to save brand:\n${msg}`);
      });
  };

  const appendSuggestion = (field, value) => {
    setNewBrand(prev => {
      const current = prev[field];
      const separator = current ? ', ' : '';
      return { ...prev, [field]: current + separator + value };
    });
  };

  const handleConnectX = (brandId) => {
    api.get(`/auth/twitter/login?brand_id=${brandId}`)
      .then(res => {
        if (res.data?.auth_url) {
          window.location.href = res.data.auth_url;
        }
      })
      .catch(err => {
        console.error("Failed to initiate X connection:", err);
        alert("Failed to initiate X connection. Make sure TWITTER_CLIENT_ID is set in your .env file.");
      });
  };

  const handleDisconnectX = (brandId) => {
    if (!window.confirm("Are you sure you want to disconnect your X account?")) return;
    api.post(`/brands/${brandId}/disconnect`)
      .then(() => {
        fetchBrands();
        alert("Successfully disconnected your X account.");
      })
      .catch(err => {
        console.error("Failed to disconnect X:", err);
        alert("Failed to disconnect X.");
      });
  };

  const activeBrand = brands.length > 0 ? brands[0] : null;
  const showForm = !activeBrand || isEditing;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
          <Target style={{ color: '#2dd4bf' }} size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>Brand Manager</h2>
          <p className="text-sm mt-1" style={{ color: '#4a5568' }}>Configure brand identities and AI guidelines</p>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          ⚠ {fetchError}
        </div>
      )}
      
      {!showForm && activeBrand && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Brand details */}
          <div className="lg:col-span-2 p-8 rounded-2xl relative overflow-hidden border border-white/5 bg-[#0e1117]">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-30"
              style={{ background: 'rgba(45,212,191,0.03)' }}></div>
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-[#dde1e7]">{activeBrand.name}</h3>
                  <p className="mt-2 text-sm text-[#4a5568]">{activeBrand.description || 'No description provided.'}</p>
                </div>
                <button 
                  onClick={() => {
                    setNewBrand(activeBrand);
                    setIsEditing(true);
                  }}
                  className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all cursor-pointer border border-white/8 bg-white/4 text-[#dde1e7] hover:bg-white/8"
                >
                  <Edit3 size={16} /> Edit Profile
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                <div className="p-4 rounded-xl bg-white/2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Niche</span>
                  <p className="mt-2 font-medium text-[#dde1e7]">{activeBrand.niche || 'Not specified'}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Quirks</span>
                  <p className="mt-2 font-medium line-clamp-3 text-[#dde1e7]">{activeBrand.quirks || 'None'}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Persona</span>
                  <p className="mt-2 font-medium line-clamp-3 text-[#dde1e7]">{activeBrand.persona_guidelines || 'Default'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* X (Twitter) Connection Card */}
          <div className="p-8 rounded-2xl relative overflow-hidden border border-white/5 bg-[#0e1117] flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-30"
              style={{ background: 'rgba(29,161,242,0.03)' }}></div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/10 border border-sky-500/20 text-sky-400">
                    <Key size={16} />
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-[#dde1e7]">X Integration</h4>
                </div>
                {activeBrand.twitter_username ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-[#2dd4bf]/12 text-[#2dd4bf] border border-[#2dd4bf]/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    Inactive
                  </span>
                )}
              </div>

              {activeBrand.twitter_username ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-white/5 bg-white/2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sm font-black text-sky-400">
                      {activeBrand.twitter_username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-[#dde1e7]">@{activeBrand.twitter_username}</h5>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Connected via OAuth 2.0</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    This brand is fully linked. The scheduling engine is authorized to manage and publish your content queue to X.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Connect your brand's X (Twitter) account to start scheduling and publishing posts. We use secure OAuth 2.0 PKCE protocol to authenticate.
                  </p>
                  <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-white/1 flex items-center justify-center text-center">
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold py-2">No Account Connected</p>
                  </div>
                </div>
              )}
            </div>

            <div className="relative z-10 pt-6">
              {activeBrand.twitter_username ? (
                <button 
                  onClick={() => handleDisconnectX(activeBrand.id)}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
                >
                  Disconnect X Account
                </button>
              ) : (
                <button 
                  onClick={() => handleConnectX(activeBrand.id)}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 border border-[#2dd4bf]/20 bg-[#2dd4bf]/5 text-[#2dd4bf] hover:bg-[#2dd4bf]/12"
                  style={{ boxShadow: '0 4px 12px rgba(45,212,191,0.05)' }}
                >
                  <Key size={12} /> Connect X Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="p-8 rounded-2xl relative overflow-hidden"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
            style={{ background: 'rgba(45,212,191,0.03)' }}></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <h3 className="text-xl font-semibold flex items-center gap-2" style={{ color: '#dde1e7' }}>
              {isEditing ? <Edit3 size={20} style={{ color: '#2dd4bf' }} /> : <Plus size={20} style={{ color: '#2dd4bf' }} />}
              {isEditing ? 'Edit Brand Profile' : 'Onboard New Brand'}
            </h3>
            {isEditing && (
              <button onClick={() => setIsEditing(false)} className="text-sm font-medium transition-colors" style={{ color: '#4a5568' }} onMouseEnter={e => e.currentTarget.style.color = '#dde1e7'} onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}>Cancel Edit</button>
            )}
          </div>
          
          <form onSubmit={handleCreateBrand} className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 pb-2 flex items-center gap-2">
                  <Settings size={16} /> Basic Identity
                </h4>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Brand Name *</label>
                  <input required type="text" value={newBrand.name} onChange={e => setNewBrand({...newBrand, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl glass-input" placeholder="e.g. NexusTech" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea value={newBrand.description} onChange={e => setNewBrand({...newBrand, description: e.target.value})} className="w-full px-4 py-2.5 rounded-xl glass-input resize-none overflow-y-auto" placeholder="Brief overview of the brand..." rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Niche / Industry *</label>
                  <input required type="text" value={newBrand.niche} onChange={e => setNewBrand({...newBrand, niche: e.target.value})} className="w-full px-4 py-2.5 rounded-xl glass-input mb-2" placeholder="e.g. AI Startups, Fitness" />
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.niche.map(s => (
                      <button key={s} type="button" onClick={() => appendSuggestion('niche', s)} className="text-[10px] px-3 py-1.5 rounded-full bg-white/3 text-[#4a5568] border border-white/8 hover:border-[#2dd4bf]/40 hover:text-[#2dd4bf] transition-all duration-200 uppercase tracking-widest font-bold">
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-5">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 pb-2 flex items-center gap-2">
                  <Sparkles size={16} /> AI Persona Tuning
                </h4>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Brand Quirks</label>
                  <textarea value={newBrand.quirks} onChange={e => setNewBrand({...newBrand, quirks: e.target.value})} className="w-full px-4 py-2.5 rounded-xl glass-input resize-none overflow-y-auto mb-2" placeholder="e.g. Uses a lot of rocket emojis, sarcastic tone..." rows={2} />
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.quirks.map(s => (
                      <button key={s} type="button" onClick={() => appendSuggestion('quirks', s)} className="text-[10px] px-3 py-1.5 rounded-full bg-white/3 text-[#4a5568] border border-white/8 hover:border-[#2dd4bf]/40 hover:text-[#2dd4bf] transition-all duration-200 uppercase tracking-widest font-bold">
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">General Guidelines</label>
                  <textarea value={newBrand.persona_guidelines} onChange={e => setNewBrand({...newBrand, persona_guidelines: e.target.value})} className="w-full px-4 py-2.5 rounded-xl glass-input resize-none overflow-y-auto mb-2" placeholder="Professional tone, avoid political topics..." rows={2} />
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.persona.map(s => (
                      <button key={s} type="button" onClick={() => appendSuggestion('persona_guidelines', s)} className="text-[10px] px-3 py-1.5 rounded-full bg-white/3 text-[#4a5568] border border-white/8 hover:border-[#2dd4bf]/40 hover:text-[#2dd4bf] transition-all duration-200 uppercase tracking-widest font-bold">
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>



            <div className="flex justify-end pt-4 border-t border-white/5 mt-8 pt-6">
              <button type="submit" className="px-8 py-3 rounded-xl flex items-center gap-2 text-sm font-bold transition-all hover:opacity-90"
                style={{ background: '#2dd4bf', color: '#071012' }}>
                <Target size={18} /> {isEditing ? 'Save Changes' : 'Initialize Brand'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BrandManager;
