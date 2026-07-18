-- ═══════════════════════════════════════════════════════════════════════════
-- EDUNIAA GLOBAL — Supabase Schema
-- Run this entire file once in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. colleges ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colleges (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- ── 2. college_cutoffs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS college_cutoffs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  college_code  TEXT        NOT NULL REFERENCES colleges(code) ON DELETE CASCADE,
  year          INTEGER     NOT NULL,
  category      TEXT        NOT NULL,
  cutoff_score  NUMERIC     NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. leads ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name   TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  user_score  INTEGER,
  tool        TEXT        DEFAULT 'unknown',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. RLS — service key bypasses RLS; anon key gets read-only on public data ─
ALTER TABLE colleges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE college_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads           ENABLE ROW LEVEL SECURITY;

-- Frontend (anon key) can read colleges and cutoffs
CREATE POLICY "anon_read_colleges"  ON colleges        FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_cutoffs"   ON college_cutoffs FOR SELECT TO anon USING (true);

-- leads: only service role (backend) can read/write — no anon access
-- (no anon policy = anon is blocked, which is correct)

-- ── 5. Seed colleges (23 MH private medical colleges) ────────────────────────
INSERT INTO colleges (code, name) VALUES
  ('1105', 'K.J. Somaiya Medical College & Research Centre, Mumbai'),
  ('1108', 'Terna Medical College, Nerul, Navi Mumbai'),
  ('1112', 'Maharashtra Institute of Medical Education & Research (MIMER), Pune'),
  ('1118', 'MVPS Dr. Vasantrao Pawar Medical College & Research Centre, Nashik'),
  ('1120', 'Annasaheb Chudaman Patil Memorial Medical College, Dhule'),
  ('1135', 'Dr. Vitthalrao Vikhe Patil Foundation''s Medical College, Ahilya Nagar'),
  ('1136', 'Smt. Kashibai Navale Medical College, Pune'),
  ('1137', 'Ashwini Rural Medical College, Solapur'),
  ('1138', 'Dr. Ulhas Patil Medical College, Jalgaon'),
  ('1139', 'B.K.L. Walawalkar Rural Medical College, Chiplun'),
  ('1143', 'Prakash Institute of Medical Sciences, Islampur'),
  ('1144', 'SMBT Institute of Medical Sciences, Nandihills, Igatpuri, Nashik'),
  ('1147', 'Vedanta Institute of Medical Sciences, Palghar'),
  ('1152', 'SSPM Medical College, Sindhudurg'),
  ('1156', 'Dr. N.Y. Tasgaonkar Institute of Medical Sciences, Karjat'),
  ('1157', 'Bharatratna Atal Bihari Vajpayee Medical College, Pune'),
  ('1223', 'N.K.P. Salve Institute of Medical Sciences & Research Centre, Nagpur'),
  ('1225', 'Dr. Panjabrao Deshmukh Memorial Medical College, Amravati'),
  ('1261', 'Dr. Rajendra Gode Medical College, Amravati'),
  ('1330', 'Maharashtra Institute of Medical Sciences & Research (MIMSR), Latur'),
  ('1345', 'Indian Institute of Medical Sciences & Research, Badnapur'),
  ('1362', 'Parbhani Medical College, Parbhani'),
  ('1365', 'Ramchandra Institute of Medical Sciences, Chh. Sambhajinagar')
ON CONFLICT (code) DO NOTHING;
