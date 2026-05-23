# Monkey patch urllib3 Retry class to fix pytrends incompatibility with newer urllib3 versions
try:
    import urllib3.util.retry
    original_init = urllib3.util.retry.Retry.__init__
    def patched_init(self, *args, **kwargs):
        if 'method_whitelist' in kwargs:
            kwargs['allowed_methods'] = kwargs.pop('method_whitelist')
        original_init(self, *args, **kwargs)
    urllib3.util.retry.Retry.__init__ = patched_init
    print("[Patches] Successfully monkey-patched urllib3 Retry for pytrends compatibility.")
except Exception as patch_err:
    print(f"[Patches] Failed to patch urllib3 Retry: {patch_err}")

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import os
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

from fastapi.security import OAuth2PasswordRequestForm
import auth


# We will import these inside the functions or conditionally if there are installation delays,
# but since they are being installed, we can safely import them globally once installed.
from groq import Groq
from pytrends.request import TrendReq
import tweepy
import time
import google.generativeai as genai

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# --- Trend cache: avoids hammering Google on every page load ---
# Structure: { niche_key: { 'topics': [...], 'expires_at': timestamp } }
_trend_cache: dict = {}

# --- OTP store for local development/testing ---
# Structure: { email: otp_code_string }
_otp_store: dict = {}

import models
import schemas
from database import engine, get_db, SessionLocal
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

models.Base.metadata.create_all(bind=engine)

def generate_pkce():
    import secrets
    import hashlib
    import base64
    verifier = secrets.token_urlsafe(64)[:128]
    sha256_hash = hashlib.sha256(verifier.encode('utf-8')).digest()
    challenge = base64.urlsafe_b64encode(sha256_hash).decode('utf-8').replace('=', '')
    return verifier, challenge

