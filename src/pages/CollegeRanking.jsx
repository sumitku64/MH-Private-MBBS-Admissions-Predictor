/**
 * CollegeRanking.jsx  — AI College Ranking (Redesigned)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DATA SOURCES (real — no fake data):
 *  - useCollegeData()    → live Supabase: colleges, fees, cutoffs
 *  - calcFee()           → predictionEngine.js (category+gender → fee)
 *  - calcProb()          → predictionEngine.js (score+cutoff → probability)
 *  - useUser().profile   → UserContext (score, category, gender, budget,
 *                           preferredRegions, needsHostel,
 *                           preferredInstituteType)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT DATA IS AVAILABLE IN SUPABASE:
 *  ✓ college.code, college.name, college.seats
 *  ✓ college.fees  { open, obc_ebc_sebc_male, obc_ebc_sebc_female,
 *                    vjnt_sbc, sc_st }
 *  ✓ college.cutoffs[year][category]  (historical closing NEET scores)
 *
 * WHAT DATA IS NOT AVAILABLE (so we do not fake it):
 *  ✗ city / location / region  (no city column in DB)
 *  ✗ institute type  (govt/private not in DB)
 *  ✗ hostel availability
 *  ✗ NIRF/reputation/placement data
 *
 * ═══════════════════════════════════════════════════════════════════════
 * FIT SCORE FORMULA  (deterministic, not ML, weights sum to 100)
 *
 *  COMPONENT          WEIGHT   CALCULATION
 *  ─────────────────  ──────   ──────────────────────────────────────
 *  Admission Fit        40%    probability tier → normalized 0–100
 *                               high   = 100
 *                               border = 65
 *                               reach  = 35
 *                               low    = 10
 *                               no data= 0
 *
 *  Financial Fit        30%    how well college fits annual budget
 *                               fee == null          → 50 (no penalty, no bonus)
 *                               fee <= budget        → 100
 *                               fee <= budget*1.1    → 70  (within 10% over)
 *                               fee <= budget*1.3    → 40  (within 30% over)
 *                               fee > budget*1.3     → 0
 *
 *  Cutoff Fit           30%    how close score is to cutoff
 *                               score >= cutoff      → 100
 *                               gap  <= 30           → 80
 *                               gap  <= 80           → 60
 *                               gap  <= 150          → 40
 *                               gap  <= 250          → 20
 *                               gap  >  250          → 5
 *                               no cutoff data       → 0
 *
 *  Preference Fit  N/A — no city/type data in DB; not faked.
 *                  If preferredRegions/type become available in DB,
 *                  add a 15% weight and reduce others proportionally.
 *
 *  Final Score  =  0.40 * admissionFit
 *               +  0.30 * financialFit
 *               +  0.30 * cutoffFit
 *               (rounded to nearest integer)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * RANKING MODES (genuine formula changes):
 *
 *  Best Overall:      weights as above  (40/30/30)
 *  Safest Admission:  70% admission + 20% financial + 10% cutoff
 *  Best Value:        30% admission + 50% financial + 20% cutoff
 *  Reach/Ambitious:   20% admission + 20% financial + 60% cutoff
 *                     (cutoff gap inverted — narrower gap = higher rank)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SEARCH/FILTER PIPELINE (AND logic, strict):
 *   1. Category/cutoff filtering (only colleges with data)
 *   2. Budget filtering (using actual calcFee + annualBudget)
 *   3. calcProb() admission probability
 *   4. Fit score calculation
 *   5. Mode-based sorting
 *   6. Name search (applied LAST, on already-filtered set)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CHOICE LIST: localStorage persistence under 'eduniaa_choice_list_v2'
 * ORDERING RISK: flagged when list[N+1].cutoff > list[N].cutoff
 * WHAT-IF: local state only — never overwrites UserContext / saved profile
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, AlertTriangle, CheckCircle2, ChevronDown, Save, Trash2,
  ArrowUp, ArrowDown, X, Info, TrendingUp, DollarSign, Target,
  Star, Shield, Award, Zap, ChevronRight, BarChart2
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useCollegeData } from '../lib/useCollegeData';
import { calcFee, calcProb } from '../lib/predictionEngine';
import { CATEGORIES, GENDERS } from '../data';

// ── Constants ─────────────────────────────────────────────────────────
const STORAGE_KEY   = 'eduniaa_choice_list_v2';
const DEFAULT_YEAR  = 2024;

// Ranking modes with their score weights [admission, financial, cutoff]
const RANKING_MODES = {
  overall:  { label: 'Best Overall',     icon: Star,    weights: [0.40, 0.30, 0.30] },
  safest:   { label: 'Safest Admission', icon: Shield,  weights: [0.70, 0.20, 0.10] },
  value:    { label: 'Best Value',       icon: DollarSign, weights: [0.30, 0.50, 0.20] },
  reach:    { label: 'Reach / Ambitious',icon: Zap,     weights: [0.20, 0.20, 0.60] },
};

// Fit label thresholds
function getFitLabel(score) {
  if (score >= 80) return { label: 'Best Fit',    color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-300', dot: 'bg-emerald-500', ring: 'ring-emerald-200' };
  if (score >= 65) return { label: 'Strong Fit',  color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-300',    dot: 'bg-blue-500',    ring: 'ring-blue-200'    };
  if (score >= 45) return { label: 'Reach',       color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-300',   dot: 'bg-amber-500',   ring: 'ring-amber-200'   };
  return                  { label: 'Low Fit',     color: 'text-rose-700',    bg: 'bg-rose-100',    border: 'border-rose-300',    dot: 'bg-rose-500',    ring: 'ring-rose-200'    };
}

// ── Core fit scoring ───────────────────────────────────────────────────

function calcAdmissionFit(prob) {
  if (prob === 'high')       return 100;
  if (prob === 'borderline') return 65;
  if (prob === 'reach')      return 35;
  if (prob === 'low')        return 10;
  return 0;
}

function calcFinancialFit(fee, budgetRupees) {
  if (fee == null)                           return 50;  // no data — neutral
  if (budgetRupees == null || budgetRupees <= 0) return 50;
  if (fee <= budgetRupees)                   return 100;
  if (fee <= budgetRupees * 1.10)            return 70;
  if (fee <= budgetRupees * 1.30)            return 40;
  return 0;
}

function calcCutoffFit(score, cutoff, mode) {
  if (!cutoff) return 0;
  if (score >= cutoff) return 100;
  const gap = cutoff - score;
  // In Reach/Ambitious mode: reward colleges with smaller gap more aggressively
  if (mode === 'reach') {
    if (gap <= 20)  return 90;
    if (gap <= 50)  return 75;
    if (gap <= 100) return 55;
    if (gap <= 200) return 35;
    if (gap <= 350) return 20;
    return 10;
  }
  if (gap <= 30)  return 80;
  if (gap <= 80)  return 60;
  if (gap <= 150) return 40;
  if (gap <= 250) return 20;
  return 5;
}

function calcFitScore(admFit, finFit, cutFit, mode) {
  const [wa, wf, wc] = RANKING_MODES[mode].weights;
  return Math.round(wa * admFit + wf * finFit + wc * cutFit);
}

// Map calcProb's 3-tier to 4-tier used by this page
function mapProb(probStr, score, cutoff) {
  if (probStr === 'high')       return 'high';
  if (probStr === 'borderline') {
    if (cutoff && score < cutoff * 0.97) return 'reach';
    return 'borderline';
  }
  return 'low';
}

function formatFee(fee) {
  if (fee == null) return 'N/A';
  return `₹${(fee / 100000).toFixed(1)}L/yr`;
}

function formatBudget(b) {
  if (!b) return 'Not set';
  return `₹${(b / 100000).toFixed(0)}L/yr`;
}

// ── Persistence helpers ────────────────────────────────────────────────
function loadChoiceList() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveChoiceList(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// ── Sub-components ─────────────────────────────────────────────────────

function Toast({ message, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 2500); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      {message}
    </div>
  );
}

function WhyBadge({ ok, text }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

function ScoreBar({ value, max = 100, color = 'bg-indigo-500' }) {
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.round((value / max) * 100)}%` }} />
    </div>
  );
}

function RankCard({ college, rank, onAddToList, alreadyAdded, mode }) {
  const [expanded, setExpanded] = useState(false);
  const fit   = getFitLabel(college.fitScore);
  const isTop = rank === 1;

  // Build "why" reasons from actual computed values
  const reasons = [];
  if (college.prob === 'high')                reasons.push({ ok: true,  text: 'High admission probability (above cutoff)' });
  else if (college.prob === 'borderline')     reasons.push({ ok: true,  text: 'Borderline admission — within reach' });
  else if (college.prob === 'reach')          reasons.push({ ok: false, text: 'Below cutoff — lower admission probability' });
  else                                        reasons.push({ ok: false, text: 'Well below cutoff — unlikely admission' });

  if (college.fee == null)                    reasons.push({ ok: false, text: 'Fee data unavailable' });
  else if (college.financialFit === 100)      reasons.push({ ok: true,  text: `Within your ${formatBudget(college._budget)} budget` });
  else if (college.financialFit >= 70)        reasons.push({ ok: false, text: `Fee slightly over budget (${formatFee(college.fee)})` });
  else if (college.financialFit >= 40)        reasons.push({ ok: false, text: `Fee moderately over budget (${formatFee(college.fee)})` });
  else                                        reasons.push({ ok: false, text: `Fee exceeds budget (${formatFee(college.fee)})` });

  if (!college.cutoff)                        reasons.push({ ok: false, text: 'No historical cutoff data available' });
  else if (college.score >= college.cutoff)   reasons.push({ ok: true,  text: `Score (${college.score}) meets or exceeds cutoff (${college.cutoff})` });
  else {
    const gap = college.cutoff - college.score;
    if (gap <= 30)                            reasons.push({ ok: true,  text: `Score is only ${gap} marks below cutoff` });
    else if (gap <= 80)                       reasons.push({ ok: false, text: `Score is ${gap} marks below cutoff` });
    else                                      reasons.push({ ok: false, text: `Score is ${gap} marks below cutoff — significant gap` });
  }

  const probColor = {
    high: 'text-emerald-700', borderline: 'text-amber-700', reach: 'text-orange-700', low: 'text-rose-700'
  }[college.prob] || 'text-slate-600';

  const probLabel = {
    high: 'Likely', borderline: 'Borderline', reach: 'Reach', low: 'Unlikely'
  }[college.prob] || 'N/A';

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${
      isTop ? 'border-indigo-300 shadow-md shadow-indigo-100' : 'border-slate-200'
    }`}>
      {/* Card Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Rank badge */}
          <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex flex-col items-center justify-center font-black text-xs sm:text-sm ${
            isTop ? 'bg-indigo-600 text-white' :
            rank === 2 ? 'bg-slate-700 text-white' :
            rank === 3 ? 'bg-amber-500 text-white' :
            'bg-slate-100 text-slate-600'
          }`}>
            <span className="text-[10px] sm:text-xs leading-none opacity-70">#{rank}</span>
          </div>

          {/* College info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-2 mb-1.5">
              <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight flex-1 min-w-0">{college.name}</h3>
              <span className={`shrink-0 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full border ${fit.bg} ${fit.color} ${fit.border}`}>
                {fit.label}
              </span>
            </div>

            {/* Fit score bar */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{college.fitScore}</span>
              <span className="text-xs text-slate-400 font-medium">/100</span>
              <div className="flex-1">
                <ScoreBar value={college.fitScore} color={
                  college.fitScore >= 80 ? 'bg-emerald-500' :
                  college.fitScore >= 65 ? 'bg-blue-500' :
                  college.fitScore >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                } />
              </div>
            </div>

            {/* Key stats row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className={`text-xs font-bold ${probColor}`}>{probLabel}</span>
              <span className="text-xs text-slate-500">Score: {college.score}</span>
              <span className="text-xs text-slate-500">Cutoff: {college.cutoff ?? 'N/A'}</span>
              <span className="text-xs text-slate-500">Fee: {formatFee(college.fee)}</span>
              <span className="text-xs text-slate-500">Seats: {college.seats ?? 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Score breakdown (mini bars) */}
        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Admission</span><span className="font-bold text-slate-600">{college.admissionFit}</span>
            </div>
            <ScoreBar value={college.admissionFit} color="bg-indigo-400" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Financial</span><span className="font-bold text-slate-600">{college.financialFit}</span>
            </div>
            <ScoreBar value={college.financialFit} color="bg-teal-400" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Cutoff</span><span className="font-bold text-slate-600">{college.cutoffFit}</span>
            </div>
            <ScoreBar value={college.cutoffFit} color="bg-violet-400" />
          </div>
        </div>
      </div>

      {/* Why / Actions */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col gap-3">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          Why rank #{rank}?
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {expanded && (
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-100">
            {reasons.map((r, i) => <WhyBadge key={i} ok={r.ok} text={r.text} />)}
            <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200">
              Fit Score = 40% Admission + 30% Financial + 30% Cutoff Fit (mode: {RANKING_MODES[mode]?.label})
            </p>
          </div>
        )}

        <button
          disabled={alreadyAdded}
          onClick={() => onAddToList(college)}
          className={`w-full py-2 rounded-xl text-sm font-bold transition-colors ${
            alreadyAdded
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {alreadyAdded ? '✓ Added to Choice List' : '+ Add to Choice List'}
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({ college, position, total, hasRisk, onUp, onDown, onRemove }) {
  const fit = getFitLabel(college.fitScore ?? 0);
  return (
    <div className={`rounded-xl border overflow-hidden ${hasRisk ? 'border-amber-300 bg-amber-50/60' : 'bg-white border-slate-200'}`}>
      {hasRisk && (
        <div className="flex items-start gap-2 px-4 pt-3 pb-2 text-xs text-amber-800 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
          <span>Ordering Risk — a more competitive college (higher cutoff) is placed below this position.</span>
        </div>
      )}
      <div className="flex items-center gap-3 p-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
          position === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
        }`}>{position}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-snug mb-0.5 truncate">{college.name}</p>
          <p className="text-[11px] text-slate-400">
            Cutoff: {college.cutoff ?? 'N/A'} · Fee: {formatFee(college.fee)} · Fit: {college.fitScore ?? '?'}/100
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${fit.bg} ${fit.color} ${fit.border}`}>
          {fit.label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onUp}   disabled={position === 1}     className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ArrowUp   className="w-4 h-4" /></button>
          <button onClick={onDown} disabled={position === total}  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ArrowDown className="w-4 h-4" /></button>
          <button onClick={onRemove}                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600  hover:bg-rose-50  transition-colors"><X         className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function CollegeRanking() {
  const { profile } = useUser();
  const { collegeData: colleges, loading } = useCollegeData();

  // ── Profile-synced What-If inputs (hydration on auth change, then editable) ──
  const [score,    setScore]    = useState(() => profile?.userScore ? Number(profile.userScore) : 0);
  const [category, setCategory] = useState(() => profile?.category ?? 'open');
  const [gender,   setGender]   = useState(() => profile?.gender   ?? 'any');
  const [budget,   setBudget]   = useState(() => profile?.annualBudget ? Number(profile.annualBudget) : 1500000);
  
  // Identity-aware profile sync
  const [hydratedUserId, setHydratedUserId] = useState(() => profile?.isRegistered ? profile.phone : null);

  useEffect(() => {
    const currentAuth = profile?.isRegistered ? profile.phone : null;
    
    if (currentAuth !== hydratedUserId) {
      if (currentAuth) {
        setScore(profile.userScore ? Number(profile.userScore) : 0);
        setCategory(profile.category ?? 'open');
        setGender(profile.gender ?? 'any');
        setBudget(profile.annualBudget ? Number(profile.annualBudget) : 1500000);
      } else {
        setScore(0);
        setCategory('open');
        setGender('any');
        setBudget(1500000);
      }
      setHydratedUserId(currentAuth);
    }
  }, [profile?.isRegistered, profile?.phone, profile?.userScore, profile?.category, profile?.gender, profile?.annualBudget, hydratedUserId]);

  // ── Page state ──────────────────────────────────────────────────────
  const [mode,        setMode]        = useState('overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [choiceList,  setChoiceList]  = useState(loadChoiceList);
  const [toast,       setToast]       = useState(null);
  const [activeTab,   setActiveTab]   = useState('ranking'); // 'ranking' | 'choiceList'

  // ── Core ranking pipeline ───────────────────────────────────────────
  //
  // BUDGET IS A HARD ELIGIBILITY FILTER — applied BEFORE scoring and search.
  // Colleges with fee > budget or no fee data are excluded from `ranked` entirely.
  // Search operates ONLY on the already budget-eligible ranked set.
  //
  const { ranked, totalColleges, excludedCount } = useMemo(() => {
    if (!colleges.length) return { ranked: [], totalColleges: 0, excludedCount: 0 };
    const effectiveGender = gender === 'any' ? 'male' : gender;

    // Step 1: Compute fee for every college first
    const withFees = colleges.map(c => ({
      raw: c,
      fee: calcFee(c.fees, category, effectiveGender),
    }));

    // Step 2: HARD budget eligibility filter
    //   fee == null  → excluded (unknown fee; safer to exclude than to assume affordable)
    //   fee > budget → excluded (over budget)
    //   fee <= budget → eligible
    const excluded = withFees.filter(({ fee }) => fee == null || fee > budget);
    const eligible  = withFees.filter(({ fee }) => fee != null && fee <= budget);

    // Step 3–5: Enrich only eligible colleges with prob + fit scores
    const enriched = eligible.map(({ raw: c, fee }) => {
      const cutoff        = c.cutoffs?.[DEFAULT_YEAR]?.[category] ?? null;
      const { prob: probRaw } = calcProb(score, cutoff, { canAfford: true });
      const prob          = mapProb(probRaw, score, cutoff);
      const admissionFit  = calcAdmissionFit(prob);
      const financialFit  = calcFinancialFit(fee, budget);
      const cutoffFit     = calcCutoffFit(score, cutoff, mode);
      const fitScore      = calcFitScore(admissionFit, financialFit, cutoffFit, mode);

      return {
        id: c.code, code: c.code, name: c.name, seats: c.seats,
        cutoff, fee, prob, admissionFit, financialFit, cutoffFit, fitScore,
        score, category,
        _budget: budget,
        overBudget: false, // all colleges here are within budget by construction
      };
    });

    // Step 6: Sort by fitScore desc; tiebreak by cutoff proximity
    const sorted = [...enriched].sort((a, b) => {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      const gapA = a.cutoff ? Math.abs(a.score - a.cutoff) : 9999;
      const gapB = b.cutoff ? Math.abs(b.score - b.cutoff) : 9999;
      return gapA - gapB;
    });

    return { ranked: sorted, totalColleges: colleges.length, excludedCount: excluded.length };
  }, [colleges, score, category, gender, budget, mode]);

  // Step 6: search applied LAST on already-ranked set
  const displayed = useMemo(() => {
    if (!searchQuery.trim()) return ranked;
    const q = searchQuery.trim().toLowerCase();
    return ranked.filter(c => c.name.toLowerCase().includes(q));
  }, [ranked, searchQuery]);

  // ── Summary stats (based on budget-eligible set only) ──────────────
  const summary = useMemo(() => {
    const bestStrong = ranked.filter(c => c.fitScore >= 65).length;
    const reach      = ranked.filter(c => c.fitScore >= 45 && c.fitScore < 65).length;
    const lowFit     = ranked.filter(c => c.fitScore <  45).length;
    return {
      total: totalColleges,       // all colleges in DB
      eligible: ranked.length,   // those within budget
      excluded: excludedCount,   // over-budget or no fee data
      bestStrong, reach, lowFit,
      top: ranked[0] ?? null,
    };
  }, [ranked, totalColleges, excludedCount]);

  // ── Choice list operations ──────────────────────────────────────────
  const addedIds = useMemo(() => new Set(choiceList.map(c => c.id)), [choiceList]);

  const addToChoiceList = useCallback((college) => {
    if (addedIds.has(college.id)) return;
    const updated = [...choiceList, college];
    setChoiceList(updated);
    saveChoiceList(updated);
    setToast(`${college.name} added to choice list!`);
  }, [addedIds, choiceList]);

  const removeFromList = useCallback((id) => {
    const updated = choiceList.filter(c => c.id !== id);
    setChoiceList(updated);
    saveChoiceList(updated);
  }, [choiceList]);

  const moveUp   = useCallback((idx) => { if (idx === 0) return; setChoiceList(prev => { const n = [...prev]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; saveChoiceList(n); return n; }); }, []);
  const moveDown = useCallback((idx) => { setChoiceList(prev => { if (idx >= prev.length-1) return prev; const n = [...prev]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; saveChoiceList(n); return n; }); }, []);
  const clearAll = useCallback(() => { setChoiceList([]); saveChoiceList([]); }, []);
  const saveList = useCallback(() => { saveChoiceList(choiceList); setToast('Choice list saved!'); }, [choiceList]);

  // ── Ordering risk ───────────────────────────────────────────────────
  const riskFlags = useMemo(() =>
    choiceList.map((c, idx) => {
      if (idx === choiceList.length - 1) return false;
      const cur  = c.cutoff;
      const next = choiceList[idx + 1].cutoff;
      return cur != null && next != null && next > cur;
    }),
  [choiceList]);
  const riskCount = riskFlags.filter(Boolean).length;

  // ── Budget helpers ──────────────────────────────────────────────────
  const BUDGET_OPTIONS = [500000, 800000, 1000000, 1200000, 1500000, 2000000, 2500000, 3000000, 5000000];

  return (
    <div className="min-h-full max-w-[1280px] mx-auto px-4 md:px-6 py-6 sm:py-8 w-full">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">AI College Ranking</h1>
            <p className="text-xs sm:text-sm text-slate-500">Personalized ranking based on your score, budget, and admission probability</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 ml-12">
          Fit Score = 40% Admission Probability + 30% Financial Fit + 30% Cutoff Alignment. Deterministic — based on real Supabase data only.
        </p>
      </div>

      {/* ── Two-column grid on desktop ───────────────────────── */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">

        {/* LEFT COLUMN: Profile + Controls */}
        <div className="space-y-4">

          {/* Your Profile / What-If card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900">Your Profile</h2>
              <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">What-If</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">Changing values here recalculates instantly. Your saved profile is not affected.</p>

            {/* NEET Score */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">NEET Score</label>
              <input
                type="number" min="0" max="720" value={score}
                onChange={e => setScore(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Category + Gender */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <div className="relative">
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.value.toUpperCase()}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gender</label>
                <div className="flex gap-1">
                  {GENDERS.filter(g => g.value !== 'any').map(g => (
                    <button key={g.value} onClick={() => setGender(g.value)}
                      className={`flex-1 text-[11px] font-bold py-2 rounded-lg border transition-all ${
                        gender === g.value || (gender === 'any' && g.value === 'male')
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}>{g.label.charAt(0)}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Annual Budget */}
            <div className="mb-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Annual Budget: <span className="text-indigo-700">{formatBudget(budget)}</span>
              </label>
              <select value={budget} onChange={e => setBudget(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {BUDGET_OPTIONS.map(b => (
                  <option key={b} value={b}>₹{(b / 100000).toFixed(0)}L / year</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ranking Mode */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="text-sm font-black text-slate-900 mb-3">Ranking Mode</h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(RANKING_MODES).map(([key, m]) => {
                const Icon = m.icon;
                return (
                  <button key={key} onClick={() => setMode(key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      mode === key
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-left leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              {mode === 'overall'  && 'Balanced: 40% Admission + 30% Financial + 30% Cutoff'}
              {mode === 'safest'   && 'Safety-first: 70% Admission + 20% Financial + 10% Cutoff'}
              {mode === 'value'    && 'Budget-first: 30% Admission + 50% Financial + 20% Cutoff'}
              {mode === 'reach'    && 'Ambitious: 20% Admission + 20% Financial + 60% Cutoff (narrower gap ranked higher)'}
            </p>
          </div>

          {/* Summary */}
          {!loading && summary.eligible > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <h2 className="text-sm font-black text-slate-900 mb-3">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Within Your Budget</span>
                  <span className="font-black text-slate-900">{summary.eligible}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600 text-xs font-bold">● Best / Strong Fit</span>
                  <span className="font-black text-slate-900">{summary.bestStrong}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-600 text-xs font-bold">● Reach</span>
                  <span className="font-black text-slate-900">{summary.reach}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-500 text-xs font-bold">● Low Fit</span>
                  <span className="font-black text-slate-900">{summary.lowFit}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 mt-1">
                  <span className="text-slate-400 text-xs">Excluded (over budget)</span>
                  <span className="font-bold text-slate-400">{summary.excluded}</span>
                </div>
              </div>

              {summary.top && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Your #1 Recommendation</p>
                  <p className="font-black text-slate-900 text-sm leading-tight">{summary.top.name}</p>
                  <p className="text-indigo-600 font-bold text-xs mt-0.5">{summary.top.fitScore}/100 Fit Score</p>
                </div>
              )}
            </div>
          )}

          {/* Choice List Summary (desktop) */}
          {choiceList.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black text-slate-900">Choice List ({choiceList.length})</h2>
                {riskCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                    {riskCount} Risk{riskCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button onClick={() => setActiveTab('choiceList')}
                className="w-full text-xs text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-left">
                View & manage →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Rankings + Choice List */}
        <div className="min-w-0">
          {/* Tab switcher */}
          <div className="flex gap-2 mb-5">
            <button onClick={() => setActiveTab('ranking')}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                activeTab === 'ranking' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}>
              🏆 Rankings ({displayed.length})
            </button>
            <button onClick={() => setActiveTab('choiceList')}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all relative ${
                activeTab === 'choiceList' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}>
              📋 Choice List ({choiceList.length})
              {riskCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{riskCount}</span>}
            </button>
          </div>

          {/* ── RANKINGS TAB ── */}
          {activeTab === 'ranking' && (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search within ranked colleges..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {searchQuery && (
                <p className="text-xs text-slate-500 mb-3">
                  Showing {displayed.length} result{displayed.length !== 1 ? 's' : ''} for "{searchQuery}" — filtered within {ranked.length} ranked colleges
                </p>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm font-medium">Loading colleges from Supabase…</p>
                </div>
              )}

              {/* No results */}
              {!loading && displayed.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl text-center">
                  <Search className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="font-bold text-slate-400 mb-1">No colleges found</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    {searchQuery ? `No match for "${searchQuery}" in the current ranked set.` : 'No college data available from Supabase.'}
                  </p>
                </div>
              )}

              {/* Ranked cards */}
              {!loading && displayed.length > 0 && (
                <div className="space-y-4">
                  {displayed.map((college, idx) => (
                    <RankCard
                      key={college.id}
                      college={college}
                      rank={searchQuery ? ranked.indexOf(college) + 1 : idx + 1}
                      mode={mode}
                      onAddToList={addToChoiceList}
                      alreadyAdded={addedIds.has(college.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── CHOICE LIST TAB ── */}
          {activeTab === 'choiceList' && (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-base font-black text-slate-900">Your Choice List</h2>
                {choiceList.length > 0 && (
                  <>
                    <button onClick={saveList}  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"><Save    className="w-3.5 h-3.5" /> Save</button>
                    <button onClick={clearAll}  className="flex items-center gap-1.5 text-rose-600 text-xs font-bold px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors"><Trash2  className="w-3.5 h-3.5" /> Clear All</button>
                  </>
                )}
              </div>

              {choiceList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl text-center">
                  <Award className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="font-bold text-slate-400 mb-1">Your choice list is empty</p>
                  <p className="text-xs text-slate-400 max-w-xs mb-3">Go to Rankings and click "+ Add to Choice List" on the colleges you want.</p>
                  <button onClick={() => setActiveTab('ranking')} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">View Rankings →</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {choiceList.map((college, idx) => (
                    <ChoiceCard
                      key={college.id} college={college}
                      position={idx + 1} total={choiceList.length}
                      hasRisk={riskFlags[idx]}
                      onUp={() => moveUp(idx)} onDown={() => moveDown(idx)}
                      onRemove={() => removeFromList(college.id)}
                    />
                  ))}
                  <p className="mt-4 text-[11px] text-slate-400 text-center">
                    💾 Choice list is saved to your browser's local storage.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
