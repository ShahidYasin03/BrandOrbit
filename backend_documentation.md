# BrandOrbit — Backend Technical Documentation

> **Version:** 1.0 | **Stack:** FastAPI · PostgreSQL · SQLAlchemy · Groq/Gemini · Twitter API v2  
> **Server Entry Point:** `backend/main.py` | **API Explorer:** `http://127.0.0.1:8000/docs`

---

## Table of Contents

1. [System Architecture & Tech Stack](#1-system-architecture--tech-stack)
2. [Database Design](#2-database-design)
3. [System Modeling — User Flows & Logic](#3-system-modeling--user-flows--logic)
4. [API Reference](#4-api-reference)

---

## 1. System Architecture & Tech Stack

### 1.1 Executive Summary

BrandOrbit is an AI-driven, multi-brand social media content management and automation platform. Its backend is a **Python FastAPI monolith** that serves as the single source of truth for:

- **Authentication** — JWT-based stateless login with OTP email verification
- **Brand Management** — Multi-tenancy supporting multiple brands per user, each with its own AI persona configuration
- **AI Content Generation** — Groq LLaMA-3.3-70B (with Google Gemini fallback) synthesising platform-optimised tweets grounded in live Google Trends data
- **Content Lifecycle** — A six-stage state machine (DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → PUBLISHED / REJECTED)
- **Automated Publishing** — An APScheduler background daemon that polls for due posts every 30 seconds and publishes to Twitter/X via OAuth 2.0 PKCE
- **Auto-Pilot Mode** — Fully autonomous operation that self-replenishes the content queue without human input

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **API Framework** | FastAPI 0.136 | HTTP request handling, dependency injection, OpenAPI docs |
| **Language** | Python 3.14 | Runtime environment |
| **Database** | PostgreSQL (via pgAdmin) | Persistent relational data storage |
| **ORM** | SQLAlchemy 2.0 | Database model mapping and query building |
| **DB Driver** | pg8000 1.31 | Pure-Python PostgreSQL adapter (no C++ build tools required) |
| **Schema Validation** | Pydantic v2 | Request/response validation and serialisation |
| **Auth — JWT** | python-jose (HS256) | Stateless Bearer token issuance and verification |
| **Auth — Passwords** | passlib + bcrypt | Salted password hashing |
| **AI — Primary** | Groq LLaMA-3.3-70B | High-speed LLM inference for content generation and trend refinement |
| **AI — Fallback** | Google Gemini Flash | Secondary LLM if Groq API is unavailable |
| **Trend Data** | pytrends | Real-time Google Trends scraping |
| **Twitter/X** | Twitter API v2 + OAuth 2.0 PKCE | Authenticated social media publishing |
| **Background Jobs** | APScheduler (BackgroundScheduler) | Interval-based scheduled post publishing every 30s |
| **CORS** | FastAPI CORSMiddleware | Cross-origin request handling for the React frontend |
| **Email/OTP** | In-memory store + SMTP (Brevo) | OTP verification codes printed to server console |
| **Environment** | python-dotenv | `.env` file loading |

### 1.3 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REACT FRONTEND                              │
│              Vite · Tailwind v4 · http://localhost:5173             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  REST / JSON over HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FASTAPI BACKEND                             │
│                    http://localhost:8000                             │
│                                                                     │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐   │
│  │  Auth Module   │  │  Brand / Content │  │  Admin Panel       │   │
│  │  (auth.py)     │  │  Controller      │  │  (ADMIN role only) │   │
│  │  JWT · bcrypt  │  │  (main.py)       │  │                    │   │
│  └────────────────┘  └─────────────────┘  └────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              APScheduler Background Daemon (30s)             │   │
│  │   publish_scheduled_content() → maintain_auto_queue()        │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────┬───────────────────────┬──────────────────┬────────────┘
             │                       │                  │
             ▼                       ▼                  ▼
┌──────────────────┐   ┌──────────────────────┐  ┌────────────────────┐
│   POSTGRESQL DB  │   │   GROQ / GEMINI API  │  │  TWITTER/X API v2  │
│   (pgAdmin)      │   │   LLaMA-3.3-70B      │  │  OAuth 2.0 PKCE    │
│   5 Tables       │   │   Gemini Flash       │  │  POST /2/tweets    │
└──────────────────┘   └──────────────────────┘  └────────────────────┘
             │                       │
             └─────────┬─────────────┘
                       │
             ┌─────────▼──────────┐
             │  Google Trends API │
             │  (pytrends cache)  │
             └────────────────────┘
```

### 1.4 Data Flow — End-to-End Request Lifecycle

```
[1] React UI  ──►  HTTP Request (JWT in Authorization header)
[2] FastAPI   ──►  CORSMiddleware validates origin
[3] FastAPI   ──►  Depends(auth.get_verified_user) validates JWT → loads User from DB
[4] Endpoint  ──►  SQLAlchemy ORM queries/mutates PostgreSQL via pg8000
[5] FastAPI   ──►  Pydantic serialises response to JSON
[6] React UI  ◄──  200 OK JSON payload
```

---

## 2. Database Design

### 2.1 Entity-Relationship Diagram (ERD)

```
 ┌────────────────────────────────────────────────────┐
 │                        users                        │
 │  PK  id            INTEGER                          │
 │      email         VARCHAR  UNIQUE                  │
 │      hashed_password VARCHAR                        │
 │      role          ENUM(ADMIN, EDITOR)  DEFAULT EDITOR│
 │      is_verified   BOOLEAN  DEFAULT FALSE           │
 └──────────────────────────┬─────────────────────────┘
                            │ 1
                            │ owner_id (FK)
                            │ *
 ┌──────────────────────────▼─────────────────────────┐
 │                        brands                       │
 │  PK  id                     INTEGER                 │
 │      name                   VARCHAR  UNIQUE         │
 │      description            TEXT                    │
 │      niche                  VARCHAR  NULLABLE       │
 │      quirks                 TEXT  NULLABLE          │
 │      persona_guidelines     TEXT                    │
 │      twitter_oauth2_access_token  VARCHAR  NULLABLE │
 │      twitter_oauth2_refresh_token VARCHAR  NULLABLE │
 │      twitter_oauth2_token_expires_at DATETIME NULL  │
 │      twitter_username       VARCHAR  NULLABLE       │
 │      twitter_oauth_state    VARCHAR  NULLABLE       │
 │      twitter_oauth_code_verifier   VARCHAR  NULLABLE│
 │      automation_mode        VARCHAR  DEFAULT manual  │
 │      generations_today      INTEGER  DEFAULT 0      │
 │      last_generation_date   DATE  NULLABLE          │
 │      posts_today            INTEGER  DEFAULT 0      │
 │      last_post_date         DATE  NULLABLE          │
 │      created_at             DATETIME  DEFAULT now() │
 │  FK  owner_id               → users.id             │
 └──────┬─────────┬─────────────┬────────────────────-┘
        │ 1       │ 1           │ 1
        │         │             │
        │ *       │ *           │ 1
 ┌──────▼──────┐ ┌▼───────────┐ ┌▼─────────────────────┐
 │content_items│ │validation  │ │    posting_plans       │
 │             │ │  _rules    │ │                        │
 │ PK id INT   │ │PK id INT   │ │ PK id INT              │
 │ brand_id FK │ │brand_id FK │ │ brand_id FK (UNIQUE)   │
 │ body TEXT   │ │rule_type   │ │ active_days  JSON      │
 │ status ENUM │ │  VARCHAR   │ │ time_slots   JSON      │
 │ scheduled_  │ │parameters  │ │ volume       VARCHAR   │
 │  for  DT    │ │  JSON      │ │ is_active    BOOLEAN   │
 │ tweet_id    │ └────────────┘ └────────────────────────┘
 │  VARCHAR    │
 │ created_at  │
 │ author_id FK│
 └─────────────┘
```

**Cascade Rules:**
- Deleting a `User` cascades → deletes all owned `Brand` records
- Deleting a `Brand` cascades → deletes all `ContentItem`, `ValidationRule`, and `PostingPlan` records

---

### 2.2 Data Dictionary

#### Table: `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment, indexed | Unique system identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL, indexed | Login credential and unique identity |
| `hashed_password` | VARCHAR | NOT NULL | bcrypt-hashed password (passlib, 12 rounds) |
| `role` | ENUM | DEFAULT `EDITOR` | Access level. `ADMIN` unlocks the admin panel; `EDITOR` is the standard user role |
| `is_verified` | BOOLEAN | DEFAULT `FALSE` | Set to `TRUE` only after the user submits the correct OTP code sent at registration. Unverified users cannot access protected endpoints |

---

#### Table: `brands`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment, indexed | Unique brand identifier |
| `name` | VARCHAR | UNIQUE, NOT NULL, indexed | Display name of the brand. Must be globally unique across all users |
| `description` | TEXT | NULLABLE | Short human-readable brand description shown in the UI |
| `niche` | VARCHAR | NULLABLE | The brand's topic category (e.g., "football", "fintech"). Required for AI generation and trend fetching |
| `quirks` | TEXT | NULLABLE | Brand personality traits entered by the user (e.g., "uses Gen-Z slang, loves pop culture references"). Passed verbatim to the LLM prompt |
| `persona_guidelines` | TEXT | NULLABLE | Explicit content rules and tone guidance passed directly to the LLM prompt |
| `twitter_oauth2_access_token` | VARCHAR | NULLABLE | Short-lived OAuth 2.0 Bearer token for publishing to Twitter/X. Auto-refreshed when expired |
| `twitter_oauth2_refresh_token` | VARCHAR | NULLABLE | Long-lived Refresh Token used to obtain new access tokens without re-authentication |
| `twitter_oauth2_token_expires_at` | DATETIME | NULLABLE | UTC expiry timestamp of the access token. The system refreshes proactively 5 minutes before expiry |
| `twitter_username` | VARCHAR | NULLABLE | Connected X/Twitter handle (e.g., `@BrandOrbit`). Populated automatically on OAuth callback |
| `twitter_oauth_state` | VARCHAR | NULLABLE | Transient CSRF protection nonce for the PKCE flow. Cleared after successful callback |
| `twitter_oauth_code_verifier` | VARCHAR | NULLABLE | Transient PKCE code verifier. Cleared after successful token exchange |
| `automation_mode` | VARCHAR | DEFAULT `manual` | Controls the publishing pipeline: `manual` = user controls everything; `semi-automated` = AI generates, human approves; `auto` = fully autonomous |
| `generations_today` | INTEGER | DEFAULT `0` | Counter reset each day. Capped at **4** per day to prevent API abuse |
| `last_generation_date` | DATE | NULLABLE | The date `generations_today` was last incremented. Used to detect day rollover and reset the counter |
| `posts_today` | INTEGER | DEFAULT `0` | Daily post counter. Capped at **3** per day by the scheduler |
| `last_post_date` | DATE | NULLABLE | The date `posts_today` was last incremented. Used for daily reset detection |
| `created_at` | DATETIME | DEFAULT `utcnow()` | Brand creation timestamp |
| `owner_id` | INTEGER | FK → `users.id`, NOT NULL | Establishes brand ownership. Only the owning user can read or mutate the brand |

---

#### Table: `posting_plans`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | Unique plan identifier |
| `brand_id` | INTEGER | FK → `brands.id`, UNIQUE | One-to-one relationship with `brands`. Each brand may have at most one posting plan |
| `active_days` | JSON (Array) | NOT NULL | Days of the week to post. Example: `["Monday", "Wednesday", "Friday"]` |
| `time_slots` | JSON (Array) | NOT NULL | Times of day to publish. Example: `["09:00", "17:00"]`. Max 3 slots |
| `volume` | VARCHAR | NOT NULL | Posting velocity preset. One of: `chill` (low), `growth` (medium), `viral` (high) |
| `is_active` | BOOLEAN | DEFAULT `TRUE` | When `FALSE`, the APScheduler skips all items for this brand even if their `scheduled_for` has passed |

---

#### Table: `content_items`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | Unique content identifier |
| `brand_id` | INTEGER | FK → `brands.id`, NOT NULL | The brand this content belongs to |
| `body` | TEXT | NOT NULL | The tweet text. The LLM is instructed to keep this under 280 characters |
| `status` | ENUM | DEFAULT `DRAFT` | State machine position. Valid states: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `REJECTED` |
| `scheduled_for` | DATETIME | NULLABLE | UTC timestamp when this item is due to be published. Set by `recalculate_queue()` or manually |
| `tweet_id` | VARCHAR | NULLABLE | Twitter's ID for the published tweet (e.g., `1234567890`). Prefixed `failed:<code>` on publish errors. Set to `mock_tweet_id_no_keys` when no OAuth credentials are configured |
| `created_at` | DATETIME | DEFAULT `utcnow()` | Creation timestamp. Used for ordering and 7-day activity analytics |
| `author_id` | INTEGER | FK → `users.id`, NULLABLE | The user who created or generated this content item |

**Content Status Transitions:**

```
         ┌─────────────────────────────────────────────────┐
         │                                                 ▼
[DRAFT] ──► [PENDING_APPROVAL] ──► [APPROVED] ──► [SCHEDULED] ──► [PUBLISHED]
   │                  │                 │
   │                  ▼                 │
   └──────────────► [REJECTED] ◄────────┘
   ▲
   └── remove_queue() reverts SCHEDULED → DRAFT
```

---

#### Table: `validation_rules`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | Unique rule identifier |
| `brand_id` | INTEGER | FK → `brands.id`, NOT NULL | The brand this rule applies to |
| `rule_type` | VARCHAR | NOT NULL | Rule category identifier. Example: `forbidden_words`, `max_length` |
| `parameters` | JSON (Object) | NOT NULL | Configuration for the rule. Example: `{"words": ["spam", "cheap"]}` for `forbidden_words`; `{"value": 240}` for `max_length` |

---

## 3. System Modeling — User Flows & Logic

### 3.1 Use Case Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │              BrandOrbit System               │
                    │                                             │
  ┌──────────┐      │  ┌─────────────────────────────────────┐   │
  │          │      │  │         Authentication               │   │
  │  PUBLIC  │─────►│  │  Register Account                   │   │
  │  (Guest) │      │  │  Log In                             │   │
  │          │      │  └─────────────────────────────────────┘   │
  └──────────┘      │                                             │
                    │  ┌─────────────────────────────────────┐   │
  ┌──────────┐      │  │         Editor Capabilities          │   │
  │          │─────►│  │  Verify OTP                         │   │
  │  EDITOR  │      │  │  Create / Edit / Delete Brand       │   │
  │  (User)  │      │  │  Configure AI Persona & Guidelines  │   │
  │          │      │  │  Connect X Account (OAuth PKCE)     │   │
  └──────────┘      │  │  Fetch Niche Trends                 │   │
                    │  │  Generate AI Content                │   │
                    │  │  Edit / Delete Draft Content        │   │
                    │  │  Submit Content for Approval        │   │
                    │  │  Approve / Reject Content           │   │
                    │  │  Smart-Schedule Content             │   │
                    │  │  Remove Content from Queue          │   │
                    │  │  Set Automation Mode                │   │
                    │  │  Configure Posting Plan             │   │
                    │  │  Disconnect X Account               │   │
                    │  └─────────────────────────────────────┘   │
                    │                                             │
  ┌──────────┐      │  ┌─────────────────────────────────────┐   │
  │          │─────►│  │      Admin-Only Capabilities         │   │
  │  ADMIN   │      │  │  View Platform Stats Dashboard      │   │
  │  (User)  │      │  │  List All Users                     │   │
  │          │      │  │  Change User Role (EDITOR ↔ ADMIN)  │   │
  │          │      │  │  Delete User (cascades all data)    │   │
  │          │      │  │  Override Brand Quota Counters      │   │
  └──────────┘      │  └─────────────────────────────────────┘   │
                    │                                             │
  ┌──────────┐      │  ┌─────────────────────────────────────┐   │
  │          │      │  │      Background Daemon               │   │
  │SCHEDULER │─────►│  │  Auto-Publish Scheduled Posts       │   │
  │(System)  │      │  │  Auto-Refresh OAuth Tokens          │   │
  │          │      │  │  Auto-Replenish Content Queue       │   │
  └──────────┘      │  └─────────────────────────────────────┘   │
                    └─────────────────────────────────────────────┘
```

---

### 3.2 Sequence Diagrams

#### 3.2.1 User Registration & OTP Verification

```
User         Frontend          Backend (FastAPI)       PostgreSQL DB
 │                │                    │                     │
 │──POST /register►│                   │                     │
 │                │──POST /api/auth/register──►│             │
 │                │                    │──INSERT users ─────►│
 │                │                    │◄── user record ──────│
 │                │                    │  Generate 5-digit OTP│
 │                │                    │  Store in _otp_store │
 │                │                    │  PRINT to terminal   │
 │                │◄── 201 User JSON ──│                     │
 │                │                    │                     │
 │  [Sees OTP in terminal / email]      │                     │
 │──Enter OTP ───►│                    │                     │
 │                │──POST /api/auth/verify-otp──►│           │
 │                │                    │  Lookup _otp_store   │
 │                │                    │──UPDATE users.is_verified=TRUE►│
 │                │◄── 200 {status: success} ──│             │
 │◄── Redirect to Login ──│            │                     │
```

#### 3.2.2 Login & JWT Issuance

```
User         Frontend          Backend (FastAPI)       PostgreSQL DB
 │                │                    │                     │
 │──POST /login ─►│                   │                     │
 │                │──POST /api/auth/login (form-data)──►│   │
 │                │                    │──SELECT users WHERE email=? ──►│
 │                │                    │◄── user row ─────────│
 │                │                    │  bcrypt.verify(password, hash)│
 │                │                    │  [FAIL] ──► 400 Incorrect cred│
 │                │                    │  [PASS] ──► Sign JWT (7 days) │
 │                │◄── 200 {access_token, token_type: bearer} ──│
 │  Store token   │                    │                     │
 │  in memory     │                    │                     │
```

#### 3.2.3 Twitter/X OAuth 2.0 PKCE Flow

```
User     Frontend      Backend (FastAPI)     Twitter/X API      PostgreSQL
 │            │                 │                   │                │
 │─Connect X ►│                │                   │                │
 │            │──GET /api/auth/twitter/login?brand_id=N──►│         │
 │            │                 │  Generate PKCE pair                │
 │            │                 │  (verifier + S256 challenge)       │
 │            │                 │  Generate CSRF state nonce         │
 │            │                 │──UPDATE brands SET state, verifier►│
 │            │◄── {auth_url} ──│                   │                │
 │            │                 │                   │                │
 │◄── Redirect to Twitter/X ───►│                   │                │
 │──Authorise App ──────────────────────────────────►│               │
 │                                                   │               │
 │◄── Redirect to /api/auth/twitter/callback?code=X&state=Y ─────────│
 │            │                 │                   │                │
 │            │                 │  Validate state matches DB record  │
 │            │                 │──POST /2/oauth2/token (code+verifier)►│
 │            │                 │◄── {access_token, refresh_token, expires_in}─│
 │            │                 │──GET /2/users/me ─────────────────►│
 │            │                 │◄── {data: {username: "XHandle"}} ──│
 │            │                 │──UPDATE brands (tokens, username, clear PKCE)►│
 │◄── Redirect to /brands?oauth=success&username=XHandle ─────────────│
```

#### 3.2.4 AI Content Generation

```
User       Frontend       Backend (FastAPI)     Groq / Gemini     Google Trends
 │               │                  │                  │                │
 │─Generate ────►│                 │                  │                │
 │               │──POST /api/brands/{id}/generate {trend: "..."}──►│  │
 │               │                  │  Check ownership                  │
 │               │                  │  Check niche is configured        │
 │               │                  │  Check generations_today < 4      │
 │               │                  │──[Build LLM prompt with brand     │
 │               │                  │   persona, niche, quirks, trend]  │
 │               │                  │──chat.completions.create() ──────►│
 │               │                  │  [FAIL] ──► Fallback Gemini ──────│──►│
 │               │                  │◄── 2-3 posts split by "|||" ──────│   │
 │               │                  │  Parse & INSERT content_items     │
 │               │                  │  Increment generations_today      │
 │               │                  │  Run maintain_auto_queue()        │
 │               │◄── 201 [ContentItem, ...] ──│                        │
```

#### 3.2.5 Token Auto-Refresh During Publishing

```
Scheduler (APScheduler)      Backend (get_valid_twitter_token)      Twitter API
        │                                    │                           │
        │  item.scheduled_for <= now()        │                           │
        │──Call get_valid_twitter_token() ──►│                           │
        │                                    │  Check expires_at - 5min  │
        │                                    │  [FRESH] ──► return token │
        │                                    │                           │
        │                                    │  [EXPIRED] ──►            │
        │                                    │──POST /2/oauth2/token     │
        │                                    │  grant_type: refresh_token│
        │                                    │  Basic Auth: client creds ├──►│
        │                                    │◄── {new_access_token,     │   │
        │                                    │     refresh_token,         │   │
        │                                    │     expires_in}           │◄──│
        │                                    │  UPDATE brands table      │
        │◄── valid access_token ─────────────│                           │
        │──POST /2/tweets {text: body} ──────────────────────────────►   │
        │◄── 201 {data: {id: "tweet_id"}} ──────────────────────────── ◄─│
        │  UPDATE content_items SET status=PUBLISHED, tweet_id=...       │
        │  INCREMENT posts_today                                          │
        │  Run maintain_auto_queue()                                      │
```

---

### 3.3 Activity Diagrams

#### 3.3.1 APScheduler Auto-Pilot Daemon (Every 30 Seconds)

```
                    ┌─────────────────────────────┐
                    │  APScheduler fires (30s)     │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  Query SCHEDULED items       │
                    │  WHERE scheduled_for <= now()│
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  No items due?               │
                    └──────────────┬──────────────┘
                          YES ─────┘     NO
                           │              ▼
                           │  ┌───────────────────────────┐
                           │  │  For each due item:        │
                           │  └───────────┬───────────────┘
                           │              ▼
                           │  ┌───────────────────────────┐
                           │  │  Load brand               │
                           │  │  Brand found?             │
                           │  └───────────┬───────────────┘
                           │         NO ──┘   YES
                           │               ▼
                           │  ┌───────────────────────────┐
                           │  │  PostingPlan.is_active?   │
                           │  └───────────┬───────────────┘
                           │  INACTIVE ───┘  ACTIVE
                           │                   ▼
                           │  ┌───────────────────────────┐
                           │  │  New day? Reset            │
                           │  │  posts_today = 0           │
                           │  └───────────┬───────────────┘
                           │              ▼
                           │  ┌───────────────────────────┐
                           │  │  posts_today >= 3?         │
                           │  └───────────┬───────────────┘
                           │     YES ─────┘  NO
                           │                   ▼
                           │  ┌───────────────────────────┐
                           │  │  get_valid_twitter_token() │
                           │  │  (auto-refresh if expired) │
                           │  └───────────┬───────────────┘
                           │              ▼
                           │  ┌───────────────────────────┐
                           │  │  OAuth token available?   │
                           │  └──────┬────────────────────┘
                           │    YES  │          NO
                           │         ▼           ▼
                           │  POST /2/tweets  Mock publish
                           │  Twitter API v2  (UI testing)
                           │         │           │
                           │         ▼           ▼
                           │  ┌───────────────────────────┐
                           │  │  Status=PUBLISHED          │
                           │  │  posts_today += 1          │
                           │  │  maintain_auto_queue()     │
                           │  └───────────────────────────┘
                           │
                    ◄──────┘
                 (Return / sleep until next 30s interval)
```

#### 3.3.2 `maintain_auto_queue()` — Auto-Pilot Queue Replenishment

```
              ┌────────────────────────────────┐
              │  maintain_auto_queue(brand_id) │
              └───────────────┬────────────────┘
                              ▼
              ┌────────────────────────────────┐
              │  Brand automation_mode = auto? │
              └───────────────┬────────────────┘
                   NO ────────┘   YES
                    │               ▼
                    │  ┌────────────────────────────────┐
                    │  │  Count SCHEDULED items          │
                    │  │  needed = 3 - queued_count      │
                    │  └───────────────┬────────────────┘
                    │          needed <= 0?
                    │     YES ─────────┘   NO
                    │      │                ▼
                    │      │  ┌────────────────────────────────┐
                    │      │  │  Fetch up to 'needed' DRAFTs   │
                    │      │  │  (oldest first)                │
                    │      │  └───────────────┬────────────────┘
                    │      │         len(drafts) < needed?
                    │      │     YES ──────────┘   NO
                    │      │      │                │
                    │      │      ▼                │
                    │      │  _trigger_ai_generation()
                    │      │  [LLM generates new drafts]
                    │      │      │                │
                    │      │      └──────────┬─────┘
                    │      │                 ▼
                    │      │  ┌────────────────────────────────┐
                    │      │  │  Set each draft → SCHEDULED    │
                    │      │  │  (placeholder date +365d)      │
                    │      │  │  recalculate_queue()           │
                    │      │  │  (assigns real calendar slots) │
                    │      │  └────────────────────────────────┘
                    │      │
                    └──────┘  (Return)
```

#### 3.3.3 `recalculate_queue()` — Calendar Slot Assignment

```
         ┌──────────────────────────────────┐
         │  recalculate_queue(brand_id)     │
         └─────────────────┬────────────────┘
                           ▼
         ┌──────────────────────────────────┐
         │  Load PostingPlan                │
         │  Load all SCHEDULED + APPROVED   │
         │  items for brand                 │
         └─────────────────┬────────────────┘
                           ▼
         ┌──────────────────────────────────┐
         │  No plan OR no active_days OR    │
         │  no time_slots?                  │
         └─────────────────┬────────────────┘
             YES ──────────┘   NO
              │                  ▼
              │  ┌──────────────────────────────────┐
              │  │  Build chronological slot list   │
              │  │  starting from now()             │
              │  │  Walk days forward:              │
              │  │    If weekday in active_days:    │
              │  │      For each time_slot:         │
              │  │        If slot > now(): add it   │
              │  │  Until len(slots)>=len(items)    │
              │  └──────────────────┬───────────────┘
              │                     ▼
              │  ┌──────────────────────────────────┐
              │  │  Assign slot[i] to item[i]       │
              │  │  Set status = SCHEDULED          │
              │  │  Commit to DB                    │
              │  └──────────────────────────────────┘
              │
 Revert items │
 to APPROVED  │
 scheduled=NULL│
              └──► COMMIT, RETURN
```

---

## 4. API Reference

> **Base URL:** `http://127.0.0.1:8000`  
> **Interactive Docs:** `http://127.0.0.1:8000/docs`  
> **Auth Header Format:** `Authorization: Bearer <jwt_token>`

**Authentication Levels:**
- 🔓 **Public** — No token required
- 🔐 **Authenticated** — Valid JWT required (`get_current_user`)
- ✅ **Verified** — Valid JWT + `is_verified = TRUE` required (`get_verified_user`)
- 👑 **Admin** — Valid JWT + `role = ADMIN` required (`get_admin_user`)

---

### 4.1 System

---

#### `GET /`

**Description:** Health check — confirms the API server is running.  
**Auth:** 🔓 Public  
**Request:** None  

**Response `200 OK`:**
```json
{
  "message": "AI-Driven CMS API is running. Go to /docs for interactive documentation."
}
```

---

#### `POST /api/debug/trigger-scheduler`

**Description:** Manually fires the publish scheduler immediately. Useful for testing scheduled posts without waiting 30 seconds.  
**Auth:** 🔓 Public  
**Request:** None  

**Response `200 OK`:**
```json
{
  "message": "Scheduler triggered manually. Check backend logs for results."
}
```

---

### 4.2 Authentication

---

#### `POST /api/auth/register`

**Description:** Creates a new user account. Sends a 5-digit OTP code to the server terminal (and optionally email). The account is flagged as `is_verified = FALSE` until OTP is confirmed.  
**Auth:** 🔓 Public  

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | ✅ | Must be unique. Used as login identifier |
| `password` | string | ✅ | Plain-text password. Hashed with bcrypt before storage |

**Response `200 OK`:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "EDITOR",
  "is_verified": false
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Email already registered"` |

---

#### `POST /api/auth/login`

**Description:** Authenticates a user and returns a JWT Bearer token (7-day lifetime). The login endpoint accepts `application/x-www-form-urlencoded` data (OAuth2 password grant format), not JSON.  
**Auth:** 🔓 Public  

**Request Body** (`Content-Type: application/x-www-form-urlencoded`):
```
username=user@example.com&password=SecurePassword123
```

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | string | ✅ | The user's email address |
| `password` | string | ✅ | The user's plain-text password |

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Incorrect email or password"` |

---

#### `POST /api/auth/verify-otp`

**Description:** Submits the OTP code received at registration. On success, sets `is_verified = TRUE` on the user record, granting access to all protected endpoints.  
**Auth:** 🔓 Public  

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "48291"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | ✅ | The email address used during registration |
| `otp` | string | ✅ | The 5-digit code from the server terminal output |

**Response `200 OK`:**
```json
{
  "status": "success",
  "message": "OTP verified successfully!"
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"No active verification code found for this email."` |
| `400` | `"Invalid verification code. Please check your terminal console."` |

---

#### `POST /api/auth/resend-otp`

**Description:** Generates a new OTP code and replaces the previous entry in the in-memory store. The new code is printed to the server terminal.  
**Auth:** 🔓 Public  

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response `200 OK`:**
```json
{
  "status": "success",
  "message": "OTP resent successfully! Check your terminal console."
}
```

---

#### `GET /api/users/me`

**Description:** Returns the profile of the currently authenticated user.  
**Auth:** 🔐 Authenticated  

**Response `200 OK`:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "EDITOR",
  "is_verified": true
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `401` | `"Could not validate credentials"` |

---

### 4.3 Brands

---

#### `POST /api/brands/`

**Description:** Creates a new brand owned by the authenticated user.  
**Auth:** ✅ Verified  

**Request Body:**
```json
{
  "name": "TechPulse",
  "description": "A brand covering the latest in AI and startup news.",
  "niche": "technology",
  "quirks": "Loves analogies. Uses rhetorical questions. Gen-Z friendly.",
  "persona_guidelines": "Always optimistic. Never use jargon without explaining it.",
  "automation_mode": "manual"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Globally unique brand name |
| `description` | string | ❌ | Short brand description |
| `niche` | string | ❌ | Topic category. Required before AI generation |
| `quirks` | string | ❌ | Personality traits injected into the LLM prompt |
| `persona_guidelines` | string | ❌ | Content tone rules injected into the LLM prompt |
| `automation_mode` | string | ❌ | `"manual"`, `"semi-automated"`, or `"auto"`. Default: `"manual"` |

**Response `200 OK`:** Full `Brand` object (see schema in Section 2.2)

**Error Responses:**
| Status | Detail |
|---|---|
| `401` | Unauthorized (missing/invalid token) |
| `403` | `"Account not verified. Please verify your OTP first."` |

---

#### `GET /api/brands/`

**Description:** Returns all brands owned by the currently authenticated user.  
**Auth:** ✅ Verified  
**Query Params:** `skip` (int, default 0), `limit` (int, default 100)  

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "name": "TechPulse",
    "niche": "technology",
    "automation_mode": "manual",
    "twitter_username": null,
    "generations_today": 0,
    "posts_today": 0,
    "validation_rules": [],
    "posting_plan": null,
    ...
  }
]
```

---

#### `GET /api/brands/{brand_id}`

**Description:** Retrieves a single brand by ID. Returns 404 if the brand doesn't exist or is owned by another user.  
**Auth:** ✅ Verified  

**Path Params:** `brand_id` (int)  

**Response `200 OK`:** Full `Brand` object  

**Error Responses:**
| Status | Detail |
|---|---|
| `404` | `"Brand not found"` |

---

#### `PUT /api/brands/{brand_id}`

**Description:** Updates brand fields. OAuth token fields are **protected** — the frontend cannot accidentally wipe Twitter credentials via this endpoint.  
**Auth:** ✅ Verified  

**Path Params:** `brand_id` (int)  

**Request Body:** Same structure as `POST /api/brands/` (any subset of fields)

**Protected Fields (silently ignored even if sent):**
- `twitter_oauth2_access_token`
- `twitter_oauth2_refresh_token`
- `twitter_oauth2_token_expires_at`
- `twitter_username`
- `twitter_oauth_state`
- `twitter_oauth_code_verifier`

**Response `200 OK`:** Updated `Brand` object  

**Error Responses:**
| Status | Detail |
|---|---|
| `404` | `"Brand not found"` |

---

#### `PUT /api/brands/{brand_id}/mode`

**Description:** Updates the automation mode for a brand. Setting mode to `"auto"` immediately triggers `maintain_auto_queue()` to ensure the queue has at least 3 items.  
**Auth:** ✅ Verified  

**Request Body:**
```json
{
  "automation_mode": "auto"
}
```

| Value | Behaviour |
|---|---|
| `"manual"` | User controls all steps manually |
| `"semi-automated"` | AI generates content; human must approve |
| `"auto"` | Fully autonomous: AI generates, approves, schedules, and publishes |

**Response `200 OK`:** Updated `Brand` object  

---

### 4.4 Posting Plans

---

#### `GET /api/brands/{brand_id}/plan`

**Description:** Fetches the active posting schedule (days, time slots, volume) for a brand.  
**Auth:** ✅ Verified  

**Response `200 OK`:**
```json
{
  "id": 1,
  "brand_id": 1,
  "active_days": ["Monday", "Wednesday", "Friday"],
  "time_slots": ["09:00", "17:30"],
  "volume": "growth",
  "is_active": true
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `404` | `"Brand not found"` or `"Posting plan not found"` |

---

#### `POST /api/brands/{brand_id}/plan`

**Description:** Creates or updates the posting plan for a brand (upsert). After saving, `recalculate_queue()` is called automatically to re-slot any pending SCHEDULED or APPROVED items.  
**Auth:** ✅ Verified  

**Request Body:**
```json
{
  "active_days": ["Monday", "Wednesday", "Friday"],
  "time_slots": ["09:00", "17:30"],
  "volume": "growth",
  "is_active": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `active_days` | `string[]` | ✅ | Days of the week. Valid values: `"Monday"` through `"Sunday"` |
| `time_slots` | `string[]` | ✅ | Times in `"HH:MM"` 24h format. Maximum 3 slots |
| `volume` | string | ✅ | `"chill"`, `"growth"`, or `"viral"` |
| `is_active` | boolean | ❌ | Default `true`. Set to `false` to pause the schedule without deleting it |

**Response `200 OK`:** `PostingPlan` object  

---

### 4.5 Trends & AI Generation

---

#### `GET /api/brands/{brand_id}/trends`

**Description:** Returns 3 AI-refined, human-readable trending content angles for the brand's niche. Pulls real Google Trends data via pytrends, then uses Groq LLaMA (with Gemini fallback) to reframe raw queries into compelling content hooks.

**Cache:** Results are cached server-side for **4 hours** per niche key. Returns `[]` if the brand has no niche configured.  
**Auth:** ✅ Verified  

**Response `200 OK`:**
```json
[
  "Why ChatGPT's new memory feature is dividing power users",
  "How open-source models are outperforming GPT-4 on benchmarks",
  "The AI hardware shortage that nobody is talking about"
]
```

**Response when no niche set:** `[]`

---

#### `POST /api/brands/{brand_id}/generate`

**Description:** Triggers AI content generation for the brand. Produces 2-3 tweet drafts anchored to the given trend angle. Enforces a **daily limit of 4 generation runs** per brand per day.  
**Auth:** ✅ Verified  

**Request Body (optional):**
```json
{
  "trend": "Why ChatGPT's new memory feature is dividing power users"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `trend` | string | ❌ | A specific trend angle to write about. If omitted, defaults to `"General industry topics"` |

**Response `200 OK`:** Array of newly created `ContentItem` objects with `status: "DRAFT"`

```json
[
  {
    "id": 12,
    "brand_id": 1,
    "body": "ChatGPT's memory update is wild 🧠 Your AI now remembers you...",
    "status": "DRAFT",
    "scheduled_for": null,
    "tweet_id": null,
    "created_at": "2026-05-23T05:00:00",
    "author_id": null
  }
]
```

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Brand must have a niche set for AI generation"` |
| `404` | `"Brand not found"` |
| `429` | `"Daily post generation limit reached (4 max per day)"` |
| `500` | `"Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in the environment."` |

---

### 4.6 Content Lifecycle

---

#### `POST /api/brands/{brand_id}/content`

**Description:** Manually creates a content draft for a brand (bypasses AI generation).  
**Auth:** ✅ Verified  

**Request Body:**
```json
{
  "body": "Manually written tweet content here.",
  "scheduled_for": null,
  "tweet_id": null
}
```

**Response `200 OK`:** `ContentItem` object with `status: "DRAFT"`

---

#### `GET /api/brands/{brand_id}/content`

**Description:** Returns all content items for a brand, ordered by `created_at` descending (newest first).  
**Auth:** ✅ Verified  

**Response `200 OK`:** Array of `ContentItem` objects

```json
[
  {
    "id": 12,
    "brand_id": 1,
    "body": "Tweet body here",
    "status": "SCHEDULED",
    "scheduled_for": "2026-05-26T09:00:00",
    "tweet_id": null,
    "created_at": "2026-05-23T05:00:00",
    "author_id": 1
  }
]
```

---

#### `PUT /api/content/{content_id}`

**Description:** Edits the body of a DRAFT content item. Ownership is enforced — only the brand owner can edit.  
**Auth:** ✅ Verified  

**Path Params:** `content_id` (int)  

**Request Body:**
```json
{
  "body": "Updated tweet text goes here."
}
```

**Response `200 OK`:** Updated `ContentItem` object  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Only DRAFT content can be edited"` |
| `403` | `"Not authorized to edit this content"` |
| `404` | `"Content not found"` |

---

#### `DELETE /api/content/{content_id}`

**Description:** Permanently deletes a content item. If the item was SCHEDULED, `recalculate_queue()` and `maintain_auto_queue()` are triggered to fill the gap.  
**Auth:** ✅ Verified  

**Response `200 OK`:**
```json
{ "ok": true }
```

**Error Responses:**
| Status | Detail |
|---|---|
| `403` | `"Not authorized to delete this content"` |
| `404` | `"Content not found"` |

---

#### `POST /api/content/{content_id}/submit`

**Description:** Transitions a DRAFT to PENDING_APPROVAL for human review.  
**Auth:** ✅ Verified (no ownership check — any verified user can submit)  

**Response `200 OK`:** `ContentItem` with `status: "PENDING_APPROVAL"`  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Only DRAFT content can be submitted"` |

---

#### `POST /api/content/{content_id}/approve`

**Description:** Approves a content item. Accepts items in either `DRAFT` or `PENDING_APPROVAL` state (supports both direct-approval and review-then-approve flows).  
**Auth:** ✅ Verified (no ownership check)  

**Response `200 OK`:** `ContentItem` with `status: "APPROVED"`  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be DRAFT or PENDING_APPROVAL to approve"` |

---

#### `POST /api/content/{content_id}/reject`

**Description:** Rejects a content item that is in PENDING_APPROVAL.  
**Auth:** ✅ Verified (no ownership check)  

**Response `200 OK`:** `ContentItem` with `status: "REJECTED"`  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be PENDING_APPROVAL to reject"` |

---

#### `POST /api/content/{content_id}/schedule`

**Description:** Manually assigns a specific datetime to an APPROVED item and sets it to SCHEDULED.  
**Auth:** ✅ Verified (no ownership check)  

**Query Params:** `scheduled_for` (datetime, ISO 8601 format, e.g. `2026-05-26T09:00:00`)  

**Response `200 OK`:** `ContentItem` with `status: "SCHEDULED"` and the provided `scheduled_for` value  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be APPROVED to schedule"` |

---

#### `POST /api/content/{content_id}/smart_schedule`

**Description:** Automatically slots an APPROVED item into the next available calendar window defined by the brand's `PostingPlan`. Requires the brand to have an active posting plan configured. Uses a safe placeholder date (+365 days) before `recalculate_queue()` assigns the real slot.  
**Auth:** ✅ Verified (no ownership check)  

**Response `200 OK`:** `ContentItem` with `status: "SCHEDULED"` and the computed `scheduled_for` datetime  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be APPROVED to queue"` |
| `400` | `"Please configure a posting schedule in the Schedule Engine first."` |

---

#### `POST /api/content/{content_id}/approve_and_queue`

**Description:** Atomic operation — approves a DRAFT/PENDING_APPROVAL item and immediately smart-schedules it in a single transaction. Avoids the race condition that could occur if the two-step approve + smart_schedule requests were handled separately.  
**Auth:** ✅ Verified (ownership enforced)  

**Response `200 OK`:** `ContentItem` with `status: "SCHEDULED"`  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be DRAFT or PENDING_APPROVAL"` |
| `400` | `"Please configure a posting schedule in the Schedule Engine first."` |
| `403` | `"Not authorized to approve this content"` |

---

#### `POST /api/content/{content_id}/remove_queue`

**Description:** Pulls a SCHEDULED item back to DRAFT, clearing its `scheduled_for` timestamp. Triggers `recalculate_queue()` to compact remaining scheduled items and `maintain_auto_queue()` if the brand is in auto mode.  
**Auth:** ✅ Verified (ownership enforced)  

**Response `200 OK`:** `ContentItem` with `status: "DRAFT"`, `scheduled_for: null`  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be SCHEDULED to remove"` |
| `403` | `"Not authorized to modify this queue"` |

---

#### `POST /api/content/{content_id}/publish`

**Description:** Instantly publishes a content item (APPROVED or SCHEDULED) to Twitter/X via the brand's OAuth 2.0 access token. Auto-refreshes the token if expired. Falls back to a mock publish if no OAuth credentials are configured (for testing).  
**Auth:** ✅ Verified (no ownership check)  

**Response `200 OK`:** `ContentItem` with `status: "PUBLISHED"` and `tweet_id` populated  

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Content must be APPROVED or SCHEDULED to publish"` |
| `500` | `"Failed to post via OAuth 2.0: <Twitter error>"` |

---

### 4.7 Twitter/X OAuth 2.0

---

#### `GET /api/auth/twitter/login`

**Description:** Initiates the Twitter OAuth 2.0 PKCE flow for a brand. Generates a PKCE verifier/challenge pair and a CSRF state nonce, stores them in the brand record, and returns the Twitter authorization URL for the frontend to redirect the user to.  
**Auth:** 🔓 Public (brand_id provided as query param)  

**Query Params:** `brand_id` (int, required)  

**Response `200 OK`:**
```json
{
  "auth_url": "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256"
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `404` | `"Brand not found"` |
| `500` | `"TWITTER_CLIENT_ID not configured in backend environment"` |

---

#### `GET /api/auth/twitter/callback`

**Description:** OAuth 2.0 PKCE callback endpoint registered with Twitter Developer Portal. Validates the CSRF state, exchanges the authorization code for access/refresh tokens using the stored PKCE verifier, fetches the connected X username, and persists the tokens to the brand. Redirects browser to the frontend.  
**Auth:** 🔓 Public (called directly by Twitter's redirect)  

**Query Params (from Twitter):** `code` (string), `state` (string), or `error` (string on failure)  

**Redirect on Success:** `http://localhost:5173/brands?oauth=success&username=<handle>`  
**Redirect on Failure:** `http://localhost:5173/brands?oauth=failed&reason=<reason>`  

---

#### `POST /api/brands/{brand_id}/disconnect`

**Description:** Wipes the brand's stored Twitter OAuth credentials (`access_token`, `refresh_token`, `expires_at`, `username`). Does not revoke the token on Twitter's side.  
**Auth:** 🔓 Public (no auth check — consider adding one in a production hardening pass)  

**Response `200 OK`:** `Brand` object with all `twitter_*` fields set to `null`

---

### 4.8 Validation Rules

---

#### `POST /api/brands/{brand_id}/rules`

**Description:** Attaches a content validation rule to a brand.  
**Auth:** 🔓 Public (no auth check on this endpoint)  

**Request Body:**
```json
{
  "rule_type": "forbidden_words",
  "parameters": { "words": ["spam", "cheap", "free money"] }
}
```

**Response `200 OK`:** `ValidationRule` object  

---

#### `GET /api/brands/{brand_id}/rules`

**Description:** Lists all validation rules for a brand.  
**Auth:** 🔓 Public  

**Response `200 OK`:** Array of `ValidationRule` objects  

---

### 4.9 Admin Panel

> All endpoints in this section require `role = ADMIN`. Sending a request with an `EDITOR` token returns `403 Forbidden`.

---

#### `GET /api/admin/stats`

**Description:** Returns a comprehensive platform snapshot including user counts, brand counts, content pipeline breakdown, 7-day activity timeline, and niche distribution.  
**Auth:** 👑 Admin  

**Response `200 OK`:**
```json
{
  "stats": {
    "total_users": 42,
    "verified_users": 38,
    "unverified_users": 4,
    "total_brands": 115,
    "connected_brands": 87,
    "disconnected_brands": 28,
    "content": {
      "drafts": 203,
      "scheduled": 89,
      "published": 1204,
      "rejected": 17,
      "pending": 5
    }
  },
  "activity_timeline": [
    { "date": "May 17", "published": 12, "scheduled": 8 },
    { "date": "May 18", "published": 9, "scheduled": 11 }
  ],
  "niche_timeline": [
    { "niche": "technology", "count": 34 },
    { "niche": "football", "count": 18 }
  ]
}
```

---

#### `GET /api/admin/users`

**Description:** Returns all registered users with their full brand portfolios, including posting plan data and content counts.  
**Auth:** 👑 Admin  

**Response `200 OK`:** Array of user objects, each containing:
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "role": "EDITOR",
    "is_verified": true,
    "brands": [
      {
        "id": 1,
        "name": "TechPulse",
        "niche": "technology",
        "twitter_username": "TechPulseX",
        "automation_mode": "auto",
        "scheduled_count": 3,
        "published_count": 47,
        "posting_plan": {
          "active_days": ["Monday", "Wednesday", "Friday"],
          "time_slots": ["09:00"],
          "volume": "growth",
          "is_active": true
        }
      }
    ]
  }
]
```

---

#### `PUT /api/admin/users/{user_id}/role`

**Description:** Promotes or demotes a user's role. An admin cannot modify their own role.  
**Auth:** 👑 Admin  

**Path Params:** `user_id` (int)  

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Response `200 OK`:**
```json
{
  "ok": true,
  "user_id": 5,
  "new_role": "ADMIN"
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Cannot modify your own administrative role"` |
| `404` | `"User not found"` |

---

#### `DELETE /api/admin/users/{user_id}`

**Description:** Permanently deletes a user and all their associated data (brands, content, plans, rules) via cascade deletion. An admin cannot delete their own account.  
**Auth:** 👑 Admin  

**Response `200 OK`:**
```json
{
  "ok": true,
  "detail": "User and all associated data permanently deleted"
}
```

**Error Responses:**
| Status | Detail |
|---|---|
| `400` | `"Cannot delete your own administrative profile"` |
| `404` | `"User not found"` |

---

#### `PUT /api/admin/brands/{brand_id}/quota`

**Description:** Manually overrides the daily generation and posting counters for a brand. Useful for resetting limits during testing or granting a brand additional capacity.  
**Auth:** 👑 Admin  

**Path Params:** `brand_id` (int)  

**Request Body:**
```json
{
  "generations_today": 0,
  "posts_today": 0
}
```

**Response `200 OK`:**
```json
{
  "ok": true,
  "brand_id": 1,
  "generations_today": 0,
  "posts_today": 0
}
```

---

## Appendix A — Environment Variables Reference

All configuration is loaded from `backend/.env`. The server will throw a `RuntimeError` on startup if `DATABASE_URL` is missing.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Format: `postgresql://user:password@host:port/dbname` |
| `GEMINI_API_KEY` | ✅ (primary LLM) | Google Gemini API key for AI generation |
| `GROQ_API_KEY` | ❌ (preferred) | Groq API key. If present, used instead of Gemini for faster inference |
| `TWITTER_CLIENT_ID` | ✅ (for X features) | OAuth 2.0 client ID from the Twitter Developer Portal |
| `TWITTER_CLIENT_SECRET` | ✅ (for X features) | OAuth 2.0 client secret |
| `SMTP_HOST` | ❌ | SMTP relay host (Brevo). OTPs currently print to terminal as fallback |
| `SMTP_PORT` | ❌ | SMTP port (typically `587`) |
| `SMTP_USER` | ❌ | SMTP authentication username |
| `SMTP_PASSWORD` | ❌ | SMTP authentication password |
| `SMTP_FROM` | ❌ | Sender email address |
| `SECRET_KEY` | ❌ | JWT signing secret. Defaults to a hardcoded dev key if unset — **always override in production** |

---

## Appendix B — Rate Limits Summary

| Resource | Limit | Scope | Reset |
|---|---|---|---|
| AI Content Generation | 4 runs/day | Per brand | Midnight (UTC) |
| Social Post Publishing | 3 posts/day | Per brand | Midnight (UTC) |
| Scheduler Interval | Every 30 seconds | System-wide | N/A |
| Trend Cache TTL | 4 hours | Per niche keyword | Rolling |
| JWT Token Lifetime | 7 days | Per token | After expiry |
| Auto-Queue Threshold | 3 scheduled items minimum | Per brand in `auto` mode | Continuous |