def get_valid_twitter_token(db_brand: models.Brand, db: Session) -> Optional[str]:
    if not db_brand.twitter_oauth2_access_token or not db_brand.twitter_oauth2_refresh_token:
        return None

    now = datetime.utcnow()
    is_expired = False
    if db_brand.twitter_oauth2_token_expires_at:
        is_expired = db_brand.twitter_oauth2_token_expires_at - timedelta(minutes=5) <= now
    else:
        is_expired = True

    if is_expired:
        print(f"[OAuth 2.0] Token for brand {db_brand.id} is expired or expiring soon. Refreshing...")
        client_id = os.getenv("TWITTER_CLIENT_ID")
        client_secret = os.getenv("TWITTER_CLIENT_SECRET")
        if not client_id or not client_secret:
            print("[OAuth 2.0] TWITTER_CLIENT_ID or TWITTER_CLIENT_SECRET not set in environment.")
            return None

        import requests
        import base64
        token_url = "https://api.twitter.com/2/oauth2/token"
        auth_str = f"{client_id}:{client_secret}"
        b64_auth = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        
        headers = {
            "Authorization": f"Basic {b64_auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": db_brand.twitter_oauth2_refresh_token,
            "client_id": client_id
        }

        try:
            response = requests.post(token_url, headers=headers, data=data)
            if response.status_code == 200:
                tokens = response.json()
                db_brand.twitter_oauth2_access_token = tokens["access_token"]
                if "refresh_token" in tokens:
                    db_brand.twitter_oauth2_refresh_token = tokens["refresh_token"]
                
                expires_in = tokens.get("expires_in", 7200)
                db_brand.twitter_oauth2_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                db.commit()
                db.refresh(db_brand)
                print(f"[OAuth 2.0] Token successfully refreshed for brand {db_brand.id}.")
            else:
                print(f"[OAuth 2.0] Failed to refresh token: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"[OAuth 2.0] Exception during token refresh: {e}")
            return None

    return db_brand.twitter_oauth2_access_token

from typing import Optional

app = FastAPI(title="AI-Driven Multi-Brand Content Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Scheduler ---
def publish_scheduled_content():
    db = SessionLocal()
    try:
        now = datetime.now()
        scheduled_items = db.query(models.ContentItem).filter(
            models.ContentItem.status == models.StatusEnum.SCHEDULED,
            models.ContentItem.scheduled_for <= now
        ).all()

        if not scheduled_items:
            return

        print(f"[Scheduler] Found {len(scheduled_items)} item(s) due at {now}")

        for item in scheduled_items:
            db_brand = db.query(models.Brand).filter(models.Brand.id == item.brand_id).first()
            if not db_brand:
                print(f"[Scheduler] Brand not found for item {item.id}, skipping.")
                continue

            # Check if brand's posting plan is configured and active
            db_plan = db.query(models.PostingPlan).filter(models.PostingPlan.brand_id == db_brand.id).first()
            if db_plan and not db_plan.is_active:
                print(f"[Scheduler] Posting schedule plan for brand '{db_brand.name}' is PAUSED/INACTIVE. Skipping item {item.id}.")
                continue

            # Use Python date object (required by SQLAlchemy Date column)
            today = now.date()

            if db_brand.last_post_date != today:
                print(f"[Scheduler] New day for brand {db_brand.id}. Resetting posts_today (was {db_brand.posts_today}).")
                db_brand.posts_today = 0
                db_brand.last_post_date = today
                db.commit()
                db.refresh(db_brand)

            if db_brand.posts_today >= 3:
                print(f"[Scheduler] Brand {db_brand.id} hit daily limit (3). Skipping item {item.id}.")
                continue

            oauth_token = get_valid_twitter_token(db_brand, db)

            print(f"[Scheduler] Processing item {item.id} for brand '{db_brand.name}'. OAuth2 active: {oauth_token is not None}")

            success = False
            if oauth_token:
                try:
                    import requests
                    headers = {
                        "Authorization": f"Bearer {oauth_token}",
                        "Content-Type": "application/json"
                    }
                    resp = requests.post("https://api.twitter.com/2/tweets", json={"text": item.body}, headers=headers)
                    if resp.status_code == 201:
                        data = resp.json()
                        item.tweet_id = str(data["data"]["id"])
                        success = True
                        print(f"[Scheduler] Published item {item.id} via OAuth 2.0 -> tweet_id={item.tweet_id}")
                    else:
                        print(f"[Scheduler] Failed to publish via OAuth 2.0: {resp.status_code} - {resp.text}")
                        item.tweet_id = f"failed:{resp.status_code}"
                        db.commit()
                except Exception as e:
                    print(f"[Scheduler] Exception publishing item {item.id} via OAuth 2.0: {e}")
                    item.tweet_id = f"failed:{str(e)[:80]}"
                    db.commit()
            else:
                # No keys/OAuth — mock publish so queue still clears during testing
                item.tweet_id = "mock_tweet_id_no_keys"
                success = True
                print(f"[Scheduler] Mock published item {item.id} (no X credentials configured).")

            if success:
                item.status = models.StatusEnum.PUBLISHED
                db_brand.posts_today += 1
                db_brand.last_post_date = today
                db.commit()
                print(f"[Scheduler] Brand {db_brand.id} posts_today = {db_brand.posts_today}")
                
                # Top up queue if auto-pilot
                maintain_auto_queue(db_brand.id, db)

    except Exception as e:
        print(f"[Scheduler] Unexpected error: {e}")
    finally:
        db.close()


scheduler = BackgroundScheduler()
scheduler.add_job(
    publish_scheduled_content,
    trigger=IntervalTrigger(seconds=30),  # Check every 30s for faster testing
    id='publish_job',
    name='Publish Scheduled Content',
    replace_existing=True
)

@app.on_event("startup")
def startup_event():
    scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

@app.get("/")
def read_root():
    return {"message": "AI-Driven CMS API is running. Go to /docs for interactive documentation."}

@app.post("/api/debug/trigger-scheduler")
def trigger_scheduler_now():
    """Debug endpoint: manually triggers the publish scheduler immediately."""
    publish_scheduled_content()
    return {"message": "Scheduler triggered manually. Check backend logs for results."}

# --- Email helper (Gmail SMTP) ---

def send_otp_email(to_email: str, otp_code: str, is_resend: bool = False) -> None:
    """
    Sends an OTP verification email via Gmail SMTP using an App Password.
    Falls back to printing the code to the terminal if credentials are not configured.
    """
    gmail_user = os.getenv("GMAIL_USER")
    gmail_app_password = os.getenv("GMAIL_APP_PASSWORD")

    subject = "Your BrandOrbit Verification Code" if not is_resend else "Your New BrandOrbit Verification Code"
    heading = "Your new verification code" if is_resend else "Verify your account"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 40px;">
        <h1 style="color: #2dd4bf; font-size: 24px; margin-bottom: 8px;">&#127757; BrandOrbit</h1>
        <p style="color: #94a3b8; margin-bottom: 32px;">AI-Driven Multi-Brand Content Platform</p>
        <h2 style="font-size: 18px; margin-bottom: 16px;">{heading}</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">Use the code below to verify your email address. It expires once used.</p>
        <div style="background: #1e293b; border: 1px solid #2dd4bf; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #2dd4bf;">{otp_code}</span>
        </div>
        <p style="color: #475569; font-size: 13px;">If you didn't create a BrandOrbit account, you can safely ignore this email.</p>
    </div>
    """

    if gmail_user and gmail_app_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"BrandOrbit <{gmail_user}>"
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))

            context = ssl.create_default_context()
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.ehlo()
                server.starttls(context=context)
                server.login(gmail_user, gmail_app_password)
                server.sendmail(gmail_user, to_email, msg.as_string())

            print(f"[Gmail SMTP] OTP email sent to {to_email}")
        except Exception as e:
            print(f"[Gmail SMTP] Failed to send email to {to_email}: {e}")
            print(f"[OTP FALLBACK] Code for {to_email}: {otp_code}")
    else:
        # No credentials configured — print to terminal as fallback
        print("\n" + "="*60)
        print(f" [OTP SERVICE] Verification Code for {to_email}: {otp_code}")
        print(" (Set GMAIL_USER and GMAIL_APP_PASSWORD in .env to deliver via email)")
        print("="*60 + "\n")


# --- Auth ---

@app.post("/api/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Generate 5-digit OTP and deliver via Gmail SMTP (terminal fallback if not configured)
    import random
    otp_code = str(random.randint(10000, 99999))
    _otp_store[user.email] = otp_code
    send_otp_email(user.email, otp_code, is_resend=False)

    return db_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResendOTPRequest(BaseModel):
    email: str

@app.post("/api/auth/verify-otp")
def verify_otp(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    email = payload.email
    otp = payload.otp
    
    if email not in _otp_store:
        raise HTTPException(status_code=400, detail="No active verification code found for this email.")
        
    if _otp_store[email] != otp:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check your email inbox.")
        
    # Successful verification! We clean up the OTP
    del _otp_store[email]
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        user.is_verified = True
        db.commit()
        
    return {"status": "success", "message": "OTP verified successfully!"}

@app.post("/api/auth/resend-otp")
def resend_otp(payload: ResendOTPRequest):
    email = payload.email
    
    import random
    otp_code = str(random.randint(10000, 99999))
    _otp_store[email] = otp_code
    send_otp_email(email, otp_code, is_resend=True)
    
    return {"status": "success", "message": "A new verification code has been sent to your email."}

@app.get("/api/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# --- Brands ---

@app.post("/api/brands/", response_model=schemas.Brand)
def create_brand(brand: schemas.BrandCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = models.Brand(**brand.model_dump(), owner_id=current_user.id)
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)
    return db_brand

@app.get("/api/brands/", response_model=List[schemas.Brand])
def read_brands(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    brands = db.query(models.Brand).filter(models.Brand.owner_id == current_user.id).offset(skip).limit(limit).all()
    return brands

# --- Posting Plan Endpoints ---
@app.get("/api/brands/{brand_id}/plan", response_model=schemas.PostingPlan)
def get_posting_plan(brand_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    db_plan = db.query(models.PostingPlan).filter(models.PostingPlan.brand_id == brand_id).first()
    if db_plan is None:
        raise HTTPException(status_code=404, detail="Posting plan not found")
    return db_plan

@app.post("/api/brands/{brand_id}/plan", response_model=schemas.PostingPlan)
def update_posting_plan(brand_id: int, plan: schemas.PostingPlanCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    db_plan = db.query(models.PostingPlan).filter(models.PostingPlan.brand_id == brand_id).first()
    if db_plan:
        db_plan.active_days = plan.active_days
        db_plan.time_slots = plan.time_slots
        db_plan.volume = plan.volume
        db_plan.is_active = plan.is_active
    else:
        db_plan = models.PostingPlan(
            brand_id=brand_id,
            active_days=plan.active_days,
            time_slots=plan.time_slots,
            volume=plan.volume,
            is_active=plan.is_active
        )
        db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    recalculate_queue(brand_id, db)
    return db_plan

@app.get("/api/brands/{brand_id}", response_model=schemas.Brand)
def read_brand(brand_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if brand is None:
        raise HTTPException(status_code=404, detail="Brand not found")
    return brand

@app.put("/api/brands/{brand_id}", response_model=schemas.Brand)
def update_brand(brand_id: int, brand_update: schemas.BrandCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    update_data = brand_update.model_dump(exclude_unset=True)
    
    # Prevent frontend from wiping OAuth tokens
    protected_fields = [
        'twitter_oauth2_access_token', 
        'twitter_oauth2_refresh_token', 
        'twitter_oauth2_token_expires_at', 
        'twitter_username', 
        'twitter_oauth_state', 
        'twitter_oauth_code_verifier'
    ]
    for field in protected_fields:
        update_data.pop(field, None)
        
    for field, value in update_data.items():
        setattr(db_brand, field, value)
        
    db.commit()
    db.refresh(db_brand)
    return db_brand

class ModeUpdate(BaseModel):
    automation_mode: str

@app.put("/api/brands/{brand_id}/mode", response_model=schemas.Brand)
def update_brand_mode(brand_id: int, mode_update: ModeUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    db_brand.automation_mode = mode_update.automation_mode
    db.commit()
    db.refresh(db_brand)
    
    if db_brand.automation_mode == "auto":
        maintain_auto_queue(brand_id, db)
        
    return db_brand

# --- Content Lifecycle ---

def _trigger_ai_generation(brand_id: int, db: Session, trend_context: str = "General industry topics") -> List[models.ContentItem]:
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand or not db_brand.niche:
        return []
        
    today = datetime.now().date()
    if db_brand.last_generation_date != today:
        db_brand.generations_today = 0
        db_brand.last_generation_date = today
        db.commit()
        db.refresh(db_brand)
        
    if db_brand.generations_today >= 4:
        return []
        
    groq_key = os.getenv("GROQ_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not groq_key and not gemini_key:
        print("[_trigger_ai_generation] No API keys configured in environment.")
        return []
        
    try:
        response_text = ""
        prompt = f"""
        You are an expert social media manager and copywriter for the brand '{db_brand.name}'.
        Niche: {db_brand.niche}
        Brand Quirks: {db_brand.quirks or 'None'}
        Persona Guidelines: {db_brand.persona_guidelines or 'Professional and engaging'}
        
        Focus Topic / Trend: {trend_context}
        
        Task: Write 2 to 3 highly engaging posts for this brand that leverage the focus topic / trend.
        STRICT RULE: Each post MUST be under 280 characters to fit on Twitter/X.
        Use engaging hooks and strategic emojis to make the posts sound interesting and human, but keep them concise.
        Separate each distinct post with '|||'. Do not include extra conversational text.
        """

        if groq_key:
            try:
                print(f"[_trigger_ai_generation] Using Groq LLaMA-3.3 for brand {db_brand.name}...")
                client = Groq(api_key=groq_key)
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.3-70b-versatile",
                )
                response_text = chat_completion.choices[0].message.content
            except Exception as groq_err:
                print(f"[_trigger_ai_generation] Groq generation failed: {groq_err}")
                if gemini_key:
                    print(f"[_trigger_ai_generation] Falling back to Google Gemini...")
                    genai.configure(api_key=gemini_key)
                    model = genai.GenerativeModel("gemini-flash-latest")
                    response = model.generate_content(prompt)
                    response_text = response.text
                else:
                    raise groq_err
        else:
            print(f"[_trigger_ai_generation] Groq key absent. Falling back to Google Gemini for brand {db_brand.name}...")
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-flash-latest")
            response = model.generate_content(prompt)
            response_text = response.text
        
        posts = [t.strip() for t in response_text.split('|||') if t.strip()]
        
        created_items = []
        for post in posts:
            db_content = models.ContentItem(
                brand_id=brand_id,
                body=post,
                status=models.StatusEnum.DRAFT
            )
            db.add(db_content)
            created_items.append(db_content)
            
        db_brand.generations_today += 1
        db_brand.last_generation_date = today
        db.commit()
        
        for item in created_items:
            db.refresh(item)
            
        return created_items
    except Exception as e:
        print(f"[_trigger_ai_generation] Error: {e}")
        return []

def maintain_auto_queue(brand_id: int, db: Session):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand or db_brand.automation_mode != "auto":
        return

    # Check how many items are currently in queue (SCHEDULED)
    queued_count = db.query(models.ContentItem).filter(
        models.ContentItem.brand_id == brand_id,
        models.ContentItem.status == models.StatusEnum.SCHEDULED
    ).count()

    needed = 3 - queued_count

    if needed > 0:
        # Get up to 'needed' DRAFTs (oldest first)
        drafts = db.query(models.ContentItem).filter(
            models.ContentItem.brand_id == brand_id,
            models.ContentItem.status.in_([models.StatusEnum.DRAFT, models.StatusEnum.PENDING_APPROVAL])
        ).order_by(models.ContentItem.created_at).limit(needed).all()
        
        if len(drafts) < needed:
            # Not enough drafts. Let's auto-generate to replenish!
            new_drafts = _trigger_ai_generation(brand_id, db)
            drafts.extend(new_drafts)

        for draft in drafts[:needed]:
            draft.status = models.StatusEnum.SCHEDULED
            draft.scheduled_for = datetime.now() + timedelta(days=365)  # placeholder

        if drafts:
            db.commit()
            recalculate_queue(brand_id, db)

def recalculate_queue(brand_id: int, db: Session):
    db_plan = db.query(models.PostingPlan).filter(models.PostingPlan.brand_id == brand_id).first()
    
    # Query both SCHEDULED and APPROVED items so that approved items get scheduled once a plan is saved
    scheduled_items = db.query(models.ContentItem).filter(
        models.ContentItem.brand_id == brand_id,
        models.ContentItem.status.in_([models.StatusEnum.SCHEDULED, models.StatusEnum.APPROVED])
    ).order_by(models.ContentItem.created_at).all()

    if not db_plan or not db_plan.active_days or not db_plan.time_slots:
        # If no plan exists, we cannot schedule. Revert items to APPROVED to avoid getting stuck with placeholder dates.
        for item in scheduled_items:
            item.status = models.StatusEnum.APPROVED
            item.scheduled_for = None
        db.commit()
        return
        
    if not scheduled_items:
        return
        
    days_map = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
    target_days = [days_map[d] for d in db_plan.active_days if d in days_map]
    if not target_days:
        for item in scheduled_items:
            item.status = models.StatusEnum.APPROVED
            item.scheduled_for = None
        db.commit()
        return
        
    start_time = datetime.now()
    slots = []
    current_date = start_time.replace(minute=0, second=0, microsecond=0)
    
    while len(slots) < len(scheduled_items):
        if current_date.weekday() in target_days:
            for ts in sorted(db_plan.time_slots):
                hour, minute = map(int, ts.split(':'))
                slot_time = current_date.replace(hour=hour, minute=minute)
                if slot_time > start_time:
                    slots.append(slot_time)
                    if len(slots) >= len(scheduled_items):
                        break
        current_date += timedelta(days=1)
        
    for i, item in enumerate(scheduled_items):
        item.status = models.StatusEnum.SCHEDULED
        item.scheduled_for = slots[i]
        
    db.commit()

@app.post("/api/brands/{brand_id}/content", response_model=schemas.ContentItem)
def create_content_for_brand(brand_id: int, content: schemas.ContentItemCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    db_content = models.ContentItem(**content.model_dump(), brand_id=brand_id, author_id=current_user.id)
    db.add(db_content)
    db.commit()
    db.refresh(db_content)
    return db_content

@app.get("/api/brands/{brand_id}/content", response_model=List[schemas.ContentItem])
def read_content_for_brand(brand_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return db.query(models.ContentItem).filter(models.ContentItem.brand_id == brand_id).order_by(models.ContentItem.created_at.desc()).all()

@app.put("/api/content/{content_id}", response_model=schemas.ContentItem)
def update_content(content_id: int, content_update: schemas.ContentItemUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Ownership check
    if db_content.brand.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this content")

    if db_content.status not in [models.StatusEnum.DRAFT]:
        raise HTTPException(status_code=400, detail="Only DRAFT content can be edited")
        
    db_content.body = content_update.body
    db.commit()
    db.refresh(db_content)
    return db_content

@app.delete("/api/content/{content_id}")
def delete_content(content_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if db_content.brand.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this content")

    brand_id = db_content.brand_id
    status = db_content.status
    db.delete(db_content)
    db.commit()
    
    if status == models.StatusEnum.SCHEDULED:
        recalculate_queue(brand_id, db)
        maintain_auto_queue(brand_id, db)
        
    return {"ok": True}

@app.post("/api/content/{content_id}/submit", response_model=schemas.ContentItem)
def submit_content(content_id: int, db: Session = Depends(get_db)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    if db_content.status != models.StatusEnum.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT content can be submitted")
    
    db_content.status = models.StatusEnum.PENDING_APPROVAL
    db.commit()
    db.refresh(db_content)
    return db_content

@app.post("/api/content/{content_id}/approve", response_model=schemas.ContentItem)
def approve_content(content_id: int, db: Session = Depends(get_db)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    # Accept DRAFT or PENDING_APPROVAL — the new flow goes directly from DRAFT → APPROVED
    if db_content.status not in [models.StatusEnum.DRAFT, models.StatusEnum.PENDING_APPROVAL]:
        raise HTTPException(status_code=400, detail="Content must be DRAFT or PENDING_APPROVAL to approve")
    
    db_content.status = models.StatusEnum.APPROVED
    db.commit()
    db.refresh(db_content)
    return db_content

@app.post("/api/content/{content_id}/reject", response_model=schemas.ContentItem)
def reject_content(content_id: int, db: Session = Depends(get_db)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    if db_content.status != models.StatusEnum.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Content must be PENDING_APPROVAL to reject")
    
    db_content.status = models.StatusEnum.REJECTED
    db.commit()
    db.refresh(db_content)
    return db_content

@app.post("/api/content/{content_id}/schedule", response_model=schemas.ContentItem)
def schedule_content(content_id: int, scheduled_for: datetime, db: Session = Depends(get_db)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    if db_content.status != models.StatusEnum.APPROVED:
        raise HTTPException(status_code=400, detail="Content must be APPROVED to schedule")
    
    db_content.status = models.StatusEnum.SCHEDULED
    db_content.scheduled_for = scheduled_for
    db.commit()
    db.refresh(db_content)
    return db_content

@app.post("/api/content/{content_id}/smart_schedule", response_model=schemas.ContentItem)
def smart_schedule_content(content_id: int, db: Session = Depends(get_db)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    if db_content.status != models.StatusEnum.APPROVED:
        raise HTTPException(status_code=400, detail="Content must be APPROVED to queue")

    # Enforce active posting plan exist check
    db_plan = db.query(models.PostingPlan).filter(models.PostingPlan.brand_id == db_content.brand_id).first()
    if not db_plan or not db_plan.active_days or not db_plan.time_slots:
        raise HTTPException(status_code=400, detail="Please configure a posting schedule in the Schedule Engine first.")

    # Set to far future BEFORE committing — prevents the background scheduler
    # from snatching it up in the window before recalculate_queue runs.
    db_content.status = models.StatusEnum.SCHEDULED
    db_content.scheduled_for = datetime.now() + timedelta(days=365)
    db.commit()

    # Now recalculate assigns the real slot, overwriting the placeholder.
    recalculate_queue(db_content.brand_id, db)

    db.refresh(db_content)
    return db_content

@app.post("/api/content/{content_id}/approve_and_queue", response_model=schemas.ContentItem)
def approve_and_queue(content_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    """Atomically approve a DRAFT and immediately smart-schedule it. Avoids the
    two-request race window that existed with separate approve + smart_schedule calls."""
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if db_content.brand.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to approve this content")

    if db_content.status not in [models.StatusEnum.DRAFT, models.StatusEnum.PENDING_APPROVAL]:
        raise HTTPException(status_code=400, detail="Content must be DRAFT or PENDING_APPROVAL")

    # Enforce active posting plan exist check
    db_plan = db.query(models.PostingPlan).filter(models.PostingPlan.brand_id == db_content.brand_id).first()
    if not db_plan or not db_plan.active_days or not db_plan.time_slots:
        raise HTTPException(status_code=400, detail="Please configure a posting schedule in the Schedule Engine first.")

    db_content.status = models.StatusEnum.SCHEDULED
    db_content.scheduled_for = datetime.now() + timedelta(days=365)  # safe placeholder
    db.commit()

    recalculate_queue(db_content.brand_id, db)

    db.refresh(db_content)
    return db_content

@app.post("/api/content/{content_id}/remove_queue", response_model=schemas.ContentItem)
def remove_from_queue(content_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if db_content.brand.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this queue")

    if db_content.status != models.StatusEnum.SCHEDULED:
        raise HTTPException(status_code=400, detail="Content must be SCHEDULED to remove")
    
    db_content.status = models.StatusEnum.DRAFT
    db_content.scheduled_for = None
    db.commit()
    
    recalculate_queue(db_content.brand_id, db)
    maintain_auto_queue(db_content.brand_id, db)
    
    db.refresh(db_content)
    return db_content

@app.get("/api/brands/{brand_id}/trends", response_model=List[str])
def get_trends_for_brand(brand_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand or not db_brand.niche:
        return []

    niche = db_brand.niche.strip()
    cache_key = niche.lower()

    # --- Check cache (4-hour TTL) ---
    cached = _trend_cache.get(cache_key)
    if cached and cached['expires_at'] > time.time():
        print(f"[Trends] Cache hit for '{niche}'")
        return cached['topics']

    # --- Step 1: Try pytrends for real Google search data ---
    pytrends_raw: list[str] = []
    try:
        print(f"[Trends] Fetching pytrends for '{niche}'...")
        pt = TrendReq(hl='en-US', tz=0, timeout=(10, 30), retries=2, backoff_factor=0.5)
        pt.build_payload([niche], timeframe='now 7-d', gprop='')
        related = pt.related_queries()

        # Prefer "rising" (breakout topics), fall back to "top"
        for key in ('rising', 'top'):
            df = related.get(niche, {}).get(key)
            if df is not None and not df.empty:
                pytrends_raw = df['query'].head(5).tolist()
                break

        print(f"[Trends] pytrends raw for '{niche}': {pytrends_raw}")
    except Exception as e:
        print(f"[Trends] pytrends failed for '{niche}': {e}")

    # --- Step 2: LLM refines pytrends data OR generates from scratch ---
    try:
        api_key = os.getenv("GROQ_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not api_key and not gemini_key:
            raise ValueError("Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in the environment.")

        if pytrends_raw:
            prompt = f"""
You are a social media content strategist specialising in the '{niche}' niche.
These are currently trending Google search queries related to this niche: {', '.join(pytrends_raw)}.

Task: Based on these real trending searches, create exactly 3 compelling content topic angles
that a brand in this niche could use for social media posts.
Each topic should be descriptive enough to understand the angle (10-15 words is ideal).
Do NOT just repeat the raw search query — reframe it as an interesting discussion point or content hook.
Format: A simple comma-separated list of exactly 3 items. No bullet points, numbering, or extra text.
Example: "Why fans are divided over the new VAR rule changes, How clubs are scouting talent in the digital age, The mental health conversation changing football culture"
"""
        else:
            prompt = f"""
You are an expert social media content strategist for the '{niche}' niche.
Task: Identify 3 current trending topics or discussions happening in this niche right now and frame each as a compelling content angle.
Each topic should be descriptive enough to understand the angle (10-15 words is ideal) — not just a label.
Format: A simple comma-separated list of exactly 3 items. No bullet points or numbering.
Example: "Why fans are divided over the new VAR rule changes, How clubs are scouting talent in the digital age, The mental health conversation changing football culture"
"""

        if api_key:
            try:
                client = Groq(api_key=api_key)
                completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.3-70b-versatile",
                )
                response_text = completion.choices[0].message.content.strip()
            except Exception as groq_err:
                print(f"[Trends] Groq refinement failed: {groq_err}")
                if gemini_key:
                    print(f"[Trends] Falling back to Google Gemini for trends...")
                    genai.configure(api_key=gemini_key)
                    model = genai.GenerativeModel("gemini-flash-latest")
                    response = model.generate_content(prompt)
                    response_text = response.text.strip()
                else:
                    raise groq_err
        else:
            print(f"[Trends] Groq key absent. Falling back to Google Gemini for trends...")
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-flash-latest")
            response = model.generate_content(prompt)
            response_text = response.text.strip()
        # Strip surrounding quotes if the model added them
        response_text = response_text.strip('"').strip("'")
        topics = [t.strip() for t in response_text.split(',') if t.strip()]
        if len(topics) < 3:
            topics.extend(["General Industry Trend"] * (3 - len(topics)))
        topics = topics[:3]

        # Cache the result for 4 hours
        _trend_cache[cache_key] = {'topics': topics, 'expires_at': time.time() + 4 * 3600}
        print(f"[Trends] Final topics for '{niche}': {topics}")
        return topics

    except Exception as e:
        print(f"[Trends] LLM fallback error for '{niche}': {e}")
        # Last resort: return raw pytrends queries or empty list
        if pytrends_raw:
            return pytrends_raw[:3]
        return []

@app.post("/api/brands/{brand_id}/generate", response_model=List[schemas.ContentItem])
def generate_content_for_brand(brand_id: int, request: schemas.TrendGenerateRequest = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_verified_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id, models.Brand.owner_id == current_user.id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
        
    if not db_brand.niche:
        raise HTTPException(status_code=400, detail="Brand must have a niche set for AI generation")
        
    # Check Daily Generation Rate Limit — use Python date object (required by SQLAlchemy Date column)
    today = datetime.now().date()
    if db_brand.last_generation_date != today:
        db_brand.generations_today = 0
        db_brand.last_generation_date = today
        db.commit()
        db.refresh(db_brand)
        
    if db_brand.generations_today >= 4:
        raise HTTPException(status_code=429, detail="Daily post generation limit reached (4 max per day)")
        
    try:
        groq_key = os.getenv("GROQ_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not groq_key and not gemini_key:
            raise HTTPException(status_code=500, detail="Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in the environment. Please update your backend .env file.")
            
        trend_context = request.trend if request and request.trend else "General industry topics"
        
        created_items = _trigger_ai_generation(brand_id, db, trend_context)
        if not created_items:
            raise HTTPException(status_code=500, detail="AI Generation failed or rate limit hit internally")
            
        maintain_auto_queue(brand_id, db)
            
        return created_items
        
    except Exception as e:
        print(f"Error generating AI content: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"AI Generation failed: {str(e)}")

@app.post("/api/content/{content_id}/publish", response_model=schemas.ContentItem)
def publish_content(content_id: int, db: Session = Depends(get_db)):
    db_content = db.query(models.ContentItem).filter(models.ContentItem.id == content_id).first()
    if not db_content:
        raise HTTPException(status_code=404, detail="Content not found")
        
    if db_content.status not in [models.StatusEnum.APPROVED, models.StatusEnum.SCHEDULED]:
        raise HTTPException(status_code=400, detail="Content must be APPROVED or SCHEDULED to publish")
        
    db_brand = db.query(models.Brand).filter(models.Brand.id == db_content.brand_id).first()
    
    oauth_token = get_valid_twitter_token(db_brand, db)
    
    if oauth_token:
        try:
            import requests
            headers = {
                "Authorization": f"Bearer {oauth_token}",
                "Content-Type": "application/json"
            }
            resp = requests.post("https://api.twitter.com/2/tweets", json={"text": db_content.body}, headers=headers)
            if resp.status_code == 201:
                data = resp.json()
                db_content.status = models.StatusEnum.PUBLISHED
                db_content.tweet_id = str(data["data"]["id"])
                db.commit()
                db.refresh(db_content)
                return db_content
            else:
                print(f"[Twitter OAuth 2.0] Failed to post: {resp.status_code} - {resp.text}")
                raise HTTPException(status_code=500, detail=f"Failed to post via OAuth 2.0: {resp.text}")
        except Exception as e:
            print(f"[Twitter OAuth 2.0] Exception posting: {e}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Failed to post: {str(e)}")
            
    else:
        # Return a mock success response if keys/tokens are not configured, so UI testing can proceed
        db_content.status = models.StatusEnum.PUBLISHED
        db_content.tweet_id = "mock_tweet_id_no_keys"
        db.commit()
        db.refresh(db_content)
        return db_content

# --- Twitter OAuth 2.0 PKCE Endpoints ---

@app.get("/api/auth/twitter/login")
def twitter_login(brand_id: int, db: Session = Depends(get_db)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
        
    client_id = os.getenv("TWITTER_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="TWITTER_CLIENT_ID not configured in backend environment")

    # Generate PKCE verifier/challenge
    verifier, challenge = generate_pkce()
    
    import secrets
    state = secrets.token_urlsafe(32)

    # Save to Brand record for callback verification
    db_brand.twitter_oauth_state = state
    db_brand.twitter_oauth_code_verifier = verifier
    db.commit()

    redirect_uri = "http://localhost:8000/api/auth/twitter/callback"
    scope = "tweet.read tweet.write users.read offline.access"
    
    import urllib.parse
    auth_url = (
        f"https://twitter.com/i/oauth2/authorize"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
        f"&scope={urllib.parse.quote(scope)}"
        f"&state={state}"
        f"&code_challenge={challenge}"
        f"&code_challenge_method=S256"
    )

    return {"auth_url": auth_url}

@app.get("/api/auth/twitter/callback")
def twitter_callback(code: str = None, state: str = None, error: str = None, db: Session = Depends(get_db)):
    from fastapi.responses import RedirectResponse
    
    if error:
        print(f"X OAuth error returned: {error}")
        return RedirectResponse(url=f"http://localhost:5173/brands?oauth=failed&reason={error}")
        
    if not code or not state:
        return RedirectResponse(url="http://localhost:5173/brands?oauth=failed&reason=Missing+parameters")

    # Find brand with corresponding state
    db_brand = db.query(models.Brand).filter(models.Brand.twitter_oauth_state == state).first()
    if not db_brand:
        print("X OAuth callback: invalid or expired state")
        return RedirectResponse(url="http://localhost:5173/brands?oauth=failed&reason=Invalid+or+expired+state")

    client_id = os.getenv("TWITTER_CLIENT_ID")
    client_secret = os.getenv("TWITTER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return RedirectResponse(url="http://localhost:5173/brands?oauth=failed&reason=Keys+not+configured")

    redirect_uri = "http://localhost:8000/api/auth/twitter/callback"
    token_url = "https://api.twitter.com/2/oauth2/token"

    import requests
    import base64
    
    auth_str = f"{client_id}:{client_secret}"
    b64_auth = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
    
    headers = {
        "Authorization": f"Basic {b64_auth}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code_verifier": db_brand.twitter_oauth_code_verifier,
        "client_id": client_id
    }

    try:
        response = requests.post(token_url, headers=headers, data=data)
        if response.status_code != 200:
            print(f"Token exchange failed: {response.text}")
            return RedirectResponse(url=f"http://localhost:5173/brands?oauth=failed&reason=Token+exchange+failed")

        tokens = response.json()
        db_brand.twitter_oauth2_access_token = tokens["access_token"]
        db_brand.twitter_oauth2_refresh_token = tokens.get("refresh_token")
        
        expires_in = tokens.get("expires_in", 7200)
        db_brand.twitter_oauth2_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        
        # Fetch username
        user_headers = {
            "Authorization": f"Bearer {tokens['access_token']}"
        }
        user_resp = requests.get("https://api.twitter.com/2/users/me", headers=user_headers)
        if user_resp.status_code == 200:
            user_data = user_resp.json()
            db_brand.twitter_username = user_data.get("data", {}).get("username")
        
        # Clear transient PKCE verifiers
        db_brand.twitter_oauth_state = None
        db_brand.twitter_oauth_code_verifier = None
        db.commit()

        return RedirectResponse(url=f"http://localhost:5173/brands?oauth=success&username={db_brand.twitter_username}")
    except Exception as e:
        print(f"Exception during OAuth callback: {e}")
        return RedirectResponse(url="http://localhost:5173/brands?oauth=failed&reason=Exception")

@app.post("/api/brands/{brand_id}/disconnect", response_model=schemas.Brand)
def twitter_disconnect(brand_id: int, db: Session = Depends(get_db)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
        
    db_brand.twitter_oauth2_access_token = None
    db_brand.twitter_oauth2_refresh_token = None
    db_brand.twitter_oauth2_token_expires_at = None
    db_brand.twitter_username = None
    db.commit()
    db.refresh(db_brand)
    return db_brand

# --- Validation Rules ---

@app.post("/api/brands/{brand_id}/rules", response_model=schemas.ValidationRule)
def add_validation_rule(brand_id: int, rule: schemas.ValidationRuleCreate, db: Session = Depends(get_db)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    db_rule = models.ValidationRule(**rule.model_dump(), brand_id=brand_id)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@app.get("/api/brands/{brand_id}/rules", response_model=List[schemas.ValidationRule])
def get_validation_rules(brand_id: int, db: Session = Depends(get_db)):
    return db.query(models.ValidationRule).filter(models.ValidationRule.brand_id == brand_id).all()

# --- Admin Panel Endpoints ---

@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_admin_user)):
    total_users = db.query(models.User).count()
    verified_users = db.query(models.User).filter(models.User.is_verified == True).count()
    unverified_users = total_users - verified_users

    total_brands = db.query(models.Brand).count()
    connected_brands = db.query(models.Brand).filter(models.Brand.twitter_username != None).count()
    disconnected_brands = total_brands - connected_brands

    total_drafts = db.query(models.ContentItem).filter(models.ContentItem.status == models.StatusEnum.DRAFT).count()
    total_scheduled = db.query(models.ContentItem).filter(models.ContentItem.status == models.StatusEnum.SCHEDULED).count()
    total_published = db.query(models.ContentItem).filter(models.ContentItem.status == models.StatusEnum.PUBLISHED).count()
    total_rejected = db.query(models.ContentItem).filter(models.ContentItem.status == models.StatusEnum.REJECTED).count()
    total_pending = db.query(models.ContentItem).filter(models.ContentItem.status == models.StatusEnum.PENDING_APPROVAL).count()

    # Compile actual activity timeline over the last 7 days
    from datetime import datetime, timedelta
    activity_timeline = []
    now = datetime.utcnow()
    for i in range(6, -1, -1):
        target_day = now - timedelta(days=i)
        start_of_day = target_day.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_day.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        day_published = db.query(models.ContentItem).filter(
            models.ContentItem.status == models.StatusEnum.PUBLISHED,
            models.ContentItem.created_at >= start_of_day,
            models.ContentItem.created_at <= end_of_day
        ).count()
        
        day_scheduled = db.query(models.ContentItem).filter(
            models.ContentItem.status == models.StatusEnum.SCHEDULED,
            models.ContentItem.created_at >= start_of_day,
            models.ContentItem.created_at <= end_of_day
        ).count()

        activity_timeline.append({
            "date": start_of_day.strftime("%b %d"),
            "published": day_published,
            "scheduled": day_scheduled
        })

    # Group brands by niche for diversity graph
    niche_counts = {}
    brands = db.query(models.Brand).all()
    for b in brands:
        niche = b.niche or "Uncategorized"
        niche = niche.strip() if niche else "Uncategorized"
        niche_counts[niche] = niche_counts.get(niche, 0) + 1
    
    niche_timeline = [{"niche": k, "count": v} for k, v in niche_counts.items()]

    return {
        "stats": {
            "total_users": total_users,
            "verified_users": verified_users,
            "unverified_users": unverified_users,
            "total_brands": total_brands,
            "connected_brands": connected_brands,
            "disconnected_brands": disconnected_brands,
            "content": {
                "drafts": total_drafts,
                "scheduled": total_scheduled,
                "published": total_published,
                "rejected": total_rejected,
                "pending": total_pending
            }
        },
        "activity_timeline": activity_timeline,
        "niche_timeline": niche_timeline
    }

@app.get("/api/admin/users")
def get_admin_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_admin_user)):
    users = db.query(models.User).all()
    result = []
    for u in users:
        brands_data = []
        for b in u.brands:
            # count scheduled
            scheduled_count = db.query(models.ContentItem).filter(
                models.ContentItem.brand_id == b.id,
                models.ContentItem.status == models.StatusEnum.SCHEDULED
            ).count()
            
            # count published
            published_count = db.query(models.ContentItem).filter(
                models.ContentItem.brand_id == b.id,
                models.ContentItem.status == models.StatusEnum.PUBLISHED
            ).count()
            
            # posting plan data if exists
            posting_plan_data = None
            if b.posting_plan:
                posting_plan_data = {
                    "id": b.posting_plan.id,
                    "active_days": b.posting_plan.active_days,
                    "time_slots": b.posting_plan.time_slots,
                    "volume": b.posting_plan.volume,
                    "is_active": b.posting_plan.is_active
                }
                
            brands_data.append({
                "id": b.id,
                "name": b.name,
                "description": b.description,
                "niche": b.niche,
                "quirks": b.quirks,
                "persona_guidelines": b.persona_guidelines,
                "twitter_username": b.twitter_username,
                "automation_mode": b.automation_mode,
                "generations_today": b.generations_today,
                "posts_today": b.posts_today,
                "last_generation_date": b.last_generation_date.isoformat() if b.last_generation_date else None,
                "last_post_date": b.last_post_date.isoformat() if b.last_post_date else None,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "scheduled_count": scheduled_count,
                "published_count": published_count,
                "posting_plan": posting_plan_data
            })
            
        result.append({
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_verified": u.is_verified,
            "brands": brands_data
        })
    return result

@app.put("/api/admin/users/{user_id}/role")
def update_user_role(user_id: int, role_update: schemas.AdminUserRoleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_admin_user)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own administrative role")

    db_user.role = role_update.role
    db.commit()
    db.refresh(db_user)
    return {"ok": True, "user_id": db_user.id, "new_role": db_user.role}

@app.delete("/api/admin/users/{user_id}")
def delete_user_profile(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_admin_user)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrative profile")

    db.delete(db_user)
    db.commit()
    return {"ok": True, "detail": "User and all associated data permanently deleted"}

@app.put("/api/admin/brands/{brand_id}/quota")
def update_brand_quota(brand_id: int, quota_update: schemas.AdminBrandQuotaUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_admin_user)):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    db_brand.generations_today = quota_update.generations_today
    db_brand.posts_today = quota_update.posts_today
    db.commit()
    db.refresh(db_brand)
    return {
        "ok": True, 
        "brand_id": db_brand.id, 
        "generations_today": db_brand.generations_today, 
        "posts_today": db_brand.posts_today
    }

