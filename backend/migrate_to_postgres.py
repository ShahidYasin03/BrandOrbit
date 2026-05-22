import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

# Add backend directory to path to ensure imports work when running from command line
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import Base
import models

def run_migration():
    print("==================================================")
    print("      STARTING BRANDORBIT DATABASE MIGRATION       ")
    print("==================================================")

    # 1. Load configuration
    load_dotenv()
    postgres_url = os.getenv("DATABASE_URL")
    if not postgres_url:
        print("ERROR: DATABASE_URL not found in .env file.")
        print("Please configure your PostgreSQL connection string first.")
        sys.exit(1)

    if postgres_url.startswith("postgresql://"):
        postgres_url = postgres_url.replace("postgresql://", "postgresql+pg8000://", 1)
    elif postgres_url.startswith("postgres://"):
        postgres_url = postgres_url.replace("postgres://", "postgresql+pg8000://", 1)

    sqlite_url = "sqlite:///./fyp_database_v3.db"

    print(f"Source Database (SQLite): {sqlite_url}")
    print(f"Target Database (PostgreSQL): {postgres_url.split('@')[-1] if '@' in postgres_url else postgres_url} (credentials hidden)")

    # 2. Setup engines and sessions
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    postgres_engine = create_engine(postgres_url)

    SqliteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)

    sqlite_session = SqliteSession()
    postgres_session = PostgresSession()

    try:
        # 3. Create tables in PostgreSQL (if they do not exist)
        print("\n[Step 1/3] Ensuring all tables exist in PostgreSQL...")
        Base.metadata.create_all(bind=postgres_engine)
        print("Tables initialized successfully.")

        # 4. Define migration list in order of dependency to respect foreign key constraints
        # Order: User -> Brand -> PostingPlan -> ContentItem -> ValidationRule
        migration_configs = [
            {
                "model": models.User,
                "name": "users",
                "fields": ["id", "email", "hashed_password", "role", "is_verified"]
            },
            {
                "model": models.Brand,
                "name": "brands",
                "fields": [
                    "id", "name", "description", "niche", "quirks", "persona_guidelines",
                    "twitter_oauth2_access_token", "twitter_oauth2_refresh_token",
                    "twitter_oauth2_token_expires_at", "twitter_username", 
                    "twitter_oauth_state", "twitter_oauth_code_verifier",
                    "automation_mode", "generations_today", "last_generation_date",
                    "posts_today", "last_post_date", "created_at", "owner_id"
                ]
            },
            {
                "model": models.PostingPlan,
                "name": "posting_plans",
                "fields": ["id", "brand_id", "active_days", "time_slots", "volume", "is_active"]
            },
            {
                "model": models.ContentItem,
                "name": "content_items",
                "fields": ["id", "brand_id", "body", "status", "scheduled_for", "tweet_id", "created_at", "author_id"]
            },
            {
                "model": models.ValidationRule,
                "name": "validation_rules",
                "fields": ["id", "brand_id", "rule_type", "parameters"]
            }
        ]

        print("\n[Step 2/3] Migrating data table by table...")

        for config in migration_configs:
            model = config["model"]
            table_name = config["name"]
            fields = config["fields"]

            # Count target table records to check if data already exists
            pg_count = postgres_session.query(model).count()
            if pg_count > 0:
                print(f"[WARNING] Table '{table_name}' already contains {pg_count} record(s) in PostgreSQL. Skipping to avoid duplicates.")
                continue

            # Fetch all records from SQLite
            sqlite_records = sqlite_session.query(model).all()
            total_records = len(sqlite_records)

            if total_records == 0:
                print(f"[INFO] Table '{table_name}' has 0 records in SQLite. Skipping data transfer.")
                continue

            print(f"Copying {total_records} record(s) for '{table_name}'...")

            # Copy records
            for record in sqlite_records:
                # Create a new dictionary of field-value pairs
                record_data = {}
                for field in fields:
                    val = getattr(record, field)
                    record_data[field] = val

                # Create a new PostgreSQL model instance
                pg_record = model(**record_data)
                postgres_session.add(pg_record)

            postgres_session.commit()
            print(f"[SUCCESS] Successfully migrated {total_records} record(s) into table '{table_name}'.")

        # 5. Reset primary key sequence values on PostgreSQL
        # SQLite handles auto-increment automatically based on max(id),
        # but PostgreSQL uses named Sequence generators (e.g. users_id_seq) which must be synced manually
        # when we insert specific primary key IDs.
        print("\n[Step 3/3] Synchronizing PostgreSQL sequence generators...")
        for config in migration_configs:
            table_name = config["name"]
            
            # Find the max ID in the table to set the sequence starting value
            max_id_result = postgres_session.execute(text(f"SELECT MAX(id) FROM {table_name}")).scalar()
            if max_id_result:
                sequence_name = f"{table_name}_id_seq"
                postgres_session.execute(
                    text(f"SELECT setval(:seq_name, :max_val)"),
                    {"seq_name": sequence_name, "max_val": max_id_result}
                )
                print(f"Synced sequence '{sequence_name}' to max ID: {max_id_result}")
            else:
                print(f"No records in '{table_name}', skipped sequence sync.")
        
        postgres_session.commit()
        print("\n=== MIGRATION COMPLETED SUCCESSFULLY! ===")
        print("All existing users and data are now in your PostgreSQL database.")

    except Exception as err:
        postgres_session.rollback()
        print(f"\n[ERROR] Migration failed! Details: {err}")
        raise err
    finally:
        sqlite_session.close()
        postgres_session.close()
        sqlite_engine.dispose()
        postgres_engine.dispose()

if __name__ == "__main__":
    run_migration()
