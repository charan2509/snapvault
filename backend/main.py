import asyncio
import json
import random
import string
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

EXPIRY_HOURS = 2
CLEANUP_INTERVAL_SECONDS = 60  # run cleanup every minute
DB_FILE = Path(__file__).parent / "clipboard_db.json"


# ─── DB helpers ─────────────────────────────────────────────────────────────

def load_db() -> dict:
    if not DB_FILE.exists():
        DB_FILE.write_text(json.dumps({}), encoding="utf-8")
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_db(data: dict) -> None:
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def expires_at_from(created_at_str: str) -> datetime:
    created = datetime.fromisoformat(created_at_str)
    return created + timedelta(hours=EXPIRY_HOURS)


def purge_expired(db: dict) -> tuple[dict, int]:
    """Remove entries older than EXPIRY_HOURS. Returns (cleaned_db, removed_count)."""
    now = datetime.now(timezone.utc)
    to_delete = [
        code for code, entry in db.items()
        if expires_at_from(entry["created_at"]) <= now
    ]
    for code in to_delete:
        del db[code]
    return db, len(to_delete)


# ─── Background cleanup task ─────────────────────────────────────────────────

async def cleanup_loop():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            db = load_db()
            db, removed = purge_expired(db)
            if removed:
                save_db(db)
                print(f"[Cleanup] Removed {removed} expired entry/entries.")
        except Exception as exc:
            print(f"[Cleanup] Error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(title="SnapVault API — by Charan", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_unique_code() -> str:
    db = load_db()
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=4))
        if code not in db:
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

    # Purge expired entries on every write
    db = load_db()
    db, _ = purge_expired(db)

    code = generate_unique_code()
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()
    expires = now + timedelta(hours=EXPIRY_HOURS)

    db[code] = {"content": req.content, "created_at": now_str}
    save_db(db)

    return PasteResponse(code=code, created_at=now_str, expires_at=expires.isoformat())


@app.get("/api/retrieve/{code}", response_model=RetrieveResponse)
def retrieve_content(code: str):
    code = code.strip().upper()
    if len(code) != 4 or not code.isalpha():
        raise HTTPException(status_code=400, detail="Code must be exactly 4 uppercase letters.")

    db = load_db()

    # Purge expired on every read too
    db, removed = purge_expired(db)
    if removed:
        save_db(db)

    entry = db.get(code)
    if not entry:
        raise HTTPException(status_code=404, detail="Code not found. It may have expired or is invalid.")

    expires = expires_at_from(entry["created_at"])

    return RetrieveResponse(
        code=code,
        content=entry["content"],
        created_at=entry["created_at"],
        expires_at=expires.isoformat(),
    )


@app.get("/health")
def health():
    return {"status": "ok"}
