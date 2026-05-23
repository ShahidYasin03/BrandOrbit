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

```mermaid
graph TD
    subgraph FE["React Frontend — localhost:5173"]
        UI["Vite · React 19 · Tailwind v4"]
    end

    subgraph BE["FastAPI Backend — localhost:8000"]
        AUTH["Auth Module\nauth.py\nJWT · bcrypt · OTP"]
        BRAND["Brand & Content\nController\nmain.py"]
        ADMIN["Admin Panel\nADMIN role only"]
        SCHED["APScheduler Daemon\nevery 30 seconds\npublish_scheduled_content()"]
    end

    subgraph EXT["External Services"]
        DB[("PostgreSQL DB\n5 Tables")]
        GROQ["Groq LLaMA-3.3-70B\n+ Gemini Flash Fallback"]
        TRENDS["Google Trends\npytrends — 4hr cache"]
        TWITTER["Twitter / X API v2\nOAuth 2.0 PKCE"]
    end

    UI -->|"REST / JSON + JWT Bearer"| AUTH
    UI -->|"REST / JSON + JWT Bearer"| BRAND
    UI -->|"REST / JSON + JWT Bearer"| ADMIN

    AUTH -->|"SELECT / INSERT users"| DB
    BRAND -->|"CRUD brands, content, plans"| DB
    ADMIN -->|"Platform-wide queries"| DB

    BRAND -->|"LLM prompt → 2-3 tweet drafts"| GROQ
    BRAND -->|"niche keywords"| TRENDS
    TRENDS -->|"rising queries"| GROQ

    SCHED -->|"poll due items"| DB
    SCHED -->|"POST /2/tweets"| TWITTER
    SCHED -->|"refresh token if expired"| TWITTER
    SCHED -->|"auto-generate if queue low"| GROQ
```

### 1.4 Data Flow — End-to-End Request Lifecycle

```mermaid
sequenceDiagram
    participant UI as React Frontend
    participant MW as CORS Middleware
    participant DEP as auth.get_verified_user
    participant EP as API Endpoint
    participant DB as PostgreSQL

    UI->>MW: HTTP Request + Authorization: Bearer token
    MW->>DEP: Forward validated request
    DEP->>DB: SELECT users WHERE email = token.sub
    DB-->>DEP: User row
    DEP->>EP: Inject verified user object
    EP->>DB: SQLAlchemy ORM query / mutation
    DB-->>EP: Result rows
    EP-->>UI: 200 OK JSON (Pydantic serialised)
```

---

## 2. Database Design

