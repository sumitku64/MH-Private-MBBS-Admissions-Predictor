import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

let _cache = null;
let _pending = null;

async function _fetchFromSupabase() {
  if (!supabase) return null;
  const [colRes, feeRes, cutRes] = await Promise.all([
    supabase.from('colleges').select('code, name, seats').order('code'),
    supabase.from('college_fees').select('college_code, category, amount'),
    supabase.from('college_cutoffs').select('college_code, year, category, cutoff_score'),
  ]);
  if (!colRes.data?.length) return null;
  return colRes.data.map(c => ({
    code:  c.code,
    name:  c.name,
    seats: c.seats,
    fees:  Object.fromEntries(
      (feeRes.data ?? []).filter(f => f.college_code === c.code).map(f => [f.category, f.amount])
    ),
    cutoffs: (cutRes.data ?? [])
      .filter(ct => ct.college_code === c.code)
      .reduce((acc, ct) => {
        if (!acc[ct.year]) acc[ct.year] = {};
        acc[ct.year][ct.category] = ct.cutoff_score;
        return acc;
      }, {}),
  }));
}

export function useCollegeData(fallback = []) {
  const [data, setData]       = useState(fallback);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (_cache) { setData(_cache); setLoading(false); return; }
    if (!_pending) _pending = _fetchFromSupabase();
    _pending
      .then(result => { if (result) { _cache = result; setData(result); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { collegeData: data, loading };
}
