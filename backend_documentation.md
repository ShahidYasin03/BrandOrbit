# BrandOrbit — Backend Documentation

**Project**: AI-Driven Multi-Brand Content Management System  
**Technology Stack**: Python · FastAPI · SQLAlchemy · PostgreSQL · APScheduler  
**Entry Point**: `backend/main.py`  
**Base URL** (development): `http://localhost:8000`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project File Structure](#2-project-file-structure)
3. [Environment Variables (.env)](#3-environment-variables-env)
4. [Dependencies (requirements.txt)](#4-dependencies)
5. [Database Configuration](#5-database-configuration)
6. [Data Models](#6-data-models)
7. [Pydantic Schemas](#7-pydantic-schemas)
8. [Authentication System](#8-authentication-system)
9. [Background Scheduler](#9-background-scheduler)
10. [AI Content Generation Engine](#10-ai-content-generation-engine)
11. [Trend Intelligence Engine](#11-trend-intelligence-engine)
12. [API Endpoints Reference](#12-api-endpoints-reference)
    - [Root & Debug](#121-root--debug-endpoints)
    - [Authentication](#122-authentication-endpoints)
    - [User Profile](#123-user-profile-endpoint)
    - [Brands](#124-brand-endpoints)
    - [Posting Plan](#125-posting-plan-endpoints)
    - [Content Lifecycle](#126-content-lifecycle-endpoints)
    - [Twitter OAuth 2.0](#127-twitter-oauth-20-endpoints)
    - [Validation Rules](#128-validation-rules-endpoints)
    - [Admin Panel](#129-admin-panel-endpoints)
13. [Content Status State Machine](#13-content-status-state-machine)
14. [Queue Recalculation Logic](#14-queue-recalculation-logic)
15. [Email OTP Service](#15-email-otp-service)
16. [Error Handling Patterns](#16-error-handling-patterns)
17. [Rate Limiting](#17-rate-limiting)
18. [Running the Backend](#18-running-the-backend)

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                    FastAPI Application                     │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Auth Layer │  │  API Routes  │  │  Admin Routes   │  │
│  │  (JWT/OTP)  │  │  (REST CRUD) │  │  (/api/admin/*) │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
│           │               │                   │           │
│  ┌────────────────────────────────────────────────────┐   │
│  │              SQLAlchemy ORM Layer                  │   │
│  │  User · Brand · ContentItem · PostingPlan · Rules  │   │
│  └────────────────────────────────────────────────────┘   │
│           │                                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │           PostgreSQL Database (pg8000 driver)       │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  APScheduler (Background — every 30 seconds)        │  │
│  │  → Publishes SCHEDULED content items via Twitter    │  │
│  │  → Enforces daily post limit (3 per brand/day)      │  │
│  │  → Calls maintain_auto_queue() to replenish AI fill │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │  AI Generation        │  │  Trend Intelligence      │   │
│  │  Groq LLaMA-3.3-70B  │  │  pytrends + LLM Refine   │   │
│  │  Google Gemini Flash  │  │  4-hour cache TTL        │   │
│  └──────────────────────┘  └──────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

**CORS**: All origins are allowed (`allow_origins=["*"]`) for local development.

---

## 2. Project File Structure

```
backend/
├── main.py           # All routes, scheduler, AI logic, OTP, Twitter OAuth
├── models.py         # SQLAlchemy ORM model definitions
├── schemas.py        # Pydantic request/response schemas
├── auth.py           # JWT authentication helpers & dependency guards
├── database.py       # SQLAlchemy engine & session setup
├── promote_user.py   # Standalone script to manually promote a user to ADMIN
├── requirements.txt  # Python package dependencies (pinned versions)
├── __init__.py       # Package marker
└── .env              # Environment secrets (not committed to VCS)
```

---

## 3. Environment Variables (.env)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. Example: `postgresql://user:pass@localhost:5432/brandorbit` |
| `SECRET_KEY` | No | JWT signing secret. Defaults to a hardcoded fallback (change in production) |
| `GROQ_API_KEY` | No* | API key for Groq LLaMA-3.3-70B AI model |
| `GEMINI_API_KEY` | No* | API key for Google Gemini Flash (fallback AI) |
| `TWITTER_CLIENT_ID` | No** | Twitter/X OAuth 2.0 App Client ID |
| `TWITTER_CLIENT_SECRET` | No** | Twitter/X OAuth 2.0 App Client Secret |
| `GMAIL_USER` | No | Gmail address for sending OTP verification emails |
| `GMAIL_APP_PASSWORD` | No | Gmail App Password (not your login password) |

> *At least one of `GROQ_API_KEY` or `GEMINI_API_KEY` must be set for AI generation to work. If neither is set, content is not generated.  
> **Twitter keys are required for real posting. Without them, the system uses mock publish mode.

---

## 4. Dependencies

Key packages from `requirements.txt`:

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.136.1 | Web framework & REST API |
| `uvicorn` | 0.46.0 | ASGI server |
| `sqlalchemy` | 2.0.49 | ORM for PostgreSQL |
| `pg8000` | 1.31.5 | Pure-Python PostgreSQL driver |
| `pydantic` | 2.13.4 | Data validation & serialization |
| `python-jose` | 3.5.0 | JWT token creation & verification |
| `passlib` | 1.7.4 | bcrypt password hashing |
| `APScheduler` | 3.11.2 | Background job scheduling |
| `groq` | 1.2.0 | Groq AI (LLaMA-3.3-70B) client |
| `google-generativeai` | 0.8.6 | Google Gemini AI client |
| `pytrends` | 4.9.2 | Google Trends API wrapper |
| `tweepy` | 4.16.0 | Twitter API client |
| `python-dotenv` | 1.2.2 | `.env` file loading |
| `requests` | 2.34.1 | HTTP client for Twitter token exchange |

---

## 5. Database Configuration

**File**: [`database.py`](file:///BrandOrbit/backend/database.py)

The database layer uses SQLAlchemy with the pg8000 pure-Python driver for compatibility with Python 3.12+.

```python
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
# Normalizes both "postgresql://" and "postgres://" to "postgresql+pg8000://"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

### DB Session Dependency

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Used with `Depends(get_db)` on every endpoint that needs database access. Tables are auto-created at startup via `models.Base.metadata.create_all(bind=engine)`.

---

## 6. Data Models

**File**: [`models.py`](file:///BrandOrbit/backend/models.py)

### 6.1 Enums

#### `StatusEnum` (Content lifecycle states)
| Value | Description |
|---|---|
| `DRAFT` | Newly generated/created, not yet reviewed |
| `PENDING_APPROVAL` | Submitted for review |
| `APPROVED` | Human-approved, ready to schedule |
| `REJECTED` | Rejected during review |
| `SCHEDULED` | Slotted into the posting queue with a date/time |
| `PUBLISHED` | Successfully posted to Twitter/X |

#### `UserRoleEnum`
| Value | Description |
|---|---|
| `ADMIN` | Full system access including admin panel |
| `EDITOR` | Standard user, can manage own brands/content |

---

### 6.2 `User` Model

**Table**: `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, indexed | Primary key |
| `email` | String | unique, indexed | User email address |
| `hashed_password` | String | — | bcrypt-hashed password |
| `role` | Enum(UserRoleEnum) | default=EDITOR | User role |
| `is_verified` | Boolean | default=False | OTP verification status |

**Relationships**:
- `content_items` → one-to-many with `ContentItem` (cascade delete)
- `brands` → one-to-many with `Brand` (cascade delete)

---

### 6.3 `Brand` Model

**Table**: `brands`

| Column | Type | Description |
|---|---|---|
| `id` | Integer PK | Primary key |
| `name` | String unique | Brand display name |
| `description` | Text | Brief brand description |
| `niche` | String nullable | Industry niche (e.g. "Tech Startup") |
| `quirks` | Text nullable | Tone quirks used in AI prompts |
| `persona_guidelines` | Text | General content guidelines |
| `twitter_oauth2_access_token` | String nullable | Current OAuth 2.0 access token |
| `twitter_oauth2_refresh_token` | String nullable | OAuth 2.0 refresh token |
| `twitter_oauth2_token_expires_at` | DateTime nullable | Token expiry timestamp |
| `twitter_username` | String nullable | Connected Twitter handle |
| `twitter_oauth_state` | String nullable | PKCE state (transient) |
| `twitter_oauth_code_verifier` | String nullable | PKCE verifier (transient) |
| `automation_mode` | String | `"manual"` or `"auto"` |
| `generations_today` | Integer | AI generation counter (resets daily) |
| `last_generation_date` | Date nullable | Date of last generation reset |
| `posts_today` | Integer | Posts published today counter |
| `last_post_date` | Date nullable | Date of last post reset |
| `created_at` | DateTime | Record creation time (UTC) |
| `owner_id` | Integer FK → users | Owning user |

**Relationships**:
- `owner` → belongs to `User`
- `content_items` → one-to-many with `ContentItem` (cascade delete)
- `validation_rules` → one-to-many with `ValidationRule` (cascade delete)
- `posting_plan` → one-to-one with `PostingPlan` (cascade delete)

---

### 6.4 `PostingPlan` Model

**Table**: `posting_plans`

| Column | Type | Description |
|---|---|---|
| `id` | Integer PK | Primary key |
| `brand_id` | Integer FK unique → brands | Owning brand (one plan per brand) |
| `active_days` | JSON | List of active day names e.g. `["Monday", "Wednesday", "Friday"]` |
| `time_slots` | JSON | List of HH:MM strings e.g. `["09:00", "17:00"]` |
| `volume` | String | AI volume strategy: `"chill"`, `"growth"`, or `"viral"` |
| `is_active` | Boolean | Whether the schedule is active or paused |

---

### 6.5 `ContentItem` Model

**Table**: `content_items`

| Column | Type | Description |
|---|---|---|
| `id` | Integer PK | Primary key |
| `brand_id` | Integer FK → brands | Owning brand |
| `body` | Text | Post text content (≤280 chars for Twitter) |
| `status` | Enum(StatusEnum) | Lifecycle state (default: DRAFT) |
| `scheduled_for` | DateTime nullable | When to publish |
| `tweet_id` | String nullable | Twitter tweet ID after publishing |
| `created_at` | DateTime | Creation timestamp (UTC) |
| `author_id` | Integer FK → users | User who created the item |

---

### 6.6 `ValidationRule` Model

**Table**: `validation_rules`

| Column | Type | Description |
|---|---|---|
| `id` | Integer PK | Primary key |
| `brand_id` | Integer FK → brands | Owning brand |
| `rule_type` | String | Rule category (e.g. `"forbidden_words"`, `"max_length"`) |
| `parameters` | JSON | Rule configuration (e.g. `{"words": ["spam"]}`) |

---

## 7. Pydantic Schemas

**File**: [`schemas.py`](file:///BrandOrbit/backend/schemas.py)

All schemas use `from_attributes = True` (Pydantic v2) for SQLAlchemy ORM compatibility.

### User Schemas
| Schema | Fields | Purpose |
|---|---|---|
| `UserBase` | email, role, is_verified | Shared base |
| `UserCreate` | + password | Registration request body |
| `User` | + id | Response model |
| `Token` | access_token, token_type | JWT login response |
| `TokenData` | email | Internal JWT payload |

### Brand Schemas
| Schema | Fields | Purpose |
|---|---|---|
| `BrandBase` | name, description, niche, quirks, persona_guidelines, twitter_*, automation_mode, generations_today, last_generation_date, posts_today, last_post_date | Shared base |
| `BrandCreate` | (same as BrandBase) | Create/update request body |
| `Brand` | + id, created_at, validation_rules, posting_plan | Full response model |

### Content Schemas
| Schema | Fields | Purpose |
|---|---|---|
| `ContentItemBase` | body, scheduled_for, tweet_id | Shared base |
| `ContentItemCreate` | (same) | Create request body |
| `ContentItemUpdate` | body | Edit DRAFT request body |
| `ContentItem` | + id, brand_id, status, created_at, author_id | Full response model |
| `TrendGenerateRequest` | trend (optional str) | AI generation trigger body |

### PostingPlan Schemas
| Schema | Fields | Purpose |
|---|---|---|
| `PostingPlanBase` | active_days, time_slots, volume, is_active | Shared base |
| `PostingPlanCreate` | (same) | Save plan request body |
| `PostingPlan` | + id, brand_id | Full response model |

### Admin Schemas
| Schema | Fields | Purpose |
|---|---|---|
| `AdminUserDetail` | id, email, role, is_verified, brands | Admin user list response |
| `AdminUserRoleUpdate` | role | Role update request body |
| `AdminBrandQuotaUpdate` | generations_today, posts_today | Quota override request body |

---

## 8. Authentication System

**File**: [`auth.py`](file:///BrandOrbit/backend/auth.py)

### Configuration
```python
SECRET_KEY = os.getenv("SECRET_KEY", "<default_fallback>")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
```

### Functions

| Function | Signature | Description |
|---|---|---|
| `verify_password` | `(plain, hashed) → bool` | bcrypt password verification |
| `get_password_hash` | `(password) → str` | bcrypt hash a password |
| `create_access_token` | `(data, expires_delta) → str` | Create a signed JWT |
| `get_current_user` | `async (token, db) → User` | Decode JWT, return User (raises 401 if invalid) |
| `get_verified_user` | `async (current_user) → User` | Guard: requires `is_verified=True` (raises 403) |
| `get_admin_user` | `async (current_user) → User` | Guard: requires `role=ADMIN` (raises 403) |

### Dependency Chain

```
get_current_user
      ↓ (guards: is_verified)
get_verified_user          ← used on all protected brand/content routes
      ↓ (guards: role=ADMIN)
get_admin_user             ← used on all /api/admin/* routes
```

### OTP Flow

OTP codes are stored in an **in-memory dictionary** `_otp_store: dict = {}`:
```
{ email: otp_code_string }
```
- Generated as a 5-digit random integer (10000–99999)
- Delivered via Gmail SMTP or printed to terminal (fallback)
- **Consumed on verification** — deleted from store after successful verify
- No expiry timer (persists until used or server restarts)

---

## 9. Background Scheduler

**Technology**: APScheduler `BackgroundScheduler` with `IntervalTrigger`

### Job Configuration
```python
scheduler.add_job(
    publish_scheduled_content,
    trigger=IntervalTrigger(seconds=30),
    id='publish_job',
    name='Publish Scheduled Content',
    replace_existing=True
)
```
Fires every **30 seconds**. Starts on `startup` event, shuts down on `shutdown` event.

### `publish_scheduled_content()` — Logic Flow

```
1. Open new DB session
2. Query all ContentItems WHERE status=SCHEDULED AND scheduled_for <= now
3. For each item:
   a. Look up owning Brand
   b. Check if brand's PostingPlan.is_active == True (skip if paused)
   c. Reset posts_today counter if new calendar day
   d. Check posts_today < 3 (daily limit enforcement)
   e. Get valid OAuth 2.0 token (refresh if expired)
   f. If token available:
      → POST to https://api.twitter.com/2/tweets
      → On 201 success: save tweet_id, mark PUBLISHED
      → On failure: save "failed:{status}" as tweet_id
   g. If no token:
      → Mock publish: tweet_id = "mock_tweet_id_no_keys", mark PUBLISHED
   h. Increment brand.posts_today
   i. Call maintain_auto_queue() to replenish if auto-pilot mode
4. Close DB session
```

---

## 10. AI Content Generation Engine

### `_trigger_ai_generation(brand_id, db, trend_context)`

Internal helper called by both the public `/generate` endpoint and the auto-queue maintainer.

**Rate limit**: Maximum **4 generations per brand per day** (tracked via `generations_today` and `last_generation_date` columns).

**Prompt template**:
```
You are an expert social media manager for brand '{brand.name}'.
Niche: {brand.niche}
Brand Quirks: {brand.quirks}
Persona Guidelines: {brand.persona_guidelines}
Focus Topic / Trend: {trend_context}

Task: Write 2-3 highly engaging posts under 280 characters each.
Separate posts with '|||'. No extra conversational text.
```

**AI Provider Fallback Chain**:
1. Try **Groq LLaMA-3.3-70B** (`groq_key`)
2. If Groq fails → Try **Google Gemini Flash** (`gemini_key`)
3. If neither is configured → Return empty list

**Output parsing**: Splits response on `'|||'` separator, creates one `ContentItem` per segment with `status=DRAFT`.

---

### `maintain_auto_queue(brand_id, db)`

Called after every publish event (scheduler) and after generation.

```
1. Check brand.automation_mode == "auto"
2. Count currently SCHEDULED items → queued_count
3. needed = 3 - queued_count
4. If needed > 0:
   a. Pull oldest DRAFT/PENDING_APPROVAL items up to `needed`
   b. If still not enough → call _trigger_ai_generation() to make more
   c. Set selected drafts to status=SCHEDULED, scheduled_for=now+365days (placeholder)
   d. Call recalculate_queue() to assign real slots
```

---

## 11. Trend Intelligence Engine

### `get_trends_for_brand(brand_id, db, current_user)`

**Cache**: In-memory dict `_trend_cache` with 4-hour TTL (keyed by `niche.lower()`).

**Pipeline**:

```
Step 1: pytrends
  → TrendReq for niche keyword (past 7 days)
  → Prefer "rising" queries over "top" queries
  → Take top 5 raw queries

Step 2: LLM Refinement
  If pytrends data available:
    → Prompt LLM to reframe raw queries as engaging content angles
  If pytrends failed:
    → Prompt LLM to generate 3 trending content angles from knowledge
  
  → Returns comma-separated list of exactly 3 topic angles
  → Strips surrounding quotes, pads with "General Industry Trend" if < 3

Step 3: Cache result for 4 hours
Step 4: Return List[str] of 3 topics
```

---

## 12. API Endpoints Reference

### 12.1 Root & Debug Endpoints

#### `GET /`
Returns API health message and link to interactive docs.

**Response** `200`:
```json
{ "message": "AI-Driven CMS API is running. Go to /docs for interactive documentation." }
```

---

#### `POST /api/debug/trigger-scheduler`
Manually triggers `publish_scheduled_content()` immediately. Useful for testing.

**Response** `200`:
```json
{ "message": "Scheduler triggered manually. Check backend logs for results." }
```

---

### 12.2 Authentication Endpoints

#### `POST /api/auth/register`
Registers a new user. Sends OTP verification email.

**Request Body** (JSON):
```json
{
  "email": "user@example.com",
  "password": "secretpassword",
  "role": "EDITOR"
}
```

**Response** `200` — `User` schema:
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "EDITOR",
  "is_verified": false
}
```

**Errors**:
- `400` — Email already registered

**Side Effects**: Generates OTP, stores in `_otp_store`, sends email via Gmail SMTP.

---

#### `POST /api/auth/login`
Authenticates a user. Uses OAuth2 form-encoded format.

**Request Body** (`application/x-www-form-urlencoded`):
```
username=user@example.com&password=secretpassword
```

**Response** `200` — `Token` schema:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors**:
- `400` — Incorrect email or password

---

#### `POST /api/auth/verify-otp`
Verifies the OTP code sent to the user's email. Sets `user.is_verified = True`.

**Request Body** (JSON):
```json
{
  "email": "user@example.com",
  "otp": "48321"
}
```

**Response** `200`:
```json
{ "status": "success", "message": "OTP verified successfully!" }
```

**Errors**:
- `400` — No active code found for email
- `400` — Invalid verification code

---

#### `POST /api/auth/resend-otp`
Generates and sends a fresh OTP.

**Request Body** (JSON):
```json
{ "email": "user@example.com" }
```

**Response** `200`:
```json
{ "status": "success", "message": "A new verification code has been sent to your email." }
```

---

### 12.3 User Profile Endpoint

#### `GET /api/users/me`
Returns the currently authenticated user's profile.

**Auth**: Bearer token required  
**Response** `200` — `User` schema

---

### 12.4 Brand Endpoints

> All brand endpoints require **Bearer token** + **verified account** (`get_verified_user`).

#### `POST /api/brands/`
Creates a new brand for the authenticated user.

**Request Body** — `BrandCreate` schema (JSON):
```json
{
  "name": "NexusTech",
  "description": "A cutting-edge AI startup",
  "niche": "Tech Startup",
  "quirks": "Uses Gen-Z slang, lots of emojis",
  "persona_guidelines": "Professional yet approachable",
  "automation_mode": "manual"
}
```

**Response** `200` — `Brand` schema (includes `id`, `created_at`, empty `validation_rules`, null `posting_plan`)

---

#### `GET /api/brands/`
Lists all brands owned by the current user.

**Query Params**: `skip` (int, default 0), `limit` (int, default 100)  
**Response** `200` — `List[Brand]`

---

#### `GET /api/brands/{brand_id}`
Gets a single brand by ID (must be owner).

**Response** `200` — `Brand` schema  
**Errors**: `404` — Brand not found

---

#### `PUT /api/brands/{brand_id}`
Updates a brand's basic fields. **Protected fields** (OAuth tokens, twitter_username, etc.) are automatically excluded from updates to prevent accidental token overwrites.

**Request Body** — `BrandCreate` schema  
**Response** `200` — `Brand` schema  
**Errors**: `404` — Brand not found

---

#### `PUT /api/brands/{brand_id}/mode`
Switches the brand between `"manual"` and `"auto"` automation modes.

**Request Body** (JSON):
```json
{ "automation_mode": "auto" }
```

**Response** `200` — `Brand` schema  
**Side Effects**: If switching to `"auto"`, calls `maintain_auto_queue()` immediately.

---

### 12.5 Posting Plan Endpoints

#### `GET /api/brands/{brand_id}/plan`
Gets the posting plan for a brand.

**Response** `200` — `PostingPlan` schema:
```json
{
  "id": 1,
  "brand_id": 5,
  "active_days": ["Monday", "Wednesday", "Friday"],
  "time_slots": ["09:00", "17:00"],
  "volume": "growth",
  "is_active": true
}
```
**Errors**: `404` — Brand not found, or posting plan not found

---

#### `POST /api/brands/{brand_id}/plan`
Creates or updates the posting plan (upsert). Triggers `recalculate_queue()` after saving.

**Request Body** — `PostingPlanCreate` schema:
```json
{
  "active_days": ["Monday", "Wednesday", "Friday"],
  "time_slots": ["09:00", "17:00"],
  "volume": "growth",
  "is_active": true
}
```

**Response** `200` — `PostingPlan` schema  
**Side Effects**: Calls `recalculate_queue()` which re-slots all SCHEDULED items.

---

### 12.6 Content Lifecycle Endpoints

#### `POST /api/brands/{brand_id}/content`
Manually creates a content item for a brand.

**Request Body** — `ContentItemCreate` schema:
```json
{ "body": "This is my tweet content" }
```

**Response** `200` — `ContentItem` schema

---

#### `GET /api/brands/{brand_id}/content`
Lists all content items for a brand, ordered by `created_at` descending.

**Response** `200` — `List[ContentItem]`

---

#### `GET /api/brands/{brand_id}/trends`
Fetches trending topics for the brand's niche using pytrends + LLM refinement.

**Response** `200` — `List[str]` (3 topic strings)  
**Cache**: 4-hour in-memory cache per niche keyword.

---

#### `POST /api/brands/{brand_id}/generate`
AI-generates 2–3 posts for the brand based on an optional trend.

**Request Body** (JSON, optional):
```json
{ "trend": "How AI is disrupting traditional job markets" }
```
If omitted, uses `"General industry topics"` as context.

**Response** `200` — `List[ContentItem]` (new DRAFT items)  
**Errors**:
- `400` — Brand has no niche set
- `429` — Daily generation limit reached (4 max per brand per day)
- `500` — No API keys configured

---

#### `PUT /api/content/{content_id}`
Edits the body of a DRAFT content item.

**Request Body** — `ContentItemUpdate` schema:
```json
{ "body": "Updated tweet text here" }
```

**Response** `200` — `ContentItem` schema  
**Errors**:
- `400` — Only DRAFT content can be edited
- `403` — Not authorized (not brand owner)
- `404` — Content not found

---

#### `DELETE /api/content/{content_id}`
Permanently deletes a content item. If item was SCHEDULED, recalculates the queue.

**Response** `200`:
```json
{ "ok": true }
```

---

#### `POST /api/content/{content_id}/submit`
Transitions a DRAFT item to `PENDING_APPROVAL`.

**Response** `200` — `ContentItem` schema  
**Errors**: `400` — Only DRAFT can be submitted

---

#### `POST /api/content/{content_id}/approve`
Transitions DRAFT or PENDING_APPROVAL to `APPROVED`.

**Response** `200` — `ContentItem` schema

---

#### `POST /api/content/{content_id}/reject`
Transitions `PENDING_APPROVAL` to `REJECTED`.

**Response** `200` — `ContentItem` schema  
**Errors**: `400` — Must be PENDING_APPROVAL

---

#### `POST /api/content/{content_id}/schedule`
Manually schedules an APPROVED item for a specific datetime.

**Query Param**: `scheduled_for` (ISO datetime string)  
**Response** `200` — `ContentItem` schema  
**Errors**: `400` — Must be APPROVED

---

#### `POST /api/content/{content_id}/smart_schedule`
Atomically schedules an APPROVED item into the next available slot from the posting plan.

**Response** `200` — `ContentItem` schema  
**Errors**:
- `400` — Must be APPROVED
- `400` — No posting plan configured

**Logic**: Sets `scheduled_for = now + 365 days` as placeholder, then calls `recalculate_queue()` to assign real slot.

---

#### `POST /api/content/{content_id}/approve_and_queue`
**Atomic operation**: Approves AND immediately queues a DRAFT/PENDING item in one call. Prevents the race condition between separate approve + smart_schedule calls.

**Auth**: Requires verified user + brand ownership  
**Response** `200` — `ContentItem` schema  
**Errors**: `400` — No posting plan configured, `403` — Not authorized

---

#### `POST /api/content/{content_id}/remove_queue`
Removes a SCHEDULED item back to DRAFT status. Recalculates the queue.

**Auth**: Requires verified user + brand ownership  
**Response** `200` — `ContentItem` schema  
**Errors**: `400` — Must be SCHEDULED

---

#### `POST /api/content/{content_id}/publish`
Immediately publishes an APPROVED or SCHEDULED item to Twitter/X via OAuth 2.0.

**Response** `200` — `ContentItem` schema with `status=PUBLISHED` and `tweet_id`  
**Mock behavior**: If no OAuth token configured, mock-publishes and marks as PUBLISHED.

---

### 12.7 Twitter OAuth 2.0 Endpoints

Uses **OAuth 2.0 PKCE** (Proof Key for Code Exchange) for maximum security.

#### `GET /api/auth/twitter/login?brand_id={id}`
Initiates the Twitter OAuth 2.0 PKCE flow for a brand.

**Flow**:
1. Generates PKCE `verifier` (128-char URL-safe random) + `challenge` (SHA256 base64url)
2. Generates random `state` token
3. Saves `state` and `verifier` to brand record
4. Returns Twitter authorization URL

**Response** `200`:
```json
{ "auth_url": "https://twitter.com/i/oauth2/authorize?..." }
```

**Scopes requested**: `tweet.read tweet.write users.read offline.access`

---

#### `GET /api/auth/twitter/callback?code=...&state=...`
Handles the Twitter OAuth callback after user authorization.

**Flow**:
1. Validates `state` against stored brand record
2. Exchanges `code` for access + refresh tokens
3. Fetches Twitter username via `/2/users/me`
4. Stores tokens + expiry + username to brand
5. Clears transient PKCE fields
6. Redirects to `http://localhost:5173/brands?oauth=success&username=<handle>`

**On Error**: Redirects to `http://localhost:5173/brands?oauth=failed&reason=...`

---

#### `POST /api/brands/{brand_id}/disconnect`
Disconnects the Twitter account from a brand (clears all token fields).

**Response** `200` — `Brand` schema (with null Twitter fields)

---

#### Token Refresh Logic — `get_valid_twitter_token(db_brand, db)`

Called before every publish attempt. Automatically refreshes the access token if it is expired or expires within 5 minutes:
```
1. Check if access_token + refresh_token exist
2. If token_expires_at - 5min <= now → refresh
3. POST to https://api.twitter.com/2/oauth2/token with refresh_token grant
4. Save new access_token, refresh_token, expires_at to DB
5. Return valid access_token (or None on failure)
```

---

### 12.8 Validation Rules Endpoints

#### `POST /api/brands/{brand_id}/rules`
Adds a validation rule to a brand.

**Request Body** — `ValidationRuleCreate` schema:
```json
{
  "rule_type": "forbidden_words",
  "parameters": { "words": ["spam", "free money"] }
}
```

**Response** `200` — `ValidationRule` schema

---

#### `GET /api/brands/{brand_id}/rules`
Lists all validation rules for a brand.

**Response** `200` — `List[ValidationRule]`

---

### 12.9 Admin Panel Endpoints

> All admin endpoints require **Bearer token** + **verified account** + **ADMIN role** (`get_admin_user`).

#### `GET /api/admin/stats`
Returns system-wide statistics for the admin dashboard.

**Response** `200`:
```json
{
  "stats": {
    "total_users": 10,
    "verified_users": 8,
    "unverified_users": 2,
    "total_brands": 15,
    "connected_brands": 9,
    "disconnected_brands": 6,
    "content": {
      "drafts": 45,
      "scheduled": 22,
      "published": 130,
      "rejected": 5,
      "pending": 3
    }
  },
  "activity_timeline": [
    { "date": "May 26", "published": 3, "scheduled": 7 },
    ...  // 7 days of data
  ],
  "niche_timeline": [
    { "niche": "Tech Startup", "count": 4 },
    ...
  ]
}
```

---

#### `GET /api/admin/users`
Returns all users with full brand details, content counts, and posting plan data.

**Response** `200` — Array of user objects with expanded brand data including `scheduled_count`, `published_count`, and `posting_plan` details.

---

#### `PUT /api/admin/users/{user_id}/role`
Promotes or demotes a user's role.

**Request Body** (JSON):
```json
{ "role": "ADMIN" }
```

**Response** `200`:
```json
{ "ok": true, "user_id": 3, "new_role": "ADMIN" }
```

**Errors**:
- `400` — Cannot modify your own role
- `404` — User not found

---

#### `DELETE /api/admin/users/{user_id}`
Permanently deletes a user and all associated data (cascading delete: brands, content, plans, rules).

**Response** `200`:
```json
{ "ok": true, "detail": "User and all associated data permanently deleted" }
```

**Errors**:
- `400` — Cannot delete your own account
- `404` — User not found

---

#### `PUT /api/admin/brands/{brand_id}/quota`
Overrides a brand's daily usage counters (useful for resetting limits in testing/support).

**Request Body** (JSON):
```json
{
  "generations_today": 0,
  "posts_today": 0
}
```

**Response** `200`:
```json
{
  "ok": true,
  "brand_id": 5,
  "generations_today": 0,
  "posts_today": 0
}
```

---

## 13. Content Status State Machine

```
                    ┌─────────┐
         [create]   │  DRAFT  │
         ──────────►│         │◄───────────────────────────
                    └────┬────┘                           │
                         │ /submit                        │
                         ▼                                │
               ┌──────────────────┐                       │
               │ PENDING_APPROVAL │                       │
               └────────┬─────────┘                       │
                        │                                 │
            ┌───────────┤                                 │
            │ /reject   │ /approve                        │
            ▼           ▼                                 │
        ┌──────────┐ ┌──────────┐                         │
        │ REJECTED │ │ APPROVED │                         │
        └──────────┘ └────┬─────┘                         │
                          │ /schedule or /smart_schedule   │
                          │ or approve_and_queue           │
                          ▼                               │
                    ┌───────────┐                         │
                    │ SCHEDULED │──── /remove_queue ──────┘
                    └─────┬─────┘       (→ DRAFT)
                          │ scheduler fires OR /publish
                          ▼
                    ┌───────────┐
                    │ PUBLISHED │
                    └───────────┘
```

**Direct shortcut**: `approve_and_queue` goes directly `DRAFT → SCHEDULED`.

---

## 14. Queue Recalculation Logic

### `recalculate_queue(brand_id, db)`

Assigns real datetime slots to all SCHEDULED items based on the PostingPlan configuration.

**Algorithm**:
```
1. Fetch PostingPlan for brand
2. Fetch all SCHEDULED + APPROVED items (ordered by created_at)
3. If no plan or plan has no active_days/time_slots:
   → Revert all items to APPROVED status (remove scheduled dates)
4. Build slot list:
   - Start from now, iterate day by day
   - For each day matching active_days[], add each time_slot as a datetime
   - Stop when we have enough slots for all items
5. Assign slots[i] → items[i].scheduled_for
6. Commit
```

This ensures items are always slotted in chronological order into the next available posting windows.

---

## 15. Email OTP Service

### `send_otp_email(to_email, otp_code, is_resend)`

Sends an HTML-formatted OTP email.

**Gmail SMTP Connection**:
```
Server: smtp.gmail.com:587
Security: STARTTLS
Auth: App Password (not Google account password)
```

**Fallback**: If `GMAIL_USER` or `GMAIL_APP_PASSWORD` not set, prints OTP to terminal:
```
============================================================
 [OTP SERVICE] Verification Code for user@example.com: 48321
 (Set GMAIL_USER and GMAIL_APP_PASSWORD in .env to deliver via email)
============================================================
```

---

## 16. Error Handling Patterns

| Situation | HTTP Status | Detail Message |
|---|---|---|
| JWT invalid/expired | 401 | "Could not validate credentials" |
| Account not verified | 403 | "Account not verified. Please verify your OTP first." |
| Non-admin access | 403 | "Forbidden: Administrative access required." |
| Resource not found | 404 | "[Resource] not found" |
| Business logic violation | 400 | Descriptive error (e.g. "Only DRAFT content can be edited") |
| Daily limit reached | 429 | "Daily post generation limit reached (4 max per day)" |
| AI generation failure | 500 | "AI Generation failed: {detail}" |
| No API keys configured | 500 | "Neither GROQ_API_KEY nor GEMINI_API_KEY is configured" |

---

## 17. Rate Limiting

| Resource | Limit | Reset |
|---|---|---|
| AI Generations per brand | **4 per day** | Midnight (new calendar day) |
| Posts published per brand | **3 per day** | Midnight (new calendar day) |
| Trend refresh | **5-minute client-side cooldown** | Per session (localStorage) |
| Trend cache (server) | **4-hour TTL** | Per niche keyword |

Limits are enforced via `generations_today`/`last_generation_date` and `posts_today`/`last_post_date` columns on the `Brand` model. Admins can reset these via the Quota Manager.

---

## 18. Running the Backend

### Prerequisites
- Python 3.9+
- PostgreSQL running with a database created
- `.env` file configured

### Setup
```powershell
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

### API Documentation
Interactive Swagger UI available at: **`http://localhost:8000/docs`**  
ReDoc available at: **`http://localhost:8000/redoc`**

### Promote a User to ADMIN
```powershell
# Edit promote_user.py with target email, then run:
python promote_user.py
```

