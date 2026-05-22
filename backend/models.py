from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
import enum
import datetime
from sqlalchemy.types import Date
from database import Base

class StatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"

class UserRoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    EDITOR = "EDITOR"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRoleEnum), default=UserRoleEnum.EDITOR)
    is_verified = Column(Boolean, default=False)
    
    content_items = relationship("ContentItem", back_populates="author")
    brands = relationship("Brand", back_populates="owner")

class Brand(Base):
    __tablename__ = "brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text)
    niche = Column(String, nullable=True)
    quirks = Column(Text, nullable=True)
    persona_guidelines = Column(Text)
    
    # Twitter OAuth 2.0 Credentials
    twitter_oauth2_access_token = Column(String, nullable=True)
    twitter_oauth2_refresh_token = Column(String, nullable=True)
    twitter_oauth2_token_expires_at = Column(DateTime, nullable=True)
    twitter_username = Column(String, nullable=True)
    twitter_oauth_state = Column(String, nullable=True)
    twitter_oauth_code_verifier = Column(String, nullable=True)
    
    automation_mode = Column(String, default="manual")
    
    # Rate Limiting
    generations_today = Column(Integer, default=0)
    last_generation_date = Column(Date, nullable=True)
    posts_today = Column(Integer, default=0)
    last_post_date = Column(Date, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="brands")
    content_items = relationship("ContentItem", back_populates="brand")
    validation_rules = relationship("ValidationRule", back_populates="brand")
    posting_plan = relationship("PostingPlan", back_populates="brand", uselist=False)

class PostingPlan(Base):
    __tablename__ = "posting_plans"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), unique=True)
    active_days = Column(JSON) # e.g. ["Mon", "Wed", "Fri"]
    time_slots = Column(JSON) # e.g. ["09:00", "17:00"]
    volume = Column(String) # "chill", "growth", "viral"
    is_active = Column(Boolean, default=True)
    
    brand = relationship("Brand", back_populates="posting_plan")

class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"))
    body = Column(Text)
    status = Column(Enum(StatusEnum), default=StatusEnum.DRAFT)
    scheduled_for = Column(DateTime, nullable=True)
    tweet_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    author_id = Column(Integer, ForeignKey("users.id"))
    
    brand = relationship("Brand", back_populates="content_items")
    author = relationship("User", back_populates="content_items")

class ValidationRule(Base):
    __tablename__ = "validation_rules"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"))
    rule_type = Column(String) # e.g., 'forbidden_words', 'max_length'
    parameters = Column(JSON) # e.g., {"words": ["bad", "ugly"]}
    
    brand = relationship("Brand", back_populates="validation_rules")
