# BrandOrbit — Frontend Documentation

**Project**: AI-Driven Multi-Brand Content Management System  
**Technology Stack**: React 19 · Vite · React Router DOM v7 · Axios · TailwindCSS v4 · Lucide Icons  
**Entry Point**: `frontend/src/main.jsx`  
**Dev Server** (default): `http://localhost:5173`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project File Structure](#2-project-file-structure)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [Application Entry Point](#4-application-entry-point)
5. [Routing & Navigation](#5-routing--navigation)
6. [Authentication Context](#6-authentication-context)
7. [API Client (axios)](#7-api-client-axios)
8. [Visual Design System](#8-visual-design-system)
9. [Components](#9-components)
    - [Navbar](#91-navbar)
10. [Pages](#10-pages)
    - [Landing](#101-landing-page)
    - [Login Modal](#102-login-modal)
    - [Register Modal](#103-register-modal)
    - [VerifyOTP](#104-verifyotp-page)
    - [DashboardHome](#105-dashboardhome-page)
    - [BrandManager](#106-brandmanager-page)
    - [ContentWorkspace](#107-contentworkspace-page)
    - [ScheduleEngine](#108-scheduleengine-page)
    - [AdminPanel](#109-adminpanel-page)
11. [Route Guards](#11-route-guards)
12. [Dashboard Layout](#12-dashboard-layout)
13. [State Management Patterns](#13-state-management-patterns)
14. [Error Handling Patterns](#14-error-handling-patterns)
15. [Running the Frontend](#15-running-the-frontend)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                  React 19 Application                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │               AuthProvider (Context)             │    │
│  │   user state · login() · register() · logout()   │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │           React Router DOM v7 (BrowserRouter)    │    │
│  │                                                  │    │
│  │  Public:      /  ·  /verify-otp                 │    │
│  │  Protected:   /dashboard  /brands  /workspace    │    │
│  │               /schedule  /admin                  │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │              DashboardLayout (HOC)               │    │
│  │  Animated star field canvas + grid overlay       │    │
│  │  Navbar (sidebar) + main content area            │    │
│  └──────────────────────────────────────────────────┘    │
│                          │                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │               Axios API Client                   │    │
│  │  baseURL: http://localhost:8000/api              │    │
│  │  Request interceptor: auto-attach JWT            │    │
│  │  Response interceptor: auto-logout on 401        │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Project File Structure

```
frontend/
├── index.html              # Root HTML shell
├── vite.config.js          # Vite build config with React plugin
├── package.json            # Dependencies & npm scripts
├── eslint.config.js        # ESLint configuration
└── src/
    ├── main.jsx            # React DOM root mount
    ├── App.jsx             # Root component: routing, route guards, layout
    ├── api.js              # Axios instance with interceptors
    ├── App.css             # Global component styles
    ├── index.css           # TailwindCSS base styles
    ├── assets/
    │   └── HorizontalLogo.svg   # BrandOrbit logo
    ├── context/
    │   └── AuthContext.jsx      # Authentication state & methods
    ├── components/
    │   └── Navbar.jsx           # Sidebar navigation component
    └── pages/
        ├── Landing.jsx          # Public marketing landing page
        ├── Login.jsx            # Login modal component
        ├── Register.jsx         # Registration modal component
        ├── VerifyOTP.jsx        # OTP verification page
        ├── DashboardHome.jsx    # Dashboard overview & mode selector
        ├── BrandManager.jsx     # Brand profile management
        ├── ContentWorkspace.jsx # AI content generation & review
        ├── ScheduleEngine.jsx   # Post scheduling & queue management
        └── AdminPanel.jsx       # Admin control center
```

---

## 3. Tech Stack & Dependencies

### Runtime Dependencies
| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.6 | UI component library |
| `react-dom` | ^19.2.6 | DOM renderer |

### Dev Dependencies (also used at runtime via Vite)
| Package | Version | Purpose |
|---|---|---|
| `vite` | ^8.0.12 | Build tool & dev server |
| `@vitejs/plugin-react` | ^6.0.1 | React Fast Refresh |
| `react-router-dom` | ^7.15.0 | Client-side routing |
| `axios` | ^1.16.1 | HTTP client |
| `lucide-react` | ^1.14.0 | SVG icon library |
| `tailwindcss` | ^4.3.0 | Utility-first CSS |
| `@tailwindcss/vite` | ^4.3.0 | Tailwind Vite integration |

---

## 4. Application Entry Point

**File**: [`main.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/main.jsx)

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Mounts the React application into `<div id="root">` in `index.html`. React 19's `createRoot` API is used.

---

## 5. Routing & Navigation

**File**: [`App.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/App.jsx)

### Route Map

| Path | Component | Guard | Layout |
|---|---|---|---|
| `/` | `Landing` | None (public) | None |
| `/login` | Redirect to `/?modal=login` | None | None |
| `/register` | Redirect to `/?modal=register` | None | None |
| `/verify-otp` | `VerifyOTP` | None | None |
| `/dashboard` | `DashboardHome` | `ProtectedRoute` | `DashboardLayout` |
| `/brands` | `BrandManager` | `ProtectedRoute` | `DashboardLayout` |
| `/workspace` | `ContentWorkspace` | `ProtectedRoute` | `DashboardLayout` |
| `/workspace/:id` | `ContentWorkspace` | `ProtectedRoute` | `DashboardLayout` |
| `/schedule` | `ScheduleEngine` | `ProtectedRoute` | `DashboardLayout` |
| `/schedule/:id` | `ScheduleEngine` | `ProtectedRoute` | `DashboardLayout` |
| `/admin` | `AdminPanel` | `ProtectedRoute` + `AdminRoute` | `DashboardLayout` |
| `*` (catch-all) | Redirect to `/` | None | None |

**Login/Register** are rendered as floating modals on top of the `Landing` page, triggered by the `?modal=login` or `?modal=register` URL search parameter.

---

## 6. Authentication Context

**File**: [`context/AuthContext.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/context/AuthContext.jsx)

### State
| Property | Type | Description |
|---|---|---|
| `user` | `Object \| null` | Current user object from `/api/users/me`, or null if not authenticated |
| `loading` | `boolean` | True while verifying token on app mount |

### Context Value

```jsx
{ user, setUser, loading, login, register, logout }
```

### Methods

#### `login(email, password) → Promise`
1. POSTs to `/auth/login` with form-encoded credentials
2. Saves JWT to `localStorage` as `"token"`
3. Fetches `/users/me` and sets `user` state
4. Returns the token response data

#### `register(email, password) → Promise`
1. POSTs to `/auth/register` with JSON body
2. Calls `login()` immediately to authenticate

#### `logout()`
1. Removes `"token"` from localStorage
2. Sets `user` to null

### Session Restoration (on mount)
```
useEffect (once):
  If localStorage has "token":
    → GET /users/me with token
    → On success: set user state
    → On failure: remove token, set user = null
  Finally: set loading = false
```

### Usage Pattern
```jsx
import { useAuth } from '../context/AuthContext';

const { user, login, logout, loading } = useAuth();
```

---

## 7. API Client (axios)

**File**: [`api.js`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/api.js)

```javascript
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});
```

### Request Interceptor
Automatically attaches the JWT from localStorage to every request:
```javascript
config.headers.Authorization = `Bearer ${token}`;
```

### Response Interceptor (Auto-Logout)
On `401 Unauthorized` response:
- Removes `"token"` from localStorage
- Redirects to `/login`
- **Exception**: Does NOT redirect if the user is already on `/login`, `/register`, or `/verify-otp` pages.

### Usage Pattern
```javascript
import api from '../api';

// GET
const res = await api.get('/brands/');

// POST with body
const res = await api.post('/brands/', { name: 'MyBrand', niche: 'Tech' });

// PUT
const res = await api.put(`/content/${id}`, { body: 'new text' });

// DELETE
await api.delete(`/content/${id}`);
```

---

## 8. Visual Design System

The app uses a dark space-inspired aesthetic with the teal accent color `#2dd4bf`.

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| Background | `#08090c` | App background |
| Surface | `#0e1117` | Cards, panels |
| Accent Teal | `#2dd4bf` | Active states, CTAs, highlights |
| Text Primary | `#dde1e7` | Headings, important labels |
| Text Secondary | `#8b949e` | Body text, descriptions |
| Text Muted | `#4a5568` | Dim labels, inactive items |
| Text Ghost | `#2d3340` | Very faint text, timestamps |
| Border Subtle | `rgba(255,255,255,0.06)` | Card borders |
| Error | `#f87171` / `#dc2626` | Error states, delete actions |

### Typography
- Font: System sans-serif (no explicit Google Font import; TailwindCSS defaults)
- Uppercase tracking-widest labels used extensively for section headers
- `letter-spacing: '-0.02em'` on large headings for premium look

### Animated Background Elements

Two layered background effects used in the `DashboardLayout` and `Landing`:

1. **Star Field** (`<canvas>`) — 130–160 twinkling white dots with sine-wave opacity animation via `requestAnimationFrame`
2. **Grid Overlay** (`<div>`) — Static CSS grid pattern at 55px cell size with gradient mask to fade edges

### Component Styling Conventions

- **Cards**: `background: '#0e1117'`, `border: '1px solid rgba(255,255,255,0.06)'`, `border-radius: 16px`
- **Active States**: Teal glow border + `rgba(45,212,191,0.08)` background
- **CTAs**: `background: '#2dd4bf'`, `color: '#071012'`, rounded-full shape
- **Glassmorphism** (modals/navbar): `backdropFilter: 'blur(20px)'`
- **Hover effects**: Applied via `onMouseEnter`/`onMouseLeave` for fine-grained control not possible with pure Tailwind

---

## 9. Components

### 9.1 Navbar

**File**: [`components/Navbar.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/components/Navbar.jsx)

**Type**: Sticky sidebar navigation (240px wide)

#### Props
None — reads from `AuthContext` and `react-router-dom`.

#### Navigation Items

| Label | Path | Icon |
|---|---|---|
| Dashboard | `/dashboard` | `LayoutDashboard` |
| Brand Manager | `/brands` | `Target` |
| AI Workspace | `/workspace` | `Sparkles` |
| Schedule Engine | `/schedule` | `CalendarDays` |
| Admin Panel *(ADMIN only)* | `/admin` | `Shield` |

The Admin Panel entry is only added to `navItems` if `user.role.toUpperCase() === 'ADMIN'`.

#### Active State Detection
```jsx
const isActive = location.pathname === path || 
  (path !== '/' && location.pathname.startsWith(path));
```

When active:
- 4px teal left border
- Teal text color with drop-shadow glow
- `rgba(45,212,191,0.12)` background highlight
- Shifts left by 12px for visual effect

#### User Block (Bottom)
Displays:
- Avatar with first 2 letters of email (teal on dark background)
- Email address (truncated)
- Role label (lowercase)
- **Sign Out** button (red hover effect)

---

## 10. Pages

### 10.1 Landing Page

**File**: [`pages/Landing.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/Landing.jsx)

**Route**: `/`  
**Auth**: Public

#### Sub-Components

| Component | Purpose |
|---|---|
| `StarField` | Animated twinkling stars canvas (160 stars) |
| `Grid` | CSS grid background with edge fade masks |
| `FloatingNav` | Fixed pill-shaped navigation bar (centered, top: 20px) |
| `DashMockup` | Static SVG/HTML dashboard preview illustration |

#### Sections (scrollable, anchor-linked)

| ID | Section | Content |
|---|---|---|
| `#home` | Hero | Headline, subheading, CTA, DashMockup |
| *(no ID)* | Philosophy | "Who said content has to be boring?" |
| `#features` | Features Grid | 6 feature cards |
| `#pricing` | Pricing | 3 tiers (Starter $0 / Pro $29 / Enterprise Custom) |
| `#about` | Footer | Logo, product links, company links, copyright |

#### Active Section Tracking
Uses `IntersectionObserver` on each section element to update `activeSection` state, which highlights the corresponding `FloatingNav` link.

#### Modal Management
- Auth modals are triggered via URL search parameter: `?modal=login` or `?modal=register`
- `openModal(type)` → `setSearchParams({ modal: type })`
- `closeModal()` → `setSearchParams({})`
- `document.body.style.overflow = 'hidden'` when modal is open (prevents background scroll)

#### Behavior When Logged In
The header shows a "Dashboard →" button instead of "Log in" / "Sign up".

---

### 10.2 Login Modal

**File**: [`pages/Login.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/Login.jsx)

**Type**: Modal overlay (fixed, centered, backdrop blur)  
**Rendered by**: `Landing.jsx` when `?modal=login`

#### Props
| Prop | Type | Description |
|---|---|---|
| `onClose` | `() => void` | Closes the modal (clears search param) |
| `onSwitchToRegister` | `() => void` | Switches to Register modal |

#### State
| State | Description |
|---|---|
| `email` | Email input value |
| `password` | Password input value |
| `showPassword` | Toggle password visibility |
| `error` | Error message to display |
| `loading` | Submit button loading state |

#### Form Submission Flow
```
1. Call auth.login(email, password)
2. On success: close modal, navigate('/dashboard')
3. On 400/401: show "Incorrect email or password" error
4. On other: show "Login failed" error
```

#### UI Features
- Eye/EyeOff icon toggle for password visibility
- Teal border + glow focus ring on inputs
- Animated loading spinner on submit button
- "Create one" link to switch to Register modal

---

### 10.3 Register Modal

**File**: [`pages/Register.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/Register.jsx)

**Type**: Modal overlay  
**Rendered by**: `Landing.jsx` when `?modal=register`

#### Props
| Prop | Type | Description |
|---|---|---|
| `onClose` | `() => void` | Closes the modal |
| `onSwitchToLogin` | `() => void` | Switches to Login modal |

#### Validation
- Client-side: passwords must match (checked before submit)
- Minimum password length enforced visually

#### Registration Flow
```
1. Validate passwords match
2. Call auth.register(email, password)
   → POSTs to /auth/register
   → Auto-logs in after registration
3. On success: close modal, navigate('/verify-otp')
4. On 400: show error (e.g. "Email already registered")
```

---

### 10.4 VerifyOTP Page

**File**: [`pages/VerifyOTP.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/VerifyOTP.jsx)

**Route**: `/verify-otp`  
**Auth**: Authenticated but unverified users

#### Purpose
Collects the 5-digit OTP code sent to the user's email after registration. Marks account as verified.

#### Key Behaviors
- 6 individual digit input boxes (one per digit) with auto-advance on input
- Backspace navigates to previous input
- Paste handler distributes clipboard content across boxes
- Resend OTP button with cooldown timer
- On success: sets `user.is_verified = true` via `setUser`, navigates to `/dashboard`

#### API Calls
- `POST /auth/verify-otp` → `{ email, otp }` — verify the code
- `POST /auth/resend-otp` → `{ email }` — send a new code

---

### 10.5 DashboardHome Page

**File**: [`pages/DashboardHome.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/DashboardHome.jsx)

**Route**: `/dashboard`  
**Auth**: Protected (verified user)

#### Purpose
System overview and automation mode selector. Acts as the primary entry point after login.

#### Data Fetched on Mount
1. `GET /brands/` → takes the first brand as `activeBrand`
2. `GET /brands/{brand.id}/content` → counts drafts and published posts

#### Stat Cards (3-column grid)
| Card | Value |
|---|---|
| Active Brand | `activeBrand.name` + niche |
| Pending Approvals | count of DRAFT + PENDING_APPROVAL items |
| Published Posts | count of PUBLISHED items |

#### Mode Selector
Two clickable cards: **Manual Mode** and **Full Auto-Pilot**.

**Manual Mode behavior**:
- If already in manual mode → navigates to `/workspace/{brandId}`
- If switching → shows confirmation modal → `PUT /brands/{id}/mode` → navigate

**Auto-Pilot behavior**:
- If already in auto mode → navigates to `/schedule/{brandId}`
- If switching → shows confirmation modal → `PUT /brands/{id}/mode` → navigate

#### Empty State
If the user has no brands, shows a message with a "Setup Your First Brand" link to `/brands`.

---

### 10.6 BrandManager Page

**File**: [`pages/BrandManager.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/BrandManager.jsx)

**Route**: `/brands`  
**Auth**: Protected (verified user)

#### Purpose
Create, view, and edit brand profiles. Connect/disconnect Twitter/X accounts.

#### State
| State | Description |
|---|---|
| `brands` | Array of brands from API |
| `isEditing` | Boolean — whether the edit form is shown |
| `newBrand` | Form state `{name, description, niche, quirks, persona_guidelines}` |
| `fetchError` | Error message if brands can't be loaded |

#### Two-Panel Display Logic
```
activeBrand = brands[0]  (only first brand is managed)
showForm = !activeBrand OR isEditing

If showForm:  → Show brand creation/edit form
Else:         → Show brand profile view + X Integration card
```

#### Brand Form Fields
| Field | Type | Required | Notes |
|---|---|---|---|
| Brand Name | text input | Yes | Unique brand identifier |
| Description | textarea | No | Optional overview |
| Niche / Industry | text input | Yes | Used for AI generation prompts |
| Brand Quirks | textarea | No | Tone characteristics |
| General Guidelines | textarea | No | Content rules/persona |

**Quick-fill suggestion chips**: Clicking a chip appends the suggestion to the field value. Pre-defined options for niche, quirks, and persona.

#### X (Twitter) Integration Card
Displayed alongside the brand profile view. Shows:

**Connected State**:
- `@username` avatar + handle
- "Connected via OAuth 2.0" label
- "Disconnect X Account" button (red, requires confirmation)

**Disconnected State**:
- Description of the OAuth 2.0 PKCE flow
- "Connect X Account" button

**Connect X Flow**:
```
1. GET /auth/twitter/login?brand_id={id}
2. Redirect browser to returned auth_url
3. Twitter redirects to backend callback
4. Backend redirects to /brands?oauth=success&username=...
   OR /brands?oauth=failed&reason=...
5. useEffect reads URL params and shows alert
```

#### API Calls
- `GET /brands/` — fetch brands
- `POST /brands/` — create brand
- `PUT /brands/{id}` — update brand
- `GET /auth/twitter/login?brand_id={id}` — get OAuth URL
- `POST /brands/{id}/disconnect` — disconnect X account

---

### 10.7 ContentWorkspace Page

**File**: [`pages/ContentWorkspace.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/ContentWorkspace.jsx)

**Routes**: `/workspace` · `/workspace/:id`  
**Auth**: Protected (verified user)

#### Purpose
The main content creation hub. Displays AI-generated drafts, trend selector, and manages the content lifecycle.

#### URL Parameter
`id` → `brandId`. Defaults to `1` if not provided via URL params.

#### State
| State | Description |
|---|---|
| `contents` | All content items from API |
| `trends` | Array of 3 trend topic strings |
| `selectedTrend` | Currently selected trend (string) |
| `isGenerating` | Loading state for AI generation |
| `isFetchingTrends` | Loading state for trend fetch |
| `editingId` | ID of content item being edited inline |
| `editBody` | Current text in the inline editor |
| `pendingDelete` | ID of content awaiting delete confirmation |
| `cooldownLeft` | Seconds until trend refresh is available |

#### Content Lists (derived from `contents`)
```javascript
drafts    = contents.filter(c => c.status === 'DRAFT')
queued    = contents.filter(c => ['SCHEDULED', 'APPROVED'].includes(c.status))
published = contents.filter(c => c.status === 'PUBLISHED')
           .sort((a, b) => newest first by scheduled_for/created_at)
```

#### Trend Refresh Cooldown
- 5-minute client-side cooldown stored in `localStorage` under key `trend_cooldown_{brandId}`
- Shows countdown timer `MM:SS` while cooling down
- Prevents API abuse on the pytrends/LLM pipeline

#### Intelligent Auto-Refresh
After fetching content, schedules a `setTimeout` to re-fetch content **35 seconds after the next scheduled post's due time**. This ensures the UI automatically reflects when the background scheduler publishes a post.

#### Sections

##### Trend Selector Panel
- Grid of 3 trend topic cards (from `/brands/{id}/trends`)
- Click to select a trend (highlighted with teal border + checkmark)
- "Refresh" button (with cooldown timer display)
- Selecting a trend enables the "Generate via AI" button

##### Drafts Section
Each draft card shows:
- Post body text
- Formatted creation timestamp
- Action buttons: **Edit** · **Delete** · **Approve**

**Inline Editing**:
- Click Edit → textarea replaces body text
- Character counter (`{count} / 280`) with red color when over limit
- Save/Cancel buttons

**Delete Flow**:
- Click Delete → `pendingDelete` state set → confirmation modal appears
- Confirm → `DELETE /content/{id}`

**Approve Flow**:
- Click Approve → `POST /content/{id}/approve_and_queue`
- Atomically approves AND schedules the post
- If no posting plan → error alert with instructions

##### In Queue Section (SCHEDULED + APPROVED)
- Compact card showing post body + "Scheduled" label + datetime
- Only shown if queued items exist

##### Published Section
- Each card shows body, publish datetime
- "View on X ↗" link if real tweet_id (not mock, not failed)
- "Mock (no keys)" label for mock-published items

#### API Calls
- `GET /brands/{id}/content` — load all content
- `GET /brands/{id}/trends` — load trend topics
- `POST /brands/{id}/generate` — AI generation `{ trend: selectedTrend }`
- `PUT /content/{id}` — save inline edit `{ body }`
- `DELETE /content/{id}` — delete draft
- `POST /content/{id}/approve_and_queue` — approve and queue

---

### 10.8 ScheduleEngine Page

**File**: [`pages/ScheduleEngine.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/ScheduleEngine.jsx)

**Routes**: `/schedule` · `/schedule/:id`  
**Auth**: Protected (verified user)

#### Purpose
Configure posting schedule, manage the upcoming queue, and control the auto-pilot posting engine.

#### URL Parameter
`id` → `brandId`. Defaults to `1`.

#### State
| State | Description |
|---|---|
| `activeBrand` | Current brand data |
| `queue` | Array of SCHEDULED content items |
| `activeDays` | Selected days of week |
| `timeSlots` | Array of "HH:MM" strings (1–3 slots) |
| `volume` | `"chill"` / `"growth"` / `"viral"` |
| `isActive` | Whether schedule is currently active |

#### X Connection Requirement Guard
If `activeBrand` exists but has no `twitter_username`, the page renders a **full-screen modal overlay** (non-dismissable) requiring the user to connect X first. Shows:
- Error icon + explanatory message
- "Back to Dashboard" button
- "Connect X Account" button (→ navigates to `/brands`)

This guard prevents confusion about why posts aren't being published.

#### Queue Panel
Displays all SCHEDULED items sorted by `scheduled_for` (ascending).

| Feature | Details |
|---|---|
| "Up Next" badge | First item gets a teal "Up Next" label with pulse dot |
| Slot numbering | Other items labeled "Slot 2", "Slot 3", etc. |
| Schedule datetime | Date (short format) + time |
| Post body preview | Rendered in a dark inset box |
| Remove button | Trash icon → `POST /content/{id}/remove_queue` → back to DRAFT |

**Empty queue** CTA text differs by mode:
- Manual: "Approve a post in the Workspace to fill slots."
- Auto-Pilot: "Save your plan to enable AI filling."

**Manual mode** shows "+ Add from Workspace" button → navigates to `/workspace/{brandId}`.

#### Configuration Panel (3 steps)

**Step 1: Active Posting Days**  
Day picker buttons (Mon–Sun), toggle via click.

**Step 2: Daily Time Slots**  
- 1–3 time inputs with clock icon
- "Add Slot" (up to max 3) / "Remove" button per slot

**Step 3: AI Volume** *(Only shown in Auto-Pilot mode)*  
3 volume strategy cards:
| Option | Description |
|---|---|
| Chill | 1 slot daily |
| Growth | 2 slots daily |
| Viral | All 3 slots daily |

#### Schedule Status Control Panel

| Status | Controls |
|---|---|
| **Active** | "Pause Schedule" button (amber) + "Save & Keep Active" button (teal) |
| **Paused** | "Save Draft" button + "Activate Schedule" button (teal) |

Both save buttons call `handleSave(targetActiveState)` which POSTs the full plan to `/brands/{id}/plan`.

Auto-refresh timer: Same 35-second-after-due logic as ContentWorkspace.

#### API Calls
- `GET /brands/{id}` — brand data
- `GET /brands/{id}/plan` — existing plan
- `GET /brands/{id}/content` — filter SCHEDULED for queue
- `POST /brands/{id}/plan` — save plan `{active_days, time_slots, volume, is_active}`
- `POST /content/{id}/remove_queue` — remove from queue

---

### 10.9 AdminPanel Page

**File**: [`pages/AdminPanel.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/pages/AdminPanel.jsx)

**Route**: `/admin`  
**Auth**: Protected + ADMIN role required

#### Purpose
System administration dashboard. User management, brand auditing, and quota control.

#### Layout
**Split-pane master-detail pattern** (12-column grid):
- **Left (4 cols)**: Scrollable user registry list
- **Right (8 cols)**: Selected user detail inspector

#### State
| State | Description |
|---|---|
| `users` | All users from `/admin/users` |
| `selectedUserId` | ID of currently selected user |
| `searchQuery` | Email search filter string |
| `selectedUserForDelete` | User object awaiting delete confirmation |
| `quotaModalBrand` | Brand object for quota adjustment |
| `inspectModalBrand` | Brand object for detail inspection |
| `quotaForm` | `{generations_today, posts_today}` form values |

#### Left Panel: User Registry

- **Search box** filters by email (case-insensitive)
- Each user card shows:
  - 2-letter avatar (teal when selected)
  - Email (truncated) + role
  - Verified status dot (emerald = verified, amber = pending OTP)
  - Brand count badge
- Click to select → loads detail in right panel
- Auto-selects first user on load

#### Right Panel: User Detail Inspector

When a user is selected:

**Profile Header Block**:
- Avatar + email + role badge (purple for ADMIN, grey for EDITOR)
- User ID + verification status
- **Toggle Role** button → promotes EDITOR to ADMIN or demotes ADMIN to EDITOR (with `window.confirm` dialog)
- **Delete** (trash icon) → opens cascading delete modal

**Registered Brands Grid** (2-column):
Each brand card shows:
- Brand name + X username badge (or "No X linked" warning)
- Scheduled Posts count (teal)
- Published Posts count (blue)
- **Brand Details** button → opens Brand Inspection modal
- **Quota Manager** button → opens Quota Manager modal

#### Modal 1: Cascading Delete Confirmation
Warns admin that deleting a user will permanently purge:
- All brands
- Active posting plans
- Validation rules & templates
- All draft, scheduled, and published content logs

Requires clicking "Confirm & Purge" to proceed.

#### Modal 2: Quota Manager
Adjusts the brand's daily usage counters:
- **AI Generations Today** (0–4): Range slider, teal accent
- **Dispatched Posts Today** (0–3): Range slider, blue accent
- Reducing count gives the brand more operational capacity today.

#### Modal 3: Brand Inspection
Read-only brand details view (500px tall, scrollable):
- Selected Niche + Automation mode
- Description
- Brand Quirks & Persona Guidelines
- Posting Calendar Configuration (if plan exists)

#### API Calls
- `GET /admin/users` — all users with brand data
- `PUT /admin/users/{id}/role` — toggle role
- `DELETE /admin/users/{id}` — delete user (cascading)
- `PUT /admin/brands/{id}/quota` — update quota counters

---

## 11. Route Guards

**File**: [`App.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/App.jsx)

### `ProtectedRoute`
```jsx
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/?modal=login" replace />;
  if (!user.is_verified) return <Navigate to="/verify-otp" replace />;
  
  return children;
};
```

**Redirects**:
- Not authenticated → Login modal on Landing page
- Authenticated but unverified → `/verify-otp`

### `AdminRoute`
```jsx
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (user?.role?.toUpperCase() !== "ADMIN") return <Navigate to="/dashboard" replace />;
  
  return children;
};
```

Used on top of `ProtectedRoute` for the `/admin` path. Non-admin users are silently redirected to `/dashboard`.

---

## 12. Dashboard Layout

**Component**: `DashboardLayout` in [`App.jsx`](file:///e:/Programming/Final%20Year%20Project/My_FYP/frontend/src/App.jsx)

Wraps all protected dashboard pages with:

```jsx
<div className="min-h-screen flex relative" style={{ background: '#08090c' }}>
  <canvas ref={canvasRef} />  {/* Animated star field */}
  <div />                      {/* Static grid overlay */}
  <Navbar />                   {/* 240px sticky sidebar */}
  <main className="flex-1 p-8 overflow-y-auto h-screen relative z-10">
    {children}                 {/* Page content */}
  </main>
</div>
```

**Star Field**: 130 twinkling stars drawn on a full-screen canvas with sine-wave alpha animation. Canvas resizes on window resize. Cleaned up via `cancelAnimationFrame` on unmount.

**Grid**: CSS background-image grid with mask gradients for edge fading.

**Z-index layers**: canvas + grid at `z-0`, Navbar at `z-20`, main content at `z-10`.

---

## 13. State Management Patterns

The project uses **local component state** (React `useState`) + **React Context** for auth. No external state library (Redux, Zustand, etc.) is used.

### Data Fetching
Each page fetches its own data directly from the API on mount via `useEffect`. No global data cache.

### Common Patterns

**Loading States**: Most pages have a `loading` state that shows a spinner while awaiting API response.

**Error Display**: Inline error messages using teal/red banners. Modal pages use the `error` state to show inline text within the form.

**Optimistic UI**: Not used — all mutations refetch from server after completion.

**Confirm Before Destructive Action**: 
- `window.confirm()` for simple confirms (disconnect X, toggle role)
- Custom modal for complex confirms (delete user, delete content)

---

## 14. Error Handling Patterns

### API Error Extraction
```javascript
const detail = err?.response?.data?.detail;
const msg = Array.isArray(detail)
  ? detail.map(d => `${d.loc?.join('.')} — ${d.msg}`).join('\n')
  : (detail || 'Unknown error. Check console.');
alert(`Failed to save brand:\n${msg}`);
```

Handles both:
- String detail: `{ "detail": "Brand not found" }`
- Pydantic validation array: `{ "detail": [{ "loc": [...], "msg": "..." }] }`

### Axios Interceptor (Global 401)
```javascript
api.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401) {
      const onAuthPage = authPages.some(p => window.location.pathname.startsWith(p));
      if (!onAuthPage) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 15. Running the Frontend

### Prerequisites
- Node.js 18+ / npm

### Setup
```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at **`http://localhost:5173`**.

### Build for Production
```powershell
npm run build
# Output in frontend/dist/
```

### Environment Note
The API base URL is hardcoded in `api.js` as `http://localhost:8000/api`. For production deployment, this should be updated to the production backend URL.

### Backend Dependency
The frontend requires the backend server running at `http://localhost:8000`. Start the backend first:
```powershell
cd backend
uvicorn main:app --reload --port 8000
```
