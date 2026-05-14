import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")
import random
import string
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2 import pool

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

EXPIRY_HOURS = 2
CLEANUP_INTERVAL_SECONDS = 60  # run cleanup every minute

# PostgreSQL connection pool
db_pool = None

# Database Credentials from .env
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

def init_db():
    global db_pool
    db_pool = psycopg2.pool.ThreadedConnectionPool(
        1, 10,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    
    # Create table if it doesn't exist
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS clipboard (
                    code VARCHAR(4) PRIMARY KEY,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error initializing database: {e}")
    finally:
        db_pool.putconn(conn)

def purge_expired():
    """Remove entries older than EXPIRY_HOURS."""
    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM clipboard WHERE created_at <= NOW() - INTERVAL '%s hours';", (EXPIRY_HOURS,))
            conn.commit()
            removed = cur.rowcount
            return removed
    except Exception as e:
        conn.rollback()
        print(f"[Cleanup] Error: {e}")
        return 0
    finally:
        db_pool.putconn(conn)


# ─── Background cleanup task ─────────────────────────────────────────────────

async def cleanup_loop():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            removed = purge_expired()
            if removed > 0:
                print(f"[Cleanup] Removed {removed} expired entry/entries.")
        except Exception as exc:
            print(f"[Cleanup] Error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    if db_pool:
        db_pool.closeall()


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="SnapVault API — by Charan", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # ── Production / Vercel ──────────────────────────────────────────
        # Replace the line below with your exact Vercel URL after first deploy
        # e.g. "https://snapvault.vercel.app"
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_unique_code(conn) -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=4))
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM clipboard WHERE code = %s;", (code,))
            if cur.fetchone() is None:
                return code


# ─── Schemas ─────────────────────────────────────────────────────────────────

class PasteRequest(BaseModel):
    content: str


class PasteResponse(BaseModel):
    code: str
    created_at: str
    expires_at: str


class RetrieveResponse(BaseModel):
    code: str
    content: str
    created_at: str
    expires_at: str


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.post("/api/paste", response_model=PasteResponse)
def paste_content(req: PasteRequest):
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty.")

    # Purge expired entries
    purge_expired()

    conn = db_pool.getconn()
    try:
        code = generate_unique_code(conn)
        
        now = datetime.now(timezone.utc)
        
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO clipboard (code, content, created_at) VALUES (%s, %s, %s) RETURNING created_at;",
                (code, req.content, now)
            )
            created_at_dt = cur.fetchone()[0]
            conn.commit()
            
        expires = created_at_dt + timedelta(hours=EXPIRY_HOURS)
        return PasteResponse(code=code, created_at=created_at_dt.isoformat(), expires_at=expires.isoformat())
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db_pool.putconn(conn)


@app.get("/api/retrieve/{code}", response_model=RetrieveResponse)
def retrieve_content(code: str):
    code = code.strip().upper()
    if len(code) != 4 or not code.isalpha():
        raise HTTPException(status_code=400, detail="Code must be exactly 4 uppercase letters.")

    # Purge expired
    purge_expired()

    conn = db_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT content, created_at FROM clipboard WHERE code = %s;", (code,))
            row = cur.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Code not found. It may have expired or is invalid.")
                
            content, created_at_dt = row
            
            # Check expiry (in case purge hasn't caught it yet)
            now = datetime.now(timezone.utc)
            if created_at_dt + timedelta(hours=EXPIRY_HOURS) <= now:
                raise HTTPException(status_code=404, detail="Code not found. It may have expired or is invalid.")
                
            expires = created_at_dt + timedelta(hours=EXPIRY_HOURS)
            
            return RetrieveResponse(
                code=code,
                content=content,
                created_at=created_at_dt.isoformat(),
                expires_at=expires.isoformat(),
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db_pool.putconn(conn)


@app.get("/health")
def health():
    return {"status": "ok"}