### 2.1 Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    users {
        int id PK
        varchar email UK
        varchar hashed_password
        enum role "ADMIN or EDITOR"
        boolean is_verified
    }

    brands {
        int id PK
        varchar name UK
        text description
        varchar niche
        text quirks
        text persona_guidelines
        varchar twitter_oauth2_access_token
        varchar twitter_oauth2_refresh_token
        datetime twitter_oauth2_token_expires_at
        varchar twitter_username
        varchar twitter_oauth_state
        varchar twitter_oauth_code_verifier
        varchar automation_mode
        int generations_today
        date last_generation_date
        int posts_today
        date last_post_date
        datetime created_at
        int owner_id FK
    }

    posting_plans {
        int id PK
        int brand_id FK
        json active_days
        json time_slots
        varchar volume
        boolean is_active
    }

    content_items {
        int id PK
        int brand_id FK
        text body
        enum status "DRAFT PENDING_APPROVAL APPROVED SCHEDULED PUBLISHED REJECTED"
        datetime scheduled_for
        varchar tweet_id
        datetime created_at
        int author_id FK
    }

    validation_rules {
        int id PK
        int brand_id FK
        varchar rule_type
        json parameters
    }

    users ||--o{ brands : "owns"
    users ||--o{ content_items : "authors"
    brands ||--o| posting_plans : "has"
    brands ||--o{ content_items : "contains"
    brands ||--o{ validation_rules : "enforces"
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

```mermaid
stateDiagram-v2
    [*] --> DRAFT : AI Generate or Manual Create
    DRAFT --> PENDING_APPROVAL : submit()
    DRAFT --> APPROVED : approve() direct
    DRAFT --> DRAFT : remove_queue() reverts
    PENDING_APPROVAL --> APPROVED : approve()
    PENDING_APPROVAL --> REJECTED : reject()
    APPROVED --> SCHEDULED : smart_schedule() or approve_and_queue()
    SCHEDULED --> PUBLISHED : APScheduler fires
    SCHEDULED --> PUBLISHED : publish() instant
    SCHEDULED --> DRAFT : remove_queue()
    PUBLISHED --> [*]
    REJECTED --> [*]
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

```mermaid
flowchart LR
    PUBLIC(["🌐 Public Guest"])
    EDITOR(["👤 Editor User"])
    ADMIN(["👑 Admin User"])
    DAEMON(["⚙️ APScheduler Daemon"])

    subgraph AUTH["Authentication"]
        UC1["Register Account"]
        UC2["Log In"]
        UC3["Verify OTP"]
        UC4["Resend OTP"]
    end

    subgraph BRAND_MGT["Brand Management"]
        UC5["Create / Edit / Delete Brand"]
        UC6["Configure AI Persona & Guidelines"]
        UC7["Connect X Account via OAuth PKCE"]
        UC8["Set Automation Mode"]
        UC9["Disconnect X Account"]
    end

    subgraph CONTENT["Content Lifecycle"]
        UC10["Fetch Niche Trends"]
        UC11["Generate AI Content"]
        UC12["Edit / Delete Draft"]
        UC13["Submit for Approval"]
        UC14["Approve / Reject Content"]
        UC15["Smart-Schedule Content"]
        UC16["Remove from Queue"]
        UC17["Configure Posting Plan"]
    end

    subgraph ADMIN_PANEL["Admin Panel"]
        UC18["View Platform Stats"]
        UC19["List All Users"]
        UC20["Change User Role"]
        UC21["Delete User"]
        UC22["Override Brand Quotas"]
    end

    subgraph DAEMON_JOBS["Background Automation"]
        UC23["Auto-Publish Scheduled Posts"]
        UC24["Auto-Refresh OAuth Tokens"]
        UC25["Auto-Replenish Content Queue"]
    end

    PUBLIC --> AUTH
    EDITOR --> AUTH
    EDITOR --> BRAND_MGT
    EDITOR --> CONTENT
    ADMIN --> AUTH
    ADMIN --> BRAND_MGT
    ADMIN --> CONTENT
    ADMIN --> ADMIN_PANEL
    DAEMON --> DAEMON_JOBS
```

---

### 3.2 Sequence Diagrams

#### 3.2.1 User Registration & OTP Verification

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as FastAPI Backend
    participant DB as PostgreSQL

    User->>FE: Fill registration form
    FE->>BE: POST /api/auth/register
    BE->>DB: INSERT INTO users (email, hashed_password)
    DB-->>BE: New user row
    BE->>BE: Generate 5-digit OTP
    BE->>BE: Store OTP in _otp_store dict
    Note over BE: OTP printed to server terminal
    BE-->>FE: 201 User JSON (is_verified=false)
    FE-->>User: Redirect to OTP verification screen

    User->>FE: Enter OTP code
    FE->>BE: POST /api/auth/verify-otp
    BE->>BE: Lookup email in _otp_store
    alt OTP matches
        BE->>DB: UPDATE users SET is_verified=TRUE
        BE-->>FE: 200 {status: success}
        FE-->>User: Redirect to Login
    else OTP wrong or not found
        BE-->>FE: 400 Invalid verification code
    end
```

#### 3.2.2 Login & JWT Issuance

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as FastAPI Backend
    participant DB as PostgreSQL

    User->>FE: Submit email + password
    FE->>BE: POST /api/auth/login (form-urlencoded)
    BE->>DB: SELECT * FROM users WHERE email = ?
    DB-->>BE: User row
    alt Password valid
        BE->>BE: bcrypt.verify(password, hashed_password)
        BE->>BE: Sign JWT HS256 — expires in 7 days
        BE-->>FE: 200 {access_token, token_type: bearer}
        FE->>FE: Store token in memory
    else Invalid credentials
        BE-->>FE: 400 Incorrect email or password
    end
```

#### 3.2.3 Twitter/X OAuth 2.0 PKCE Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as FastAPI Backend
    participant DB as PostgreSQL
    participant TW as Twitter/X API

    User->>FE: Click "Connect X Account"
    FE->>BE: GET /api/auth/twitter/login?brand_id=N
    BE->>BE: Generate PKCE verifier + S256 challenge
    BE->>BE: Generate CSRF state nonce
    BE->>DB: UPDATE brands SET oauth_state, code_verifier
    BE-->>FE: {auth_url}
    FE-->>User: Redirect browser to Twitter/X

    User->>TW: Authorise BrandOrbit app
    TW-->>BE: Redirect to /api/auth/twitter/callback?code=X&state=Y

    BE->>DB: SELECT brand WHERE twitter_oauth_state = Y
    BE->>TW: POST /2/oauth2/token (code + code_verifier)
    TW-->>BE: {access_token, refresh_token, expires_in}
    BE->>TW: GET /2/users/me
    TW-->>BE: {data: {username: "XHandle"}}
    BE->>DB: UPDATE brands SET tokens, username, clear PKCE fields
    BE-->>User: Redirect to /brands?oauth=success&username=XHandle
```

#### 3.2.4 AI Content Generation

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as FastAPI Backend
    participant DB as PostgreSQL
    participant GROQ as Groq LLaMA
    participant GEM as Gemini Flash

    User->>FE: Click Generate with trend selected
    FE->>BE: POST /api/brands/{id}/generate {trend: "..."}
    BE->>DB: Verify brand ownership + load brand
    BE->>BE: Check niche is set
    BE->>BE: Check generations_today < 4
    BE->>BE: Build LLM prompt with niche, quirks, guidelines, trend

    BE->>GROQ: chat.completions.create(prompt)
    alt Groq succeeds
        GROQ-->>BE: 2-3 posts separated by "|||"
    else Groq fails
        BE->>GEM: generate_content(prompt)
        GEM-->>BE: 2-3 posts separated by "|||"
    end

    BE->>DB: INSERT content_items (status=DRAFT)
    BE->>DB: UPDATE brands SET generations_today += 1
    BE->>BE: maintain_auto_queue()
    BE-->>FE: 201 Array of ContentItem objects
    FE-->>User: Show new drafts in Draft Board
```

#### 3.2.5 Token Auto-Refresh During Publishing

```mermaid
sequenceDiagram
    participant SCH as APScheduler
    participant BE as get_valid_twitter_token
    participant DB as PostgreSQL
    participant TW as Twitter/X API

    SCH->>BE: item.scheduled_for <= now() — call get_valid_twitter_token()
    BE->>BE: Check expires_at minus 5 minutes

    alt Token is fresh
        BE-->>SCH: Return valid access_token
    else Token expired or expiring soon
        BE->>TW: POST /2/oauth2/token grant_type=refresh_token
        TW-->>BE: {new_access_token, refresh_token, expires_in}
        BE->>DB: UPDATE brands SET new tokens + expires_at
        BE-->>SCH: Return new access_token
    end

    SCH->>TW: POST /2/tweets {text: item.body}
    TW-->>SCH: 201 {data: {id: tweet_id}}
    SCH->>DB: UPDATE content_items SET status=PUBLISHED, tweet_id=...
    SCH->>DB: UPDATE brands SET posts_today += 1
    SCH->>SCH: maintain_auto_queue()
```

---

### 3.3 Activity Diagrams

#### 3.3.1 APScheduler Auto-Pilot Daemon (Every 30 Seconds)

```mermaid
flowchart TD
    A(["APScheduler fires every 30s"]) --> B["Query SCHEDULED items\nWHERE scheduled_for <= now()"]
    B --> C{"Items due?"}
    C -->|No| Z(["Return — wait for next interval"])
    C -->|Yes| D["For each due item"]
    D --> E{"Brand exists?"}
    E -->|No| D
    E -->|Yes| F{"PostingPlan\nis_active?"}
    F -->|Inactive| D
    F -->|Active| G{"New day?"}
    G -->|Yes| H["Reset posts_today = 0"]
    G -->|No| I{"posts_today >= 3?"}
    H --> I
    I -->|Yes — daily limit hit| D
    I -->|No| J["get_valid_twitter_token()\nauto-refresh if expired"]
    J --> K{"OAuth token\navailable?"}
    K -->|Yes| L["POST /2/tweets\nTwitter API v2"]
    K -->|No| M["Mock publish\nfor UI testing"]
    L --> N{"Twitter\nreturns 201?"}
    N -->|Yes| O["tweet_id stored"]
    N -->|No| P["tweet_id = failed:status_code"]
    O --> Q["status = PUBLISHED\nposts_today += 1\nmaintain_auto_queue()"]
    M --> Q
    P --> D
    Q --> D
```

#### 3.3.2 `maintain_auto_queue()` — Auto-Pilot Queue Replenishment

```mermaid
flowchart TD
    A(["maintain_auto_queue called"]) --> B{"automation_mode\n= auto?"}
    B -->|No| Z(["Return — nothing to do"])
    B -->|Yes| C["Count SCHEDULED items\nneeded = 3 - queued_count"]
    C --> D{"needed <= 0?"}
    D -->|Yes — queue is full| Z
    D -->|No| E["Fetch up to 'needed' oldest\nDRAFT or PENDING_APPROVAL items"]
    E --> F{"len drafts < needed?"}
    F -->|Yes — not enough drafts| G["_trigger_ai_generation()\nLLM generates new drafts"]
    F -->|No| H
    G --> H["Combine existing + new drafts"]
    H --> I["Set each draft → SCHEDULED\nscheduled_for = now + 365d placeholder"]
    I --> J["recalculate_queue()\nAssigns real calendar slots"]
    J --> Z
```

#### 3.3.3 `recalculate_queue()` — Calendar Slot Assignment

```mermaid
flowchart TD
    A(["recalculate_queue called"]) --> B["Load PostingPlan\nLoad all SCHEDULED + APPROVED items"]
    B --> C{"No plan OR\nno active_days OR\nno time_slots?"}
    C -->|Yes — no valid schedule| D["Revert all items to APPROVED\nSet scheduled_for = NULL"]
    D --> E(["COMMIT and return"])
    C -->|No — plan exists| F{"No items\nto schedule?"}
    F -->|Yes| E
    F -->|No| G["Build slot list starting from now()\nWalk days forward chronologically"]
    G --> H["For each day: if weekday in active_days\nFor each time_slot: if slot > now() → add"]
    H --> I{"len slots >= len items?"}
    I -->|No — keep walking| H
    I -->|Yes| J["Assign slots[i] to items[i]\nSet status = SCHEDULED"]
    J --> E
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
