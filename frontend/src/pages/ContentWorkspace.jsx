import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useBrand } from '../context/BrandContext';
import { Sparkles, RefreshCw, TrendingUp, Check, Edit3, Trash2, CheckCircle2, Send, Clock } from 'lucide-react';

const ContentWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedBrandId } = useBrand();
  // URL param takes priority; fall back to globally selected brand (never default to 1)
  const brandId = id ? parseInt(id, 10) : selectedBrandId;

  const [contents, setContents] = useState([]);
  const [trends, setTrends] = useState([]);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const refreshTimerRef = useRef(null);

  const COOLDOWN_SECS = 5 * 60;
  const cooldownKey = `trend_cooldown_${brandId}`;
  const getSecondsLeft = () => {
    const exp = parseInt(localStorage.getItem(cooldownKey) || '0', 10);
    return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
  };
  const [cooldownLeft, setCooldownLeft] = useState(getSecondsLeft);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      const left = getSecondsLeft();
      setCooldownLeft(left);
      if (left <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  useEffect(() => {
    fetchContent();
    fetchTrends(false);
    return () => clearTimeout(refreshTimerRef.current);
  }, [brandId]);

  function fetchTrends(startCooldown = true) {
    setIsFetchingTrends(true);
    api.get(`/brands/${brandId}/trends`)
      .then(res => {
        setTrends(res.data);
        if (res.data.length > 0) setSelectedTrend(res.data[0]);
        if (startCooldown) {
          const exp = Date.now() + COOLDOWN_SECS * 1000;
          localStorage.setItem(cooldownKey, String(exp));
          setCooldownLeft(COOLDOWN_SECS);
        }
      })
      .catch(console.error)
      .finally(() => setIsFetchingTrends(false));
  }

  function fetchContent() {
    api.get(`/brands/${brandId}/content`)
      .then(res => {
        setContents(res.data);

        // Schedule a precise refresh just after the next scheduled post is due
        clearTimeout(refreshTimerRef.current);
        const now = Date.now();
        const nextDue = res.data
          .filter(c => c.status === 'SCHEDULED' && c.scheduled_for)
          .map(c => new Date(c.scheduled_for + 'Z').getTime())
          .filter(t => t > now)
          .sort((a, b) => a - b)[0];

        if (nextDue) {
          // 35s buffer gives the 30s backend scheduler time to fire
          const delay = (nextDue - now) + 35000;
          refreshTimerRef.current = setTimeout(fetchContent, delay);
        }
      })
      .catch(console.error);
  }

  const handleGenerateAI = () => {
    if (!selectedTrend) { alert('Please select a trend first.'); return; }
    setIsGenerating(true);
    api.post(`/brands/${brandId}/generate`, { trend: selectedTrend })
      .then(fetchContent)
      .catch(err => {
        console.error(err);
        alert('Content generation failed. Please try again later.');
      })
      .finally(() => setIsGenerating(false));
  };

  const handleSaveEdit = (contentId) => {
    api.put(`/content/${contentId}`, { body: editBody })
      .then(() => { setEditingId(null); fetchContent(); })
      .catch(console.error);
  };

  const handleDelete = (contentId) => {
    api.delete(`/content/${contentId}`)
      .then(() => { setPendingDelete(null); fetchContent(); })
      .catch(err => alert('Failed to delete post.'));
  };

  const handleApprove = (contentId) => {
    api.post(`/content/${contentId}/approve_and_queue`)
      .then(fetchContent)
      .catch(err => {
        console.error(err);
        const detail = err?.response?.data?.detail;
        alert(detail || 'Failed to approve. Make sure you have a posting schedule configured in the Schedule Engine.');
      });
  };

  const drafts = contents.filter(c => c.status === 'DRAFT');
  const queued = contents.filter(c => ['SCHEDULED', 'APPROVED'].includes(c.status));
  const published = contents
    .filter(c => c.status === 'PUBLISHED')
    .sort((a, b) => new Date(b.scheduled_for || b.created_at) - new Date(a.scheduled_for || a.created_at));

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
            <Sparkles style={{ color: '#2dd4bf' }} size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>AI Workspace</h2>
            <p className="text-sm mt-1" style={{ color: '#4a5568' }}>Generate, review, and queue content for publishing.</p>
          </div>
        </div>
        <button
          onClick={handleGenerateAI}
          disabled={isGenerating || !selectedTrend}
          className="px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          style={{ background: '#2dd4bf', color: '#071012' }}
        >
          {isGenerating ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {isGenerating ? 'Generating...' : 'Generate via AI'}
        </button>
      </div>

      {/* Trend Selector */}
      <div className="p-7 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: '#2dd4bf' }}>
            <TrendingUp size={16} /> Trending Topics
          </h3>
          <button
            onClick={() => fetchTrends(true)}
            disabled={isFetchingTrends || cooldownLeft > 0}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{ color: cooldownLeft > 0 ? '#2d3340' : '#4a5568' }}
          >
            {cooldownLeft > 0 ? (
              <>
                <Clock size={12} />
                <span className="tabular-nums">
                  {String(Math.floor(cooldownLeft / 60)).padStart(2,'0')}:{String(cooldownLeft % 60).padStart(2,'0')}
                </span>
              </>
            ) : (
              <>
                <RefreshCw size={12} className={isFetchingTrends ? 'animate-spin' : ''} />
                Refresh
              </>
            )}
          </button>
        </div>
        {isFetchingTrends ? (
          <div className="py-6 text-center text-xs animate-pulse" style={{ color: '#4a5568' }}>Analyzing niche trends...</div>
        ) : trends.length === 0 ? (
          <div className="py-8 text-center text-xs" style={{ color: '#4a5568' }}>
            No brand setup or niche configured yet. Please configure your brand details in the Brand Profile page to view and analyze trending topics.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {trends.map((trend, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedTrend(trend)}
                className="p-4 rounded-xl border cursor-pointer transition-all duration-200"
                style={{
                  background: selectedTrend === trend ? 'rgba(45,212,191,0.04)' : 'rgba(255,255,255,0.02)',
                  border: selectedTrend === trend ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex justify-between items-start">
                  <p className="font-medium text-sm" style={{ color: selectedTrend === trend ? '#2dd4bf' : '#8b949e' }}>{trend}</p>
                  {selectedTrend === trend && <Check size={14} style={{ color: '#2dd4bf' }} className="shrink-0 ml-2" />}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Drafts */}
      <div className="space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: '#4a5568' }}>
          <Edit3 size={16} />
          Drafts
          {drafts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: '#4a5568' }}>{drafts.length}</span>
          )}
        </h3>

        {drafts.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            <Sparkles className="mx-auto mb-4 opacity-20" size={40} style={{ color: '#2dd4bf' }} />
            <p className="text-sm font-medium" style={{ color: '#4a5568' }}>No drafts yet.</p>
            <p className="text-[10px] uppercase tracking-widest mt-2" style={{ color: '#2d3340' }}>Click "Generate via AI" to create posts.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map(item => (
              <div key={item.id} className="p-7 rounded-2xl transition-all" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
                {editingId === item.id ? (
                  <div className="space-y-4 mb-4">
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      className="w-full rounded-xl p-5 text-sm h-32 resize-none outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(45,212,191,0.3)', color: '#dde1e7' }}
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${editBody.length > 280 ? 'text-red-400' : 'text-slate-500'}`}>
                        {editBody.length} / 280
                      </span>
                      <div className="flex gap-3">
                        <button onClick={() => setEditingId(null)} className="px-5 py-2 rounded-lg text-xs font-bold transition-all" style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568' }}>Cancel</button>
                        <button onClick={() => handleSaveEdit(item.id)} className="px-5 py-2 rounded-lg text-xs font-bold transition-all" style={{ background: '#2dd4bf', color: '#071012' }}>Save</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-base leading-relaxed mb-6" style={{ color: '#dde1e7' }}>{item.body}</p>
                )}

                <div className="flex items-center justify-between border-t border-white/5 pt-5">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2d3340' }}>
                    {new Date(item.created_at + 'Z').toLocaleString()}
                  </span>

                  {editingId !== item.id && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setEditingId(item.id); setEditBody(item.body); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5568' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#dde1e7'}
                        onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}
                      >
                        <Edit3 size={14} /> Edit
                      </button>

                      <button
                        onClick={() => setPendingDelete(item.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', color: 'rgba(239,68,68,0.6)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#f87171'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; e.currentTarget.style.color = 'rgba(239,68,68,0.6)'; }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>

                      <button
                        onClick={() => handleApprove(item.id)}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,191,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,191,0.08)'}
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Queued / Scheduled */}
      {queued.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#2dd4bf' }}>
            <Send size={14} />
            In Queue
            <span className="ml-2 px-2 py-0.5 rounded-full" style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}>{queued.length}</span>
          </h3>
          {queued.map(item => (
            <div key={item.id} className="p-5 rounded-xl flex items-start gap-5" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex-1 text-sm leading-relaxed" style={{ color: '#8b949e' }}>{item.body}</div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#2dd4bf' }}>Scheduled</div>
                {item.scheduled_for && <div className="text-[10px] font-medium" style={{ color: '#4a5568' }}>{new Date(item.scheduled_for + 'Z').toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Published */}
      {published.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#4a5568' }}>
            <Check size={14} />
            Published
            <span className="ml-2 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#4a5568' }}>{published.length}</span>
          </h3>
          {published.map(item => (
            <div key={item.id} className="p-6 rounded-xl flex items-start gap-5 transition-all" style={{ background: '#0e1117', border: '1px solid rgba(45,212,191,0.08)' }}>
              <div className="flex-1">
                <p className="text-sm leading-relaxed mb-3" style={{ color: '#5a6270' }}>{item.body}</p>
                {item.scheduled_for && (
                  <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: '#2d3340' }}>
                    Published {new Date(item.scheduled_for + 'Z').toLocaleString()}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-1"
                  style={{ background: 'rgba(45,212,191,0.08)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }}>
                  <Check size={12} /> Published
                </div>
                {item.tweet_id && !item.tweet_id.startsWith('mock') && !item.tweet_id.startsWith('failed') && (
                  <a
                    href={`https://twitter.com/i/web/status/${item.tweet_id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[10px] transition-colors hover:opacity-80"
                    style={{ color: '#4a5568' }}
                  >
                    View on X ↗
                  </a>
                )}
                {item.tweet_id?.startsWith('mock') && (
                  <span className="text-[10px]" style={{ color: '#2d3340' }}>Mock (no keys)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="p-8 rounded-2xl max-w-sm w-full mx-4" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <Trash2 style={{ color: '#f87171' }} size={24} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#dde1e7', letterSpacing: '-0.01em' }}>Delete Post?</h3>
            <p className="text-sm leading-relaxed mb-8" style={{ color: '#4a5568' }}>This draft will be permanently removed. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setPendingDelete(null)} className="flex-1 py-3 rounded-full text-sm font-medium transition-all" style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5568' }}>Cancel</button>
              <button onClick={() => handleDelete(pendingDelete)} className="flex-1 py-3 rounded-full text-sm font-bold transition-all hover:bg-red-500" style={{ background: '#dc2626', color: '#ffffff' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentWorkspace;
