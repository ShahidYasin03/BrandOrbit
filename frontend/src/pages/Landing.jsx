import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3, BrainCircuit, Shield, TrendingUp,
  CalendarClock, Zap, Check, Star, ArrowDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/HorizontalLogo.svg';
import LoginModal from './Login';
import RegisterModal from './Register';

/* ── Star Field ─────────────────────────────────────────────── */
const StarField = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.1 + 0.2,
      baseAlpha: Math.random() * 0.4 + 0.1,
      speed: Math.random() * 0.005 + 0.002,
      offset: Math.random() * Math.PI * 2,
    }));
    let t = 0;
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        const alpha = s.baseAlpha + Math.sin(t * s.speed * 60 + s.offset) * 0.15;
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

/* ── Static Grid with edge fades ───────────────────────────── */
const Grid = () => (
  <div
    className="fixed inset-0 z-0 pointer-events-none"
    style={{
      backgroundImage: `
        linear-gradient(to right,  rgba(255,255,255,0.042) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,0.042) 1px, transparent 1px)
      `,
      backgroundSize: '55px 55px',
      WebkitMaskImage: `
        linear-gradient(to bottom,
          transparent 0%,
          rgba(0,0,0,0.15) 12%,
          rgba(0,0,0,0.6) 26%,
          black 38%,
          black 70%,
          rgba(0,0,0,0.35) 100%
        ),
        linear-gradient(to right,
          rgba(0,0,0,0.08) 0%,
          black 8%,
          black 92%,
          rgba(0,0,0,0.08) 100%
        )
      `,
      WebkitMaskComposite: 'destination-in',
      maskImage: `
        linear-gradient(to bottom,
          transparent 0%,
          rgba(0,0,0,0.15) 12%,
          rgba(0,0,0,0.6) 26%,
          black 38%,
          black 70%,
          rgba(0,0,0,0.35) 100%
        ),
        linear-gradient(to right,
          rgba(0,0,0,0.08) 0%,
          black 8%,
          black 92%,
          rgba(0,0,0,0.08) 100%
        )
      `,
      maskComposite: 'intersect',
    }}
  />
);

/* ── Floating Centre Pill Nav ───────────────────────────────── */
const FloatingNav = ({ active, onNav }) => {
  const links = [
    ['Home', 'home'],
    ['Features', 'features'],
    ['Pricing', 'pricing'],
    ['About', 'about'],
  ];
  return (
    <nav
      className="fixed z-50"
      style={{ top: 20, left: '50%', transform: 'translateX(-50%)' }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded-full"
        style={{
          background: 'rgba(10,11,16,0.72)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {links.map(([label, id]) => {
          const isActive = active === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              onClick={e => { e.preventDefault(); onNav(id); }}
              className="relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap"
              style={{
                color: isActive ? '#e8eaed' : '#5a6270',
                background: isActive ? 'rgba(255,255,255,0.11)' : 'transparent',
                boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
              }}
            >
              {label}
            </a>
          );
        })}
      </div>
    </nav>
  );
};

