/**
 * CollegeRanking.jsx  — Choice Filling Optimizer / AI College Ranking
 *
 * DATA SOURCES:
 *  - useCollegeData()          → live Supabase colleges, fees, cutoffs
 *  - calcFee(), calcProb()     → existing predictionEngine.js (unchanged)
 *  - useUser().profile         → UserContext (NEET score, category, gender)
 *
 * PERSISTENCE:
 *  - Mock choice list is saved to localStorage under 'eduniaa_mock_choice_list'.
 *  - A full DB persistence endpoint does NOT currently exist in server.js.
 *  - The Save List button writes to localStorage only and shows a confirmation toast.
 *    If future DB support is added, replace the localStorage.setItem call with a
 *    fetch to an API endpoint.
 *
 * ORDERING RISK:
 *  - A risk is flagged at position N when the college at position N+1 (lower priority)
 *    has a HIGHER cutoff than the college at position N (higher priority).
 *  - Rationale: if you qualify for position-N+1 (higher cutoff), you will be allocated
 *    that seat and never reach position N — making position N's ordering wrong.
 *  - Risk is calculated from real cutoff data only. If cutoff is null for either
 *    college, no risk is flagged (insufficient data).
 *
 * NO FAKE DATA: All displayed values come from live Supabase data or say "N/A".
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ArrowUp, ArrowDown, X, AlertTriangle, CheckCircle2, ChevronDown, ListOrdered, Save, Trash2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useCollegeData } from '../lib/useCollegeData';
import { calcFee, calcProb } from '../lib/predictionEngine';
import { CATEGORIES, GENDERS } from '../data';

// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'eduniaa_mock_choice_list';
const DEFAULT_YEAR = 2024;

const PROB_CONFIG = {
  high:       { label: 'Likely',     color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  borderline: { label: 'Borderline', color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  reach:      { label: 'Reach',      color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-200',  dot: 'bg-orange-500'  },
  low:        { label: 'Unlikely',   color: 'text-rose-700',    bg: 'bg-rose-100',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
};

// Map predictionEngine 'high'/'borderline'/'low' → our 4-tier display
function mapProb(prob, score, cutoff) {
  if (prob === 'high')       return 'high';
  if (prob === 'borderline') {
    // Further split borderline: if score is within 5% of cutoff → 'borderline', else → 'reach'
    if (cutoff && score < cutoff * 0.97) return 'reach';
    return 'borderline';
  }
  return 'low';
}

function formatFee(fee) {
  if (fee == null) return 'N/A';
  return `₹${(fee / 100000).toFixed(1)}L/yr`;
}

function loadChoiceList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChoiceList(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      {message}
    </div>
  );
}

// ── Left panel: Available College Card ───────────────────────────────────────
function AvailableCard({ college, onAdd, alreadyAdded }) {
  const cfg = PROB_CONFIG[college.tier] || PROB_CONFIG.low;
  return (
    <div className={`bg-white border rounded-xl p-4 ${alreadyAdded ? 'opacity-40' : 'hover:shadow-sm transition-shadow'}`}>
      <div className="flex justify-between items-start gap-2 mb-2">
        <p className="font-bold text-slate-900 text-sm leading-snug">{college.name}</p>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 space-y-0.5">
          <div>Cutoff {college.cutoff ?? 'N/A'} &middot; {formatFee(college.fee)}</div>
          <div>{college.seats} seats</div>
        </div>
        <button
          disabled={alreadyAdded}
          onClick={() => onAdd(college)}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
            alreadyAdded
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {alreadyAdded ? 'Added' : '+ Add'}
        </button>
      </div>
    </div>
  );
}

// ── Right panel: Choice Card ─────────────────────────────────────────────────
function ChoiceCard({ college, position, total, hasRisk, onUp, onDown, onRemove }) {
  const cfg = PROB_CONFIG[college.tier] || PROB_CONFIG.low;
  return (
    <div className={`rounded-xl border ${hasRisk ? 'border-amber-300 bg-amber-50/60' : 'bg-white border-slate-200'}`}>
      {hasRisk && (
        <div className="flex items-start gap-2 px-4 pt-3 pb-2 text-xs text-amber-800 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
          <span>Ordering Risk — a more competitive college (higher cutoff) is ranked below this position. You may lose that seat even if you qualify for both.</span>
        </div>
      )}
      <div className="flex items-center gap-3 p-4">
        {/* Position Badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
          position === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
        }`}>{position}</div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-snug mb-0.5">{college.name}</p>
          <p className="text-[11px] text-slate-400">
            {DEFAULT_YEAR} cutoff ({college.category?.toUpperCase()}): {college.cutoff ?? 'N/A'}
            &nbsp;·&nbsp; Fee: {formatFee(college.fee)}
            &nbsp;·&nbsp; {college.seats} seats
          </p>
        </div>

        {/* Probability badge */}
        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
          {cfg.label}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onUp}
            disabled={position === 1}
            title="Move up"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={onDown}
            disabled={position === total}
            title="Move down"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            title="Remove"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CollegeRanking() {
  const { profile } = useUser();
  const { collegeData: colleges, loading } = useCollegeData();

  // ── Profile-synced inputs (one-time sync, then user-editable) ───────────
  const [score,    setScore]    = useState(() => profile?.userScore ? Number(profile.userScore) : 0);
  const [category, setCategory] = useState(() => profile?.category ?? 'open');
  const [gender,   setGender]   = useState(() => profile?.gender   ?? 'any');
  const [synced,   setSynced]   = useState(false);

  useEffect(() => {
    if (profile?.isRegistered && !synced) {
      if (profile.userScore) setScore(Number(profile.userScore));
      if (profile.category)  setCategory(profile.category);
      if (profile.gender)    setGender(profile.gender);
      setSynced(true);
    }
  }, [profile, synced]);

  // ── Local state ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [choiceList,  setChoiceList]  = useState(loadChoiceList);
  const [toast,       setToast]       = useState(null);

  // ── Compute enriched colleges (score + category + gender → prob + fee) ──
  const enriched = useMemo(() => {
    if (!colleges.length) return [];
    const effectiveGender = gender === 'any' ? 'male' : gender;
    return colleges.map(c => {
      const cutoff = c.cutoffs[DEFAULT_YEAR]?.[category] ?? null;
      const fee    = calcFee(c.fees, category, effectiveGender);
      const { prob } = calcProb(score, cutoff, { canAfford: true }); // canAfford=true so budget doesn't hide colleges here
      const tier   = mapProb(prob, score, cutoff);
      return { id: c.code, name: c.name, code: c.code, seats: c.seats, cutoff, fee, tier, category };
    });
  }, [colleges, score, category, gender]);

  // Sort enriched: High → Borderline → Reach → Low, then cutoff desc within tier
  const TIER_ORDER = { high: 0, borderline: 1, reach: 2, low: 3 };
  const availableSorted = useMemo(() => {
    let list = [...enriched];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    list.sort((a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      (b.cutoff ?? 0) - (a.cutoff ?? 0)
    );
    return list;
  }, [enriched, searchQuery]);

  const addedIds = useMemo(() => new Set(choiceList.map(c => c.id)), [choiceList]);

  // ── Choice list operations ───────────────────────────────────────────────
  const addCollege = useCallback((college) => {
    if (addedIds.has(college.id)) return;
    setChoiceList(prev => [...prev, college]);
  }, [addedIds]);

  const removeCollege = useCallback((id) => {
    setChoiceList(prev => prev.filter(c => c.id !== id));
  }, []);

  const moveUp = useCallback((idx) => {
    if (idx === 0) return;
    setChoiceList(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((idx) => {
    setChoiceList(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setChoiceList([]);
    saveChoiceList([]);
  }, []);

  const saveList = useCallback(() => {
    saveChoiceList(choiceList);
    setToast('Mock choice list saved locally!');
  }, [choiceList]);

  // ── Ordering Risk detection ──────────────────────────────────────────────
  // Risk at index N means: the college at N+1 has a HIGHER cutoff than college at N.
  // This means if you qualify for college[N+1], it will be allocated before college[N],
  // but you wanted college[N] higher — a strategic error.
  const riskFlags = useMemo(() => {
    return choiceList.map((college, idx) => {
      if (idx === choiceList.length - 1) return false;
      const currentCutoff = college.cutoff;
      const nextCutoff    = choiceList[idx + 1].cutoff;
      if (currentCutoff == null || nextCutoff == null) return false;
      return nextCutoff > currentCutoff;
    });
  }, [choiceList]);

  const riskCount = riskFlags.filter(Boolean).length;

  return (
    <div className="min-h-full">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <ListOrdered className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Choice Filling Optimizer</h1>
            <p className="text-xs text-slate-500">Build & validate your mock priority list using real cutoff data</p>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────── */}
      <div className="flex gap-6 items-start flex-col lg:flex-row">

        {/* ════ LEFT PANEL ════ */}
        <div className="lg:w-72 xl:w-80 shrink-0 w-full">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sticky top-6">

            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
              Your NEET Profile
            </h2>

            {/* Score */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Your NEET Score
              </label>
              <input
                type="number" min="0" max="720" value={score}
                onChange={e => setScore(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Category + Gender row */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.value.toUpperCase()}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
                <div className="flex gap-1">
                  {GENDERS.filter(g => g.value !== 'any').map(g => (
                    <button
                      key={g.value}
                      onClick={() => setGender(g.value)}
                      className={`flex-1 text-[11px] font-bold py-2 rounded-lg border transition-all ${
                        gender === g.value || (gender === 'any' && g.value === 'male')
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g.label.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* College Search */}
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Search College</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search college name..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            {/* Available Colleges List */}
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-0.5">
              {loading && (
                <div className="text-center py-8 text-xs text-slate-400">Loading colleges...</div>
              )}
              {!loading && availableSorted.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">No colleges match your search.</div>
              )}
              {!loading && availableSorted.map(c => (
                <AvailableCard
                  key={c.id}
                  college={c}
                  onAdd={addCollege}
                  alreadyAdded={addedIds.has(c.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="flex-1 min-w-0">

          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Your Mock Choice List</h2>
              <p className="text-xs text-slate-500">
                {choiceList.length} college{choiceList.length !== 1 ? 's' : ''}
                {choiceList.length > 0 ? ' · Position 1 is your top choice' : ' · Add colleges from the left panel'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Risk badge */}
              {riskCount > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-black text-amber-800">{riskCount} Ordering Risk{riskCount > 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-amber-600">Higher-ranked college placed below lower-ranked one</div>
                  </div>
                </div>
              )}

              {choiceList.length > 0 && (
                <>
                  <button
                    onClick={saveList}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save List
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-2 text-slate-500 hover:text-rose-600 text-xs font-medium px-3 py-2.5 rounded-xl hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status Legend */}
          <div className="flex flex-wrap gap-4 mb-5">
            {Object.values(PROB_CONFIG).map(cfg => (
              <div key={cfg.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </div>
            ))}
          </div>

          {/* Empty state */}
          {choiceList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl text-center">
              <ListOrdered className="w-10 h-10 text-slate-200 mb-4" />
              <p className="font-bold text-slate-400 mb-1">Your mock list is empty</p>
              <p className="text-xs text-slate-400 max-w-xs">Search for colleges in the left panel and click "+ Add" to build your priority list.</p>
            </div>
          )}

          {/* Choice Cards */}
          {choiceList.length > 0 && (
            <div className="space-y-3">
              {choiceList.map((college, idx) => (
                <ChoiceCard
                  key={college.id}
                  college={college}
                  position={idx + 1}
                  total={choiceList.length}
                  hasRisk={riskFlags[idx]}
                  onUp={() => moveUp(idx)}
                  onDown={() => moveDown(idx)}
                  onRemove={() => removeCollege(college.id)}
                />
              ))}
            </div>
          )}

          {/* Persistence note */}
          <p className="mt-6 text-[11px] text-slate-400 text-center">
            ℹ️ Mock choice list is saved to your browser's local storage. It persists across sessions on this device only.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
