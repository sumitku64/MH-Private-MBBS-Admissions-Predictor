import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

let _cache = null;
let _pending = null;

async function _fetchAiq() {
  if (!supabase) return null;
  const [roundRes, stateRes] = await Promise.all([
    supabase.from('aiq_round_cutoffs').select('course, category, round, air, score'),
    supabase.from('aiq_state_cutoffs').select('state, category, year, last_rank, score'),
  ]);
  if (!roundRes.data?.length && !stateRes.data?.length) return null;
  return { rounds: roundRes.data ?? [], states: stateRes.data ?? [] };
}

export function useAiqData() {
  const [data, setData]       = useState(_cache);
  const [loading, setLoading] = useState(!_cache && !!supabase);

  useEffect(() => {
    if (_cache) return;
    if (!_pending) _pending = _fetchAiq();
    _pending
      .then(result => { if (result) { _cache = result; setData(result); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { aiq: data, loading };
}
