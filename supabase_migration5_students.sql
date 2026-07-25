-- ═══════════════════════════════════════════════════════════════════════════
-- EDUNIAA GLOBAL — Migration 5: Student Auth + Persistent Profiles
-- Run in Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. students ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  neet_score    INTEGER,
  category      TEXT,                    -- open | obc | sebc | vjnt | sc | st
  gender        TEXT,                    -- male | female | any
  pin           TEXT        NOT NULL,    -- 4-digit PIN (plain for now, hash later)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. student_shortlists ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_shortlists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_phone   TEXT        NOT NULL REFERENCES students(phone) ON DELETE CASCADE,
  college_code    TEXT        NOT NULL,
  college_name    TEXT,
  probability     TEXT,                  -- high | borderline | low
  fee             BIGINT,
  cutoff          INTEGER,
  saved_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_phone, college_code)
);

-- ── 3. student_chat_history ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_chat_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_phone   TEXT        NOT NULL REFERENCES students(phone) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. RLS policies ───────────────────────────────────────────────────────────
ALTER TABLE students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_shortlists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_chat_history   ENABLE ROW LEVEL SECURITY;

-- Service role (backend) bypasses RLS — anon gets NO direct access
-- All student data is read/written via the backend API only

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shortlists_phone  ON student_shortlists(student_phone);
CREATE INDEX IF NOT EXISTS idx_chat_phone        ON student_chat_history(student_phone);
CREATE INDEX IF NOT EXISTS idx_chat_created      ON student_chat_history(student_phone, created_at DESC);
