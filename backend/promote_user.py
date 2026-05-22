import sys
from sqlalchemy.orm import Session
from database import SessionLocal
import models

def promote_email(email: str):
    db: Session = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"Error: User with email '{email}' not found. Please register the account in the frontend first!")
            return
        
        user.role = models.UserRoleEnum.ADMIN
        user.is_verified = True  # Automatically mark them as verified for ease of access
        db.commit()
        print(f"=========================================================")
        print(f" SUCCESS: Account '{email}' promoted to ADMIN successfully!")
        print(f"=========================================================")
    except Exception as e:
        print(f"Error promoting user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_user.py <email>")
        sys.exit(1)
    
    email_to_promote = sys.argv[1].strip()
    promote_email(email_to_promote)
