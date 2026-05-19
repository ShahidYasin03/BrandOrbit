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
    name: '', description: '', niche: '', quirks: '', persona_guidelines: '',
    twitter_api_key: '', twitter_api_secret: '', twitter_access_token: '', twitter_access_secret: ''
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

    // Strip empty optional fields so they don't cause validation issues
    const payload = { ...newBrand };
    ['twitter_api_key','twitter_api_secret','twitter_access_token','twitter_access_secret'].forEach(k => {
      if (!payload[k]) delete payload[k];
    });

    const request = isEditing
      ? api.put(`/brands/${payload.id}`, payload)
      : api.post('/brands/', payload);

    request
      .then(() => {
        fetchBrands();
        setNewBrand({ 
          name: '', description: '', niche: '', quirks: '', persona_guidelines: '',
          twitter_api_key: '', twitter_api_secret: '', twitter_access_token: '', twitter_access_secret: ''
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
        <div className="p-8 rounded-2xl relative overflow-hidden"
          style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"
            style={{ background: 'rgba(45,212,191,0.03)' }}></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-3 flex-wrap" style={{ color: '#dde1e7' }}>
                  {activeBrand.name}
                  {activeBrand.twitter_username ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(45,212,191,0.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.25)' }}>
                        @{activeBrand.twitter_username} Connected
                      </span>
                      <button 
                        onClick={() => handleDisconnectX(activeBrand.id)}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer"
                      >
                        Disconnect X
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleConnectX(activeBrand.id)}
                      className="text-[10px] text-teal-400 hover:text-teal-300 font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 transition-all cursor-pointer"
                    >
                      Connect X Account
                    </button>
                  )}
                </h3>
                <p className="mt-2 max-w-2xl text-sm" style={{ color: '#4a5568' }}>{activeBrand.description || 'No description provided.'}</p>
              </div>
              <button 
                onClick={() => {
                  setNewBrand(activeBrand);
                  setIsEditing(true);
                }}
                className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <Edit3 size={16} /> Edit Profile
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/5">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Niche</span>
                <p className="mt-2 font-medium" style={{ color: '#dde1e7' }}>{activeBrand.niche || 'Not specified'}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Quirks</span>
                <p className="mt-2 font-medium line-clamp-3" style={{ color: '#dde1e7' }}>{activeBrand.quirks || 'None'}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Persona</span>
                <p className="mt-2 font-medium line-clamp-3" style={{ color: '#dde1e7' }}>{activeBrand.persona_guidelines || 'Default'}</p>
              </div>
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
