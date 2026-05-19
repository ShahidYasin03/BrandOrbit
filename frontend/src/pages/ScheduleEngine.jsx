import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { CalendarDays, Clock, Zap, Target, Save, CheckCircle2, Activity, Trash2, Send, ListOrdered } from 'lucide-react';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const ScheduleEngine = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const brandId = id || 1;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [activeBrand, setActiveBrand] = useState(null);
  const [queue, setQueue] = useState([]);
  
  const [activeDays, setActiveDays] = useState([]);
  const [timeSlots, setTimeSlots] = useState(["09:00"]);
  const [volume, setVolume] = useState("chill");
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/brands/${brandId}`),
      api.get(`/brands/${brandId}/plan`).catch(() => ({ data: null })),
    ]).then(([brandRes, planRes]) => {
      setActiveBrand(brandRes.data);
      if (planRes.data) {
        setActiveDays(planRes.data.active_days || []);
        setTimeSlots(planRes.data.time_slots || ["09:00"]);
        setVolume(planRes.data.volume || "chill");
      }
    }).catch(console.error)
      .finally(() => setLoading(false));

    fetchQueue();
    return () => clearTimeout(refreshTimerRef.current);
  }, [brandId]);

  function fetchQueue() {
    api.get(`/brands/${brandId}/content`)
      .then(res => {
        if (res.data) {
          const scheduled = res.data.filter(i => i.status === 'SCHEDULED');
          scheduled.sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
          setQueue(scheduled);

          // Schedule a precise refresh just after the next post is due
          clearTimeout(refreshTimerRef.current);
          const now = Date.now();
          const nextDue = scheduled
            .map(i => new Date(i.scheduled_for + 'Z').getTime())
            .filter(t => t > now)
            .sort((a, b) => a - b)[0];

          if (nextDue) {
            // Wait until 35s after the slot (gives the 30s backend scheduler time to fire)
            const delay = (nextDue - now) + 35000;
            refreshTimerRef.current = setTimeout(fetchQueue, delay);
          }
        }
      })
      .catch(console.error);
  }

  const handleRemoveFromQueue = (contentId) => {
    api.post(`/content/${contentId}/remove_queue`)
      .then(() => fetchQueue())
      .catch(() => alert('Failed to remove from queue'));
  };

  const toggleDay = (day) => {
    setActiveDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const addTimeSlot = () => {
    if (timeSlots.length < 3) setTimeSlots([...timeSlots, "12:00"]);
  };

  const removeTimeSlot = (index) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index, value) => {
    const newSlots = [...timeSlots];
    newSlots[index] = value;
    setTimeSlots(newSlots);
  };

  const handleSave = () => {
    setSaving(true);
    api.post(`/brands/${brandId}/plan`, { active_days: activeDays, time_slots: timeSlots, volume })
      .then(() => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        fetchQueue();
      })
      .catch(err => {
        console.error(err);
        alert("Failed to save schedule.");
      })
      .finally(() => setSaving(false));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(45,212,191,0.2)', borderTopColor: '#2dd4bf' }} />
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#4a5568' }}>Initializing Engine...</p>
    </div>
  );

  const isManual = activeBrand?.automation_mode === 'manual';
  const hasTwitterSetup = Boolean(activeBrand?.twitter_api_key && activeBrand?.twitter_access_token);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
          <CalendarDays style={{ color: '#2dd4bf' }} size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>Schedule Engine</h2>
          <p className="text-sm mt-1" style={{ color: '#4a5568' }}>
            {isManual ? 'Manual Queue — you fill the slots' : 'Auto-Pilot — AI fills the slots'}
          </p>
        </div>
        <div className="ml-auto px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
          style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)', color: '#2dd4bf' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
          {isManual ? 'Manual Mode' : 'Auto-Pilot Active'}
        </div>
      </div>

      {/* QUEUE PANEL */}
      <div className="p-8 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <ListOrdered style={{ color: '#4a5568' }} size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#dde1e7' }}>Upcoming Queue</h3>
              <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: '#2d3340' }}>
                {queue.length === 0 ? 'No posts scheduled' : `${queue.length} post${queue.length > 1 ? 's' : ''} queued`}
              </p>
            </div>
          </div>
          {isManual && (
            <button
              onClick={() => navigate(`/workspace/${brandId}`)}
              className="px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2"
              style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,212,191,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,212,191,0.08)'}
            >
              + Add from Workspace
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
            <Send className="mx-auto mb-4 opacity-20" size={40} style={{ color: '#4a5568' }} />
            <p className="text-sm font-medium" style={{ color: '#4a5568' }}>Your queue is empty.</p>
            <p className="text-[10px] uppercase tracking-widest mt-2" style={{ color: '#2d3340' }}>
              {isManual ? 'Approve a post in the Workspace to fill slots.' : 'Save your plan to enable AI filling.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item, idx) => {
              const scheduledDate = new Date(item.scheduled_for);
              const isUpNext = idx === 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center gap-6 p-6 rounded-2xl border transition-all duration-200"
                  style={{
                    background: isUpNext ? 'rgba(45,212,191,0.03)' : 'rgba(255,255,255,0.01)',
                    border: isUpNext ? '1px solid rgba(45,212,191,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex flex-col justify-center min-w-[140px]">
                    {isUpNext && (
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: '#2dd4bf' }}>
                        <div className="w-1 h-1 rounded-full bg-teal-400 animate-pulse" /> Up Next
                      </span>
                    )}
                    {!isUpNext && (
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#2d3340' }}>Slot {idx + 1}</span>
                    )}
                    <span className="text-sm font-bold" style={{ color: '#dde1e7' }}>{scheduledDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="text-xs mt-1" style={{ color: '#4a5568' }}>{scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex-1 p-4 rounded-xl text-sm leading-relaxed" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', color: '#8b949e' }}>
                    {item.body}
                  </div>
                  <button
                    onClick={() => handleRemoveFromQueue(item.id)}
                    className="p-3 rounded-xl transition-all shrink-0"
                    style={{ color: '#2d3340' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#2d3340'; e.currentTarget.style.background = 'transparent'; }}
                    title="Remove from Queue"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFIG PANEL */}
      <div className="p-8 rounded-2xl relative overflow-hidden space-y-12" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-50"
          style={{ background: 'rgba(45,212,191,0.03)' }}></div>

        {/* Step 1: Days */}
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}>1</span>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#dde1e7' }}>Active Posting Days</h3>
          </div>
          <div className="flex flex-wrap gap-2 ml-12">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-200"
                style={{
                  background: activeDays.includes(day) ? '#2dd4bf' : 'rgba(255,255,255,0.02)',
                  color:      activeDays.includes(day) ? '#071012' : '#4a5568',
                  border:     activeDays.includes(day) ? '1px solid #2dd4bf' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {day.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Times */}
        <div className="relative z-10 pt-10 border-t border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}>2</span>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#dde1e7' }}>Daily Time Slots</h3>
          </div>
          <div className="space-y-4 ml-12">
            {timeSlots.map((slot, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="relative">
                  <Clock size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#4a5568' }} />
                  <input
                    type="time"
                    value={slot}
                    onChange={(e) => updateTimeSlot(idx, e.target.value)}
                    className="pl-11 pr-5 py-3 rounded-xl text-sm font-medium outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#dde1e7' }}
                    onFocus={e => e.target.style.border = '1px solid rgba(45,212,191,0.4)'}
                    onBlur={e => e.target.style.border = '1px solid rgba(255,255,255,0.08)'}
                  />
                </div>
                {timeSlots.length > 1 && (
                  <button onClick={() => removeTimeSlot(idx)} className="text-[10px] font-bold uppercase tracking-widest transition-colors" style={{ color: '#2d3340' }} onMouseEnter={e => e.currentTarget.style.color = '#f87171'} onMouseLeave={e => e.currentTarget.style.color = '#2d3340'}>Remove</button>
                )}
              </div>
            ))}
            {timeSlots.length < 3 && (
              <button onClick={addTimeSlot} className="text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2 transition-all" style={{ color: '#2dd4bf' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.8'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                + Add Slot
              </button>
            )}
          </div>
        </div>

        {/* Step 3: Volume */}
        {!isManual && (
          <div className="relative z-10 pt-10 border-t border-white/5">
            <div className="flex items-center gap-4 mb-6">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.2)', color: '#2dd4bf' }}>3</span>
              <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: '#dde1e7' }}>AI Volume</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-12">
              {[
                { key: 'chill', label: 'Chill', desc: '1 slot daily', Icon: Target },
                { key: 'growth', label: 'Growth', desc: '2 slots daily', Icon: Zap },
                { key: 'viral', label: 'Viral', desc: 'All 3 slots daily', Icon: Activity },
              ].map(({ key, label, desc, Icon }) => (
                <div
                  key={key}
                  onClick={() => setVolume(key)}
                  className="p-6 rounded-2xl cursor-pointer transition-all duration-300"
                  style={{
                    background: volume === key ? 'rgba(45,212,191,0.04)' : 'rgba(255,255,255,0.01)',
                    border: volume === key ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Icon className="mb-4 transition-colors" style={{ color: volume === key ? '#2dd4bf' : '#2d3340' }} size={20} />
                  <h4 className="text-sm font-bold" style={{ color: volume === key ? '#dde1e7' : '#4a5568' }}>{label}</h4>
                  <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: volume === key ? '#2dd4bf' : '#2d3340' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Bar */}
      <div className="flex justify-between items-center px-8 py-5 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          {success && (
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#2dd4bf' }}>
              <CheckCircle2 size={14} /> Schedule saved successfully
            </span>
          )}
          {!hasTwitterSetup && !success && (
            <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#f87171' }}>
              ⚠️ X Account Not Connected - Please setup in Brand Settings first
            </span>
          )}
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors" style={{ color: '#4a5568' }} onMouseEnter={e => e.currentTarget.style.color = '#dde1e7'} onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}>
            Back
          </button>
          <button
            onClick={hasTwitterSetup ? handleSave : () => alert('Please add X account keys in Brand Manager to start posting.')}
            disabled={saving || activeDays.length === 0 || !hasTwitterSetup}
            className="px-8 py-3 rounded-full text-sm font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            style={{ background: '#2dd4bf', color: '#071012', boxShadow: '0 8px 24px rgba(45,212,191,0.2)' }}
            title={!hasTwitterSetup ? "X Account Not Connected" : ""}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleEngine;