-- Step 1: Delete test records
DELETE FROM student_chat_history;
DELETE FROM student_shortlists;
DELETE FROM students;
DELETE FROM leads;

-- Step 2: Add Google identity columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS google_id    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS google_name  TEXT;

-- Step 3: Make phone and pin nullable
ALTER TABLE public.students
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN pin   DROP NOT NULL;

-- Step 4: Enforce at least one auth method per row
ALTER TABLE public.students
  ADD CONSTRAINT auth_method_required
  CHECK (phone IS NOT NULL OR google_id IS NOT NULL);

-- Step 5: Add id-based FK column to child tables
ALTER TABLE public.student_shortlists
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;

ALTER TABLE public.student_chat_history
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE;

-- Step 6: Make student_id NOT NULL on child tables
ALTER TABLE public.student_shortlists
  ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE public.student_chat_history
  ALTER COLUMN student_id SET NOT NULL;

-- Step 7: Remove old phone-based FK columns from child tables
ALTER TABLE public.student_shortlists
  DROP COLUMN student_phone;
ALTER TABLE public.student_chat_history
  DROP COLUMN student_phone;

-- Step 8: Add indexes for Google lookups
CREATE INDEX IF NOT EXISTS idx_students_google_id    ON students(google_id);
CREATE INDEX IF NOT EXISTS idx_students_google_email ON students(google_email);
