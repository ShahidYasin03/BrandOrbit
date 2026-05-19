import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import logo from '../assets/HorizontalLogo.svg';

const StarField = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.2,
      baseAlpha: Math.random() * 0.35 + 0.08,
      speed: Math.random() * 0.005 + 0.002,
      offset: Math.random() * Math.PI * 2,
    }));
    let t = 0;
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const alpha = s.baseAlpha + Math.sin(t * s.speed * 60 + s.offset) * 0.12;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,225,255,${Math.max(0, alpha)})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

const VerifyOTP = () => {
  const navigate = useNavigate();

  const handleVerify = (e) => {
    e.preventDefault();
    // TODO: Implement actual OTP verification with backend
    alert("OTP Verification is coming soon! For now, you can proceed to the dashboard.");
    navigate('/dashboard');
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#dde1e7',
  };
  const focusOn  = e => { e.target.style.border = '1px solid rgba(45,212,191,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(45,212,191,0.08)'; };
  const focusOff = e => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#08090c' }}>
      <StarField />

      {/* Static grid */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right,  rgba(255,255,255,0.038) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.038) 1px, transparent 1px)
        `,
        backgroundSize: '55px 55px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
        maskImage:       'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
      }} />

      <Link to="/register"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-medium transition-colors group"
        style={{ color: '#4a5568' }}>
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="hover:text-zinc-300 transition-colors">Back to sign up</span>
      </Link>

      <div className="relative z-10 w-full max-w-md px-4 py-12">
        <div className="flex justify-center mb-8">
          <img src={logo} alt="BrandOrbit" className="h-10 opacity-85" />
        </div>

        <div className="p-10 rounded-2xl text-center" style={{
          background: 'rgba(14,17,23,0.85)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)' }}>
            <Mail style={{ color: '#2dd4bf' }} size={32} />
          </div>
          
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#dde1e7', letterSpacing: '-0.01em' }}>Check your email</h2>
          <p className="text-sm mb-8" style={{ color: '#4a5568' }}>
            We&apos;ve sent a verification code to your email. Please enter it below.
          </p>

          <form onSubmit={handleVerify} className="space-y-8">
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((digit) => (
                <input
                  key={digit}
                  type="text"
                  maxLength="1"
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-all"
                  style={inputStyle}
                  onFocus={focusOn}
                  onBlur={focusOff}
                  placeholder="-"
                />
              ))}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2"
              style={{ background: '#2dd4bf', color: '#071012' }}
            >
              Verify Account
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="mt-8 text-sm" style={{ color: '#3d4450' }}>
            Didn&apos;t receive the code?{' '}
            <button 
              onClick={() => alert('Resend OTP logic coming soon!')}
              className="font-medium transition-colors hover:opacity-80"
              style={{ color: '#2dd4bf' }}
            >
              Click to resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
