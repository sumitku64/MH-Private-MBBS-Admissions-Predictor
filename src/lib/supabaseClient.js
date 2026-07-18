import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Returns null when env vars are not set — callers must guard with `if (supabase)`
export const supabase = url && anon ? createClient(url, anon) : null;
