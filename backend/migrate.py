import sqlite3

def run_migration():
    conn = sqlite3.connect('fyp_database_v3.db')
    cursor = conn.cursor()
    
    try:
        # Add automation_mode column to brands table
        try:
            cursor.execute("ALTER TABLE brands ADD COLUMN automation_mode VARCHAR DEFAULT 'manual'")
            print("Added automation_mode to brands table.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" not in str(e).lower():
                print(f"Error adding automation_mode: {e}")

        # Add Rate Limit columns
        try:
            cursor.execute("ALTER TABLE brands ADD COLUMN generations_today INTEGER DEFAULT 0")
            print("Added generations_today to brands table.")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE brands ADD COLUMN last_generation_date DATE DEFAULT NULL")
            print("Added last_generation_date to brands table.")
        except sqlite3.OperationalError:
            pass
            
        try:
            cursor.execute("ALTER TABLE brands ADD COLUMN posts_today INTEGER DEFAULT 0")
            print("Added posts_today to brands table.")
        except sqlite3.OperationalError:
            pass
            
        try:
            cursor.execute("ALTER TABLE brands ADD COLUMN last_post_date DATE DEFAULT NULL")
            print("Added last_post_date to brands table.")
        except sqlite3.OperationalError:
            pass

        # OAuth 2.0 Columns
        oauth2_columns = [
            ("twitter_oauth2_access_token", "VARCHAR DEFAULT NULL"),
            ("twitter_oauth2_refresh_token", "VARCHAR DEFAULT NULL"),
            ("twitter_oauth2_token_expires_at", "DATETIME DEFAULT NULL"),
            ("twitter_username", "VARCHAR DEFAULT NULL"),
            ("twitter_oauth_state", "VARCHAR DEFAULT NULL"),
            ("twitter_oauth_code_verifier", "VARCHAR DEFAULT NULL")
        ]

        for col_name, col_type in oauth2_columns:
            try:
                cursor.execute(f"ALTER TABLE brands ADD COLUMN {col_name} {col_type}")
                print(f"Added {col_name} to brands table.")
            except sqlite3.OperationalError:
                pass

        conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