/* ── Dashboard Mockup ───────────────────────────────────────── */
const DashMockup = () => (
  <div
    className="w-full max-w-4xl mx-auto mt-20 rounded-2xl overflow-hidden border border-white/[0.07] shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
    style={{ background: '#0d1117' }}
  >
    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
      <div className="w-3 h-3 rounded-full bg-red-500/70" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
      <div className="w-3 h-3 rounded-full bg-green-500/70" />
      <div className="ml-4 flex-1 h-6 rounded bg-white/[0.04] max-w-xs" />
    </div>
    <div className="flex" style={{ height: 320 }}>
      <div className="w-44 border-r border-white/[0.05] p-4 flex flex-col gap-2">
        {['Brands', 'Content', 'Schedule', 'Analytics', 'Settings'].map((item, i) => (
          <div key={i} className={`px-3 py-2 rounded-lg text-xs font-medium ${i === 0 ? 'bg-white/[0.08] text-white' : 'text-zinc-600'}`}>
            {item}
          </div>
        ))}
      </div>
      <div className="flex-1 p-6 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Scheduled Posts', val: '142', change: '+12%' },
            { label: 'AI Generations',  val: '3.8k', change: '+27%' },
            { label: 'Brands Active',   val: '5',    change: '100%' },
          ].map((card, i) => (
            <div key={i} className="rounded-xl p-3 border border-white/[0.05]" style={{ background: '#13181f' }}>
              <p className="text-[10px] text-zinc-500 mb-1">{card.label}</p>
              <p className="text-xl font-bold text-white">{card.val}</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400">{card.change}</span>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-xl border border-white/[0.05] p-4" style={{ background: '#13181f' }}>
          <p className="text-[10px] text-zinc-500 mb-3">Content Performance</p>
          <svg viewBox="0 0 400 80" className="w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,60 C40,50 80,30 120,35 C160,40 200,20 240,25 C280,30 320,15 360,18 L400,15 L400,80 L0,80 Z" fill="url(#cg)" />
            <path d="M0,60 C40,50 80,30 120,35 C160,40 200,20 240,25 C280,30 320,15 360,18 L400,15" fill="none" stroke="#2dd4bf" strokeWidth="1.5" />
            <path d="M0,70 C60,65 120,55 180,58 C240,61 300,45 400,50" fill="none" stroke="#334155" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>
  </div>
);

/* ── Main ───────────────────────────────────────────────────── */
const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');
  const [searchParams, setSearchParams] = useSearchParams();
  const authModal = searchParams.get('modal');

  const openModal = (type) => setSearchParams({ modal: type });
  const closeModal = () => setSearchParams({});

  // Lock body scroll when modal is open
  useEffect(() => {
    if (authModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [authModal]);

  /* Active section via IntersectionObserver */
  useEffect(() => {
    const ids = ['home', 'features', 'pricing', 'about'];
    const observers = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: '-35% 0px -60% 0px' }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  const handleNav = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollTo = (e, id) => { e.preventDefault(); handleNav(id); };

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ background: '#08090c' }}>
      <StarField />
      <Grid />

      {/* Floating centre pill — fixed, always visible */}
      <FloatingNav active={activeSection} onNav={handleNav} />

      {/* ── Scrolling header (logo + auth) ── scrolls away with page */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
        <Link to="/">
          <img src={logo} alt="BrandOrbit" className="h-11 w-auto opacity-90 hover:opacity-100 transition-opacity" />
        </Link>

        <div className="flex items-center gap-3">
          {!user ? (
            <>
              <button
                onClick={() => openModal('login')}
                className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:block"
              >
                Log in
              </button>
              <button
                onClick={() => openModal('register')}
                className="text-sm font-medium text-white px-5 py-2 rounded-full transition-all hover:opacity-80"
                style={{ background: '#18191e', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Sign up
              </button>
            </>
          ) : (
            <Link
              to="/dashboard"
              className="text-sm font-medium text-white px-5 py-2 rounded-full transition-all hover:opacity-80"
              style={{ background: '#18191e', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Dashboard
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <main id="home" className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-24">
        <h1
          className="text-5xl md:text-7xl lg:text-[80px] font-bold tracking-tight max-w-4xl leading-[1.08] mb-7"
          style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}
        >
          Manage your brands with AI precision
        </h1>

        <p className="text-base md:text-lg max-w-lg leading-relaxed mb-10" style={{ color: '#5a6270' }}>
          Automate your content pipeline, enforce brand guidelines, and schedule posts
          across all your social channels — simple, intuitive, and never boring.
        </p>

        <div className="flex flex-col items-center gap-5">
          <button
            onClick={() => openModal('register')}
            className="text-sm font-semibold text-white px-8 py-3.5 rounded-full transition-all hover:opacity-80"
            style={{ background: '#18191e', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Get started free
          </button>
          <a
            href="#features"
            onClick={e => scrollTo(e, 'features')}
            className="flex flex-col items-center gap-1 group"
            style={{ color: '#3d4450' }}
          >
            <span className="text-sm hover:text-zinc-400 transition-colors">Learn more</span>
            <ArrowDown size={15} className="group-hover:translate-y-0.5 transition-transform" />
          </a>
        </div>

        <DashMockup />
      </main>

      {/* ── "Who said..." ── */}
      <section className="relative z-10 py-32 px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-6xl font-bold leading-tight" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>
              Who said content<br />has to be boring?
            </h2>
          </div>
          <div>
            <p className="text-base leading-relaxed" style={{ color: '#5a6270' }}>
              With BrandOrbit, managing your brand&apos;s content is effortless, empowering,
              and anything but boring. Our intuitive platform brings clarity to your workflow,
              simplifies publishing decisions, and puts the power of advanced AI right at your
              fingertips.{' '}
              <strong style={{ color: '#8b949e' }}>Say no to spreadsheets and tools designed in the past.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-20 px-8 max-w-7xl mx-auto w-full">
        <div className="mb-16">
          <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-6" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>
            Everything you need.<br />Nothing you don&apos;t.
          </h2>
          <p className="text-base max-w-lg leading-relaxed" style={{ color: '#5a6270' }}>
            Content management and AI visibility in one place. Experience a{' '}
            <strong style={{ color: '#8b949e' }}>flexible toolkit</strong> that makes every task feel like a breeze.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <BrainCircuit size={20} />, title: 'AI Generation',       desc: "Generate context-aware content based on trending topics and your brand's unique tone and voice guidelines." },
            { icon: <BarChart3 size={20} />,    title: 'Multi-Brand Control', desc: 'Isolate and manage multiple brand personas from one unified, secure account with per-brand analytics.' },
            { icon: <Shield size={20} />,        title: 'Approval Workflows',  desc: 'Human-in-the-loop review pipelines and validation rules ensure nothing goes live without sign-off.' },
            { icon: <TrendingUp size={20} />,   title: 'Trend Intelligence',   desc: 'Real-time niche trend detection that feeds directly into your content generation pipeline automatically.' },
            { icon: <CalendarClock size={20} />,title: 'Smart Scheduling',     desc: 'Configure posting cadence once — the engine auto-slots every approved post into the next available slot.' },
            { icon: <Zap size={20} />,           title: 'Auto-Pilot Mode',     desc: 'Full automation: AI generates, queues, and publishes on schedule while you stay in the loop as supervisor.' },
          ].map(({ icon, title, desc }, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 cursor-default"
              style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.055)' }}
              onMouseEnter={e => {
                e.currentTarget.style.border     = '1px solid rgba(45,212,191,0.38)';
                e.currentTarget.style.boxShadow  = '0 0 36px rgba(45,212,191,0.13), 0 8px 24px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border     = '1px solid rgba(255,255,255,0.055)';
                e.currentTarget.style.boxShadow  = 'none';
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-5"
                style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.15)', color: '#2dd4bf' }}
              >
                {icon}
              </div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#cdd5de' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#4a5568' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-32 px-8 max-w-7xl mx-auto w-full">
        <div className="mb-16 text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: '#dde1e7', letterSpacing: '-0.02em' }}>
            Simple pricing.
          </h2>
          <p className="text-base" style={{ color: '#5a6270' }}>Start free. Upgrade when your content empire demands it.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {/* Starter */}
          <div className="p-7 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.055)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#4a5568' }}>Starter</p>
            <p className="text-4xl font-bold mb-1" style={{ color: '#dde1e7' }}>$0</p>
            <p className="text-sm mb-7" style={{ color: '#4a5568' }}>per month</p>
            <ul className="space-y-3 mb-8">
              {['1 Brand Profile', '50 AI Generations/mo', 'Basic Analytics', 'Manual Publishing'].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#5a6270' }}>
                  <Check size={13} style={{ color: '#2dd4bf' }} />{f}
                </li>
              ))}
            </ul>
            <button onClick={() => openModal('register')} className="block text-center w-full py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
              style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', color: '#8b949e' }}>
              Get started
            </button>
          </div>

          {/* Pro */}
          <div className="p-7 rounded-2xl relative" style={{ background: '#0e1622', border: '1px solid rgba(45,212,191,0.25)', boxShadow: '0 0 50px rgba(45,212,191,0.05)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1"
              style={{ background: '#2dd4bf', color: '#071012' }}>
              <Star size={10} fill="currentColor" /> Most popular
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#2dd4bf' }}>Professional</p>
            <p className="text-4xl font-bold mb-1" style={{ color: '#dde1e7' }}>$29</p>
            <p className="text-sm mb-7" style={{ color: '#4a5568' }}>per month</p>
            <ul className="space-y-3 mb-8">
              {['5 Brand Profiles', 'Unlimited AI Generations', 'Advanced Analytics', 'Auto-scheduling & Posting', 'Priority Support'].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#8b949e' }}>
                  <Check size={13} style={{ color: '#2dd4bf' }} />{f}
                </li>
              ))}
            </ul>
            <button onClick={() => openModal('register')} className="block text-center w-full py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-90"
              style={{ background: '#2dd4bf', color: '#071012' }}>
              Upgrade to Pro
            </button>
          </div>

          {/* Enterprise */}
          <div className="p-7 rounded-2xl" style={{ background: '#0e1117', border: '1px solid rgba(255,255,255,0.055)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#4a5568' }}>Enterprise</p>
            <p className="text-4xl font-bold mb-1" style={{ color: '#dde1e7' }}>Custom</p>
            <p className="text-sm mb-7" style={{ color: '#4a5568' }}>contact us</p>
            <ul className="space-y-3 mb-8">
              {['Unlimited Brands', 'Custom AI Models', 'API Access', 'Dedicated Account Manager', 'White-label Dashboard'].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#5a6270' }}>
                  <Check size={13} style={{ color: '#2dd4bf' }} />{f}
                </li>
              ))}
            </ul>
            <button className="w-full py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-80"
              style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', color: '#8b949e' }}>
              Contact sales
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="about" className="relative z-10 mt-auto w-full pt-16 pb-10"
        style={{ background: '#06070a', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
            <div className="md:col-span-2">
              <img src={logo} alt="BrandOrbit" className="h-12 w-auto mb-5 opacity-70" />
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: '#3d4450' }}>
                BrandOrbit is the definitive AI-driven Content Management System for creators and agencies who refuse to be boring.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#2dd4bf' }}>Product</p>
              <ul className="space-y-3">
                {[['Features', 'features'], ['Pricing', 'pricing']].map(([label, id]) => (
                  <li key={id}>
                    <a href={`#${id}`} onClick={e => scrollTo(e, id)}
                      className="text-sm transition-colors hover:text-zinc-300" style={{ color: '#3d4450' }}>{label}</a>
                  </li>
                ))}
                {[['Setup Guide', '/brands'], ['Dashboard', '/dashboard']].map(([label, to]) => (
                  <li key={to}>
                    <Link to={to} className="text-sm transition-colors hover:text-zinc-300" style={{ color: '#3d4450' }}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: '#2dd4bf' }}>Company</p>
              <ul className="space-y-3">
                {['About Us', 'Careers', 'Privacy Policy', 'Terms of Service'].map(label => (
                  <li key={label}>
                    <a href="#" className="text-sm transition-colors hover:text-zinc-300" style={{ color: '#3d4450' }}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs" style={{ color: '#2a2f38', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '2rem' }}>
            &copy; {new Date().getFullYear()} BrandOrbit Inc. All rights reserved.
          </p>
        </div>
      </footer>

      {authModal === 'login' && <LoginModal onClose={closeModal} onSwitchToRegister={() => openModal('register')} />}
      {authModal === 'register' && <RegisterModal onClose={closeModal} onSwitchToLogin={() => openModal('login')} />}
    </div>
  );
};

export default Landing;
