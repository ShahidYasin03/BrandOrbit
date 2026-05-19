from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from models import StatusEnum, UserRoleEnum

# User Schemas
class UserBase(BaseModel):
    email: str
    role: UserRoleEnum = UserRoleEnum.EDITOR

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    
    class Config:
        from_attributes = True

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# ValidationRule Schemas
class ValidationRuleBase(BaseModel):
    rule_type: str
    parameters: Dict[str, Any]

class ValidationRuleCreate(ValidationRuleBase):
    pass

class ValidationRule(ValidationRuleBase):
    id: int
    brand_id: int
    
    class Config:
        from_attributes = True

# PostingPlan Schemas
class PostingPlanBase(BaseModel):
    active_days: List[str]
    time_slots: List[str]
    volume: str

class PostingPlanCreate(PostingPlanBase):
    pass

class PostingPlan(PostingPlanBase):
    id: int
    brand_id: int
    
    class Config:
        from_attributes = True

# Brand Schemas
class BrandBase(BaseModel):
    name: str
    description: Optional[str] = None
    niche: Optional[str] = None
    quirks: Optional[str] = None
    persona_guidelines: Optional[str] = None
    twitter_api_key: Optional[str] = None
    twitter_api_secret: Optional[str] = None
    twitter_access_token: Optional[str] = None
    twitter_access_secret: Optional[str] = None
    
    # Twitter OAuth 2.0 Credentials
    twitter_oauth2_access_token: Optional[str] = None
    twitter_oauth2_refresh_token: Optional[str] = None
    twitter_oauth2_token_expires_at: Optional[datetime] = None
    twitter_username: Optional[str] = None
    twitter_oauth_state: Optional[str] = None
    twitter_oauth_code_verifier: Optional[str] = None
    
    automation_mode: str = "manual"
    
    generations_today: int = 0
    last_generation_date: Optional[date] = None
    posts_today: int = 0
    last_post_date: Optional[date] = None

class BrandCreate(BrandBase):
    pass

class Brand(BrandBase):
    id: int
    created_at: datetime
    validation_rules: List[ValidationRule] = []
    posting_plan: Optional[PostingPlan] = None
    
    class Config:
        from_attributes = True

# ContentItem Schemas
class ContentItemBase(BaseModel):
    body: str
    scheduled_for: Optional[datetime] = None
    tweet_id: Optional[str] = None

class TrendGenerateRequest(BaseModel):
    trend: Optional[str] = None

class ContentItemCreate(ContentItemBase):
    pass

class ContentItemUpdate(BaseModel):
    body: str

class ContentItem(ContentItemBase):
    id: int
    brand_id: int
    status: StatusEnum
    created_at: datetime
    author_id: Optional[int] = None
    
    class Config:
        from_attributes = True
