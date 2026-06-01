# 🪐 BrandOrbit — AI-Driven Multi-Brand Content Operations Platform

<div align="center">

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2F%20Vite-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20v4-38B2AC.svg?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Groq AI](https://img.shields.io/badge/AI-Groq%20LLaMA%203.3-f3a536.svg?style=flat-square&logo=openai&logoColor=white)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

**Automate your brand's entire social media content lifecycle — from live trend detection to AI-written tweets published automatically on Twitter/X.**

[📖 Backend Docs](./backend_documentation.md) · [💻 Frontend Docs](./frontend_documentation.md) · [🚀 Quick Start](#️-quick-start) · [🗺️ Architecture](#️-architecture) · [📡 API Reference](./backend_documentation.md#12-api-endpoints-reference)

</div>

---

## ✨ What is BrandOrbit?

BrandOrbit is a production-ready, AI-first content management and social automation platform built as a Final Year Project. It solves the pain of manual social media management for brands and agencies by connecting:

- 📡 **Live Google Trends** → detects what's buzzing in your niche right now
- 🤖 **Groq LLaMA-3.3-70B AI** (+ Google Gemini fallback) → writes platform-optimised tweets in your brand's exact voice
- ✅ **Human-in-the-loop approvals** → review and refine before anything goes live
- 🗓️ **Smart scheduling engine** → auto-assigns posts to your configured calendar slots
- 🐦 **Twitter/X API v2** → publishes automatically via OAuth 2.0 PKCE, no manual posting needed
- ♾️ **Auto-Pilot mode** → fully autonomous end-to-end pipeline when you want it

---

## 🗺️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REACT FRONTEND                              │
│              Vite · Tailwind v4 · http://localhost:5173             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  REST / JSON
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND  :8000                           │
│                                                                     │
│   Auth  ·  Brand Manager  ·  Content Engine  ·  Admin Panel        │
│                                                                     │
│        APScheduler Daemon — publishes every 30 seconds              │
└────────────┬─────────────────────┬──────────────────┬──────────────┘
             │                     │                  │
             ▼                     ▼                  ▼
     PostgreSQL DB         Groq / Gemini         Twitter/X API v2
      (5 Tables)           LLaMA 3.3-70B         OAuth 2.0 PKCE
                           + pytrends
```

For the full architecture, sequence diagrams, ERD, and API reference see [📖 backend_documentation.md](./backend_documentation.md) and [💻 frontend_documentation.md](./frontend_documentation.md).

---

## 🎨 UI/UX Design — Cosmos Dashboard

BrandOrbit features a **premium dark-mode space aesthetic** purpose-built to feel world-class.

| Feature | Detail |
|---|---|
| **Starfield Background** | Lightweight canvas system with subtle glowing parallax stars |
| **Glassmorphic Navigation** | Floating pill navbar with `backdrop-filter: blur(22px)` and teal neon borders |
| **Neon Teal Accent (`#2dd4bf`)** | Core interactive highlights, glows, loader rings, and active state indicators |
| **Interactive Cards** | Border-glow transitions from dark obsidian to teal on hover |
| **Micro-animations** | Breathing scheduler pulse, spinning generation icons, smooth status transitions |

### Page Highlights

| Page | Highlights |
|---|---|
| **Landing** | Bold hero with dynamic content performance chart, 3-tier pricing grid with teal halo |
| **OTP Verification** | Glassmorphic portal, 5-digit focus-chain input with teal border animation |
| **Dashboard Home** | Telemetry cockpit — scheduled posts, AI generations, active brands with trend capsules |
| **Brand Manager** | Dual-panel: brand identity left, AI Persona Tuning right, suggestion chip clicks, X Connection status |
| **AI Content Workspace** | Trending Topics HUD, AI Generate button with spinner, Draft Board, Status Queue timeline |
| **Schedule Engine** | Step-by-step cadence builder, active day grid, time slot picker, chronological queue |
| **Admin Panel** | Platform stats, user management table, brand quota controls, activity chart |

---

## ⚙️ Core Backend Systems

### 🔐 Authentication & Security
- **JWT Bearer tokens** (`python-jose`, HS256 algorithm) with a 7-day lifetime
- **bcrypt password hashing** (passlib, 12 rounds) — passwords never stored in plain text
- **OTP email verification** — accounts cannot access protected endpoints until the OTP is confirmed
- **PKCE code verifier** — industry-standard protection against authorization code interception

### 🤖 AI Content Pipeline
- **Primary:** Groq LLaMA-3.3-70B — ultra-fast inference, brand-persona-aware prompt engineering
- **Fallback:** Google Gemini Flash — auto-activates if Groq is unavailable
- **Prompt injection:** Brand `niche`, `quirks`, `persona_guidelines`, and the selected trend angle are all injected into the LLM context
- **Daily rate limit:** 4 generation runs per brand per day to prevent API cost runaway

### 📡 Trend Detection
- **pytrends** scrapes Google Trends for the brand's niche (rising queries, last 7 days)
- The LLM then **reframes raw keywords** into compelling, human-readable content angles
- **4-hour server-side cache** per niche prevents hitting Google's rate limits on repeated page loads

### 🗓️ Smart Scheduling & Auto-Pilot
- **`recalculate_queue()`** — walks the brand's active calendar (days + time slots) chronologically from `now()` and assigns real datetime slots to all APPROVED/SCHEDULED items in order
- **`maintain_auto_queue()`** — if `automation_mode = "auto"` and fewer than 3 items are queued, the system auto-fetches drafts or generates new ones via the LLM
- **APScheduler** — `BackgroundScheduler` fires every 30 seconds, picks up all items where `scheduled_for ≤ now()`, auto-refreshes OAuth tokens, publishes to Twitter, increments daily counters

### 📊 Database Design — 5 Tables

```
users ──(1:*)──► brands ──(1:1)──► posting_plans
                   │
                   ├──(1:*)──► content_items
                   └──(1:*)──► validation_rules
```

All foreign key cascades are configured — deleting a user removes all their brands, content, and plans.

---

## 🛣️ API Quick Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create account |
| `POST` | `/api/auth/login` | Public | Login, receive JWT |
| `POST` | `/api/auth/verify-otp` | Public | Confirm OTP code |
| `POST` | `/api/auth/resend-otp` | Public | Regenerate OTP |
| `GET` | `/api/users/me` | Auth | Current user profile |
| `POST` | `/api/brands/` | Verified | Create brand |
| `GET` | `/api/brands/` | Verified | List my brands |
| `GET` | `/api/brands/{id}` | Verified | Get brand detail |
| `PUT` | `/api/brands/{id}` | Verified | Update brand |
| `PUT` | `/api/brands/{id}/mode` | Verified | Set automation mode |
| `GET` | `/api/brands/{id}/plan` | Verified | Get posting plan |
| `POST` | `/api/brands/{id}/plan` | Verified | Save posting plan |
| `GET` | `/api/brands/{id}/trends` | Verified | Fetch live trends |
| `POST` | `/api/brands/{id}/generate` | Verified | AI-generate drafts |
| `GET` | `/api/brands/{id}/content` | Verified | List all content |
| `POST` | `/api/brands/{id}/content` | Verified | Create manual draft |
| `PUT` | `/api/content/{id}` | Verified | Edit draft body |
| `DELETE` | `/api/content/{id}` | Verified | Delete content |
| `POST` | `/api/content/{id}/submit` | Verified | Submit for review |
| `POST` | `/api/content/{id}/approve` | Verified | Approve content |
| `POST` | `/api/content/{id}/reject` | Verified | Reject content |
| `POST` | `/api/content/{id}/schedule` | Verified | Manual schedule |
| `POST` | `/api/content/{id}/smart_schedule` | Verified | Auto-slot into plan |
| `POST` | `/api/content/{id}/approve_and_queue` | Verified | Approve + schedule |
| `POST` | `/api/content/{id}/remove_queue` | Verified | Un-schedule → Draft |
| `POST` | `/api/content/{id}/publish` | Verified | Instant publish |
| `GET` | `/api/auth/twitter/login` | Public | Start X OAuth flow |
| `GET` | `/api/auth/twitter/callback` | Public | X OAuth callback |
| `POST` | `/api/brands/{id}/disconnect` | Public | Disconnect X account |
| `POST` | `/api/brands/{id}/rules` | Public | Add validation rule |
| `GET` | `/api/brands/{id}/rules` | Public | List validation rules |
| `GET` | `/api/admin/stats` | Admin | Platform statistics |
| `GET` | `/api/admin/users` | Admin | All users + brands |
| `PUT` | `/api/admin/users/{id}/role` | Admin | Change user role |
| `DELETE` | `/api/admin/users/{id}` | Admin | Delete user |
| `PUT` | `/api/admin/brands/{id}/quota` | Admin | Override daily limits |

> 📖 Full request/response payloads, error codes, and examples: [backend_documentation.md](./backend_documentation.md#12-api-endpoints-reference)

---

## 🛠️ Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| PostgreSQL | 14+ (via pgAdmin or CLI) |

### Repository Structure

```
My_FYP/
├── backend/
│   ├── main.py                 # FastAPI application (all routes, scheduler, AI & trend logic)
│   ├── auth.py                 # JWT authentication helpers & dependency guards
│   ├── database.py             # SQLAlchemy PostgreSQL engine (pg8000 driver)
│   ├── models.py               # ORM data models (User, Brand, PostingPlan, ContentItem, etc.)
│   ├── schemas.py              # Pydantic request/response validation schemas
│   ├── promote_user.py         # Standalone script to manually promote a user to ADMIN
│   ├── requirements.txt        # Python package dependencies
│   └── .env                    # Backend environment secrets (git-ignored)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.jsx      # Sticky sidebar navigation with role-based visibility
│   │   ├── context/
│   │   │   └── AuthContext.jsx # Authentication state provider (login/register/logout)
│   │   ├── pages/
│   │   │   ├── Landing.jsx          # Public marketing page with Starfield and pricing tiers
│   │   │   ├── Login.jsx            # Authenticated modal login
│   │   │   ├── Register.jsx         # Authenticated modal registration
│   │   │   ├── VerifyOTP.jsx        # 5-digit verification page with email OTP
│   │   │   ├── DashboardHome.jsx    # Telemetry cockpit & manual/auto mode selector
│   │   │   ├── BrandManager.jsx     # Brand identity profile & Twitter connection portal
│   │   │   ├── ContentWorkspace.jsx # AI generation workspace & trending topics hub
│   │   │   ├── ScheduleEngine.jsx   # Day & time slot configuration & post queue builder
│   │   │   └── AdminPanel.jsx       # Admin user list, quota controls & brand inspector
│   │   ├── App.css             # Global component styles
│   │   ├── App.jsx             # Root component with routing, guards, and layout
│   │   ├── api.js              # Axios instance with request/response JWT interceptors
│   │   ├── index.css           # TailwindCSS base styles
│   │   └── main.jsx            # React 19 entry point
│   ├── package.json            # Node.js dependencies & scripts
│   └── vite.config.js          # Vite build configuration with React plugin
├── backend_documentation.md    # Full technical backend documentation
├── frontend_documentation.md   # Full technical frontend documentation
└── README.md                   # Main project overview and setup guide
```

---

### 1️⃣ Database Setup (PostgreSQL)

1. Open **pgAdmin** and create a new database named `brandorbit`
2. Note your connection details (host, port, user, password)

---

### 2️⃣ Backend Setup

```powershell
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install all Python dependencies
pip install -r requirements.txt
```

Create `backend/.env` and fill in your values:

```env
# Required
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/brandorbit
GEMINI_API_KEY=your_google_gemini_api_key

# Recommended — for faster AI inference (falls back to Gemini if absent)
GROQ_API_KEY=your_groq_api_key

# Required for Twitter/X publishing
TWITTER_CLIENT_ID=your_twitter_oauth2_client_id
TWITTER_CLIENT_SECRET=your_twitter_oauth2_client_secret

# Optional — Gmail SMTP for OTP delivery (OTPs print to terminal if unset)
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password

# Optional — override the default dev key in production!
SECRET_KEY=your_openssl_rand_hex_32_output
```

Start the backend server:

```powershell
uvicorn main:app --reload
```

> ✅ API will be live at `http://127.0.0.1:8000`  
> 📖 Interactive docs at `http://127.0.0.1:8000/docs`

The database tables are created automatically on first startup via `Base.metadata.create_all(bind=engine)`.

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

> ✅ App will be live at `http://localhost:5173`

---

## 🔒 Security Notes

| Concern | Implementation |
|---|---|
| Passwords | Never stored — bcrypt-hashed with 12 rounds |
| JWT Tokens | HS256-signed, 7-day expiry, validated on every protected request |
| OAuth Tokens | Stored in DB; access tokens auto-refreshed 5 minutes before expiry |
| PKCE | SHA-256 code challenge prevents authorization code interception |
| Multi-tenancy | Every brand query includes `owner_id = current_user.id` filter |
| Rate Limits | 4 AI generations/day and 3 published posts/day per brand |
| Secret Key | Must be overridden with `openssl rand -hex 32` output in production |
| `.env` files | All `.env` variants are git-ignored |

---

## 📋 Rate Limits

| Resource | Limit | Reset |
|---|---|---|
| AI Content Generation | 4 runs / brand / day | Midnight UTC |
| Social Publishing | 3 posts / brand / day | Midnight UTC |
| Scheduler Poll | Every 30 seconds | N/A |
| Trend Cache | 4-hour TTL per niche | Rolling |
| JWT Lifetime | 7 days | On expiry |

---

## 🏆 Project Team

BrandOrbit was designed and built as a Final Year Project to solve real-world AI-driven social content coordination challenges.

For help or questions, please open a GitHub Issue.

> *"Who said content management has to be boring?"* — **Launch BrandOrbit and automate with precision!**