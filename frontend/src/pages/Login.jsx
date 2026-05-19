import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, X } from 'lucide-react';
import logo from '../assets/HorizontalLogo.svg';

const LoginModal = ({ onClose, onSwitchToRegister }) => {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 401) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError('Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="relative w-full max-w-sm px-4">
        {/* Card */}
        <div className="p-8 rounded-2xl relative" style={{
          background: 'rgba(14,17,23,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
          
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logo} alt="BrandOrbit" className="h-10 opacity-85" />
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: '#dde1e7', letterSpacing: '-0.01em' }}>
            Welcome back
          </h1>
          <p className="text-sm mb-8" style={{ color: '#4a5568' }}>Sign in to manage your brands</p>

          {error && (
            <div className="px-4 py-3 rounded-xl mb-6 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#dde1e7',
                }}
                onFocus={e  => { e.target.style.border = '1px solid rgba(45,212,191,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(45,212,191,0.08)'; }}
                onBlur={e   => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#4a5568' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#dde1e7',
                  }}
                  onFocus={e => { e.target.style.border = '1px solid rgba(45,212,191,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(45,212,191,0.08)'; }}
                  onBlur={e  => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors"
                  style={{ color: '#4a5568' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-sm font-bold transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#2dd4bf', color: '#071012' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(7,16,18,0.3)', borderTopColor: '#071012' }} />
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#3d4450' }}>
            Don&apos;t have an account?{' '}
            <button onClick={onSwitchToRegister} type="button" className="font-medium transition-colors hover:opacity-80" style={{ color: '#2dd4bf' }}>
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
