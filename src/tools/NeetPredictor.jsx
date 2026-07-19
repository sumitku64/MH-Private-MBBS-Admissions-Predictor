import { useState, useMemo, useEffect } from 'react';
import { CATEGORIES, GENDERS, MEDICAL_QUOTES } from '../data';
import { useCollegeData } from '../lib/useCollegeData';
import { useUser } from '../context/UserContext';
import LeadCaptureModal from '../components/LeadCaptureModal';

const SAFETY_MARGIN = 0.08;
const BUDGET_CAP    = 1000000;
const MGMT_MARGIN   = 100; // management quota historically closes ~60–100 marks below state-quota cutoff

function getProb(score, cutoff, canAfford) {
  if (!cutoff) return { prob: 'low', viaMgmt: false };
  if (score >= cutoff) return { prob: 'high', viaMgmt: false };
  if (score >= Math.round(cutoff * (1 - SAFETY_MARGIN))) {
    return canAfford ? { prob: 'high', viaMgmt: true } : { prob: 'borderline', viaMgmt: false };
  }
  if (canAfford && score >= cutoff - MGMT_MARGIN) return { prob: 'borderline', viaMgmt: true };
  return { prob: 'low', viaMgmt: false };
}

function getFee(fees, cat, gender) {
  if (cat === 'sc' || cat === 'st') return fees.sc_st;
  if (cat === 'vjnt') return fees.vjnt_sbc;
  if ((cat === 'obc' || cat === 'sebc') && gender === 'female') return fees.obc_ebc_sebc_female;
  if (cat === 'obc' || cat === 'sebc') return fees.obc_ebc_sebc_male;
  return fees.open;
}

const PC = {
  high: {
    label: 'High Probability',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    topBar: 'bg-emerald-500',
    bar: 'from-emerald-400 to-teal-400',
    shadow: 'hover:shadow-emerald-100/80',
    statBg: 'bg-emerald-50 border-emerald-200',
    statText: 'text-emerald-700',
    filter: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  borderline: {
    label: 'Borderline',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    topBar: 'bg-amber-500',
    bar: 'from-amber-400 to-orange-400',
    shadow: 'hover:shadow-amber-100/80',
    statBg: 'bg-amber-50 border-amber-200',
    statText: 'text-amber-700',
    filter: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  low: {
    label: 'Low Chance',
    badge: 'bg-rose-100 text-rose-700 border border-rose-200',
    topBar: 'bg-rose-400',
    bar: 'from-rose-300 to-rose-400',
    shadow: 'hover:shadow-rose-100/80',
    statBg: 'bg-rose-50 border-rose-200',
    statText: 'text-rose-700',
    filter: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

const fmtL  = n => n ? `₹${(n / 100000).toFixed(1)}L` : 'N/A';
const fmtIN = n => n ? `₹${n.toLocaleString('en-IN')}` : 'N/A';

// ─── Sub-components ────────────────────────────────────────────────────────────

function SliderRow({ label, min, max, step, value, onChange, display }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        <span className="text-sm font-black text-indigo-600">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600 h-1.5"
      />
    </div>
  );
}

function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
            value === o.value
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, filterKey, active, onFilter, colorCls }) {
  return (
    <button
      onClick={() => onFilter(filterKey)}
      className={[
        'rounded-xl border p-3.5 text-left transition-all',
        active
          ? `${colorCls.statBg} border-transparent shadow-md scale-[1.02]`
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm',
      ].join(' ')}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${active ? colorCls.statText : 'text-slate-400'}`}>
        {icon} {label}
      </p>
      <p className={`text-2xl font-black ${active ? colorCls.statText : 'text-slate-900'}`}>{value}</p>
    </button>
  );
}

function CollegeCard({ college, score, quoteIdx }) {
  const { name, code, seats, cutoffs, fee, cutoff, prob, viaMgmt, hasConcession, isBudget } = college;
  const p   = PC[prob];
  const pct = cutoff ? Math.min(100, Math.round((score / cutoff) * 100)) : 0;
  const { quote } = MEDICAL_QUOTES[quoteIdx % MEDICAL_QUOTES.length];
  const prev = cutoffs[2023]?.[college._cat];

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${p.shadow} hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden`}>
      <div className={`h-1 ${p.topBar}`} />

      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-[13px] leading-snug">{name}</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">Code {code} · {seats} seats</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 border ${p.badge}`}>
            {p.label}
          </span>
        </div>

        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Your score: <strong className="text-slate-700">{score}</strong></span>
            <span>Cutoff: <strong className="text-slate-700">{cutoff ?? 'N/A'}</strong></span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${p.bar} transition-all duration-700`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-slate-400 mt-0.5">{pct}% of cutoff</p>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-800">{fmtIN(fee)}<span className="font-normal text-slate-500">/yr</span></span>
        {viaMgmt && (
          <span className="text-[9.5px] bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold">Mgmt Quota Route</span>
        )}
        {hasConcession && (
          <span className="text-[9.5px] bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full font-bold">♀ Concession</span>
        )}
        {isBudget && (
          <span className="text-[9.5px] bg-teal-100 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-full font-bold">Budget-Friendly</span>
        )}
        {prev && (
          <span className="ml-auto text-[10px] text-slate-400">2023: {prev}</span>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 italic leading-relaxed">"{quote}"</p>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'all',        label: 'All',       activeCls: 'bg-indigo-600 text-white border-indigo-600' },
  { value: 'high',       label: '✓ High',    activeCls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'borderline', label: '~ Border',  activeCls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'low',        label: '✗ Low',     activeCls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'budget',     label: '₹ Budget',  activeCls: 'bg-teal-100 text-teal-700 border-teal-200' },
];

const SORT_OPTIONS = [
  { value: 'probability', label: 'Probability' },
  { value: 'cutoff',      label: 'Cutoff' },
  { value: 'fees_asc',    label: 'Fees ↑' },
];

const PROB_ORDER = { high: 0, borderline: 1, low: 2 };

export default function NeetPredictor() {
  const [score,     setScore]     = useState(550);
  const [category,  setCategory]  = useState('open');
  const [gender,    setGender]    = useState('male');
  const [budget,    setBudget]    = useState(1500000);
  const [year,      setYear]      = useState(2024);
  const [filterKey, setFilterKey] = useState('all');
  const [sortBy,    setSortBy]    = useState('probability');
  const [quoteOff,  setQuoteOff]  = useState(0);
  const { collegeData: colleges } = useCollegeData();
  const { profile }               = useUser();
  const [showModal,  setShowModal]  = useState(false);

  useEffect(() => {
    const t = setInterval(() => setQuoteOff(p => (p + 1) % MEDICAL_QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);


  function handleSaveShortlist() {
    if (!profile.isRegistered) { setShowModal(true); return; }
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName:  profile.userName,
        phone:     profile.phone,
        userScore: score,
        tool:      'neet-predictor',
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  const processed = useMemo(() => colleges.map(c => {
    const cutoff        = c.cutoffs[year]?.[category] ?? null;
    const fee           = getFee(c.fees, category, gender);
    const canAfford     = fee != null && fee <= budget;
    const { prob, viaMgmt } = getProb(score, cutoff, canAfford);
    const hasConcession = gender === 'female' && (category === 'obc' || category === 'sebc');
    const isBudget      = fee != null && fee <= BUDGET_CAP;
    return { ...c, cutoff, fee, prob, viaMgmt, hasConcession, isBudget, _cat: category };
  }), [colleges, score, category, gender, year, budget]);

  const stats = useMemo(() => ({
    total:      processed.length,
    high:       processed.filter(c => c.prob === 'high').length,
    borderline: processed.filter(c => c.prob === 'borderline').length,
    budget:     processed.filter(c => c.isBudget).length,
  }), [processed]);

  const results = useMemo(() => {
    let list = [...processed];
    if (filterKey === 'high')            list = list.filter(c => c.prob === 'high');
    else if (filterKey === 'borderline') list = list.filter(c => c.prob === 'borderline');
    else if (filterKey === 'low')        list = list.filter(c => c.prob === 'low');
    else if (filterKey === 'budget')     list = list.filter(c => c.fee && c.fee <= budget);

    if (sortBy === 'probability')      list.sort((a, b) => PROB_ORDER[a.prob] - PROB_ORDER[b.prob] || (b.cutoff ?? 0) - (a.cutoff ?? 0));
    else if (sortBy === 'cutoff')      list.sort((a, b) => (a.cutoff ?? 9999) - (b.cutoff ?? 9999));
    else if (sortBy === 'fees_asc')    list.sort((a, b) => (a.fee ?? Infinity) - (b.fee ?? Infinity));
    return list;
  }, [processed, filterKey, sortBy, budget]);

  const CAT_OPTIONS    = CATEGORIES.map(c => ({ value: c.value, label: c.value.toUpperCase() }));
  const GENDER_OPTIONS = GENDERS.map(g => ({ value: g.value, label: g.label }));

  return (
    <>
      {showModal && (
        <LeadCaptureModal
          onClose={() => setShowModal(false)}
          toolId="neet-predictor"
          scoreHint={score}
        />
      )}

      <div className="flex flex-col md:flex-row h-full">
        {/* ── Left control panel ── */}
        <div className="w-full md:w-72 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-96 md:max-h-none">
          <div className="p-5 space-y-6">
            <div>
              <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">NEET Predictor</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">23 MH private colleges · 2022–2024 data</p>
            </div>

            <SliderRow label="NEET Score" min={100} max={720} step={1} value={score} onChange={setScore} display={score} />

            {/* MeritChain sync hook — Platform Zero integration (Section 09) */}
            <button
              disabled
              title="MeritChain score import — Platform Zero integration (coming soon)"
              className="w-full text-[10px] text-slate-400 border border-dashed border-slate-200 rounded-lg py-1.5 flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <span>⛓</span>
              Import from MeritChain
              <span className="ml-auto bg-slate-100 text-slate-400 text-[9px] px-1.5 py-0.5 rounded-full">Coming Soon</span>
            </button>

            <SliderRow label="Max Budget / Year" min={500000} max={3000000} step={50000} value={budget} onChange={setBudget} display={fmtL(budget)} />

            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Category</p>
              <PillGroup options={CAT_OPTIONS} value={category} onChange={setCategory} />
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</p>
              <PillGroup options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cutoff Year</p>
              <div className="flex gap-1.5">
                {[2024, 2023, 2022].map(y => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={[
                      'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all',
                      year === y ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {gender === 'female' && (category === 'obc' || category === 'sebc') && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <p className="text-[11px] font-bold text-violet-700 mb-0.5">♀ Smart Fee Engine Active</p>
                <p className="text-[10px] text-violet-600 leading-relaxed">
                  Female {category.toUpperCase()} concession rates applied automatically across all colleges.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Safety margin: 8% below cutoff shown as Borderline. Data: MH CET Cell official 2022–2024.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right results panel ── */}
        <div className="flex-1 overflow-auto bg-slate-50 flex flex-col">
          {/* Stat cards */}
          <div className="bg-white border-b border-slate-200 p-4 shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total" value={stats.total} icon="🏥" filterKey="all" active={filterKey === 'all'}
                onFilter={setFilterKey} colorCls={{ statBg: 'bg-indigo-50 border-indigo-200', statText: 'text-indigo-700' }} />
              <StatCard label="High" value={stats.high} icon="✓" filterKey="high" active={filterKey === 'high'}
                onFilter={setFilterKey} colorCls={PC.high} />
              <StatCard label="Borderline" value={stats.borderline} icon="~" filterKey="borderline" active={filterKey === 'borderline'}
                onFilter={setFilterKey} colorCls={PC.borderline} />
              <StatCard label="Budget" value={stats.budget} icon="₹" filterKey="budget" active={filterKey === 'budget'}
                onFilter={setFilterKey} colorCls={{ statBg: 'bg-teal-50 border-teal-200', statText: 'text-teal-700' }} />
            </div>
          </div>

          {/* Filter + sort bar */}
          <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-2 shrink-0">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilterKey(f.value)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  filterKey === f.value
                    ? f.activeCls
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">Sort:</span>
              {SORT_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    sortBy === s.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={handleSaveShortlist}
                className={[
                  'ml-2 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors',
                  profile.isRegistered
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white',
                ].join(' ')}
              >
                {profile.isRegistered ? '✓ Shortlist Saved' : '💾 Save Shortlist'}
              </button>
            </div>
          </div>

          {/* College grid */}
          <div className="flex-1 p-4">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <p className="text-slate-400 text-sm">No colleges match the current filters.</p>
                <button onClick={() => setFilterKey('all')} className="text-indigo-600 text-sm font-semibold hover:underline">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {results.map((college, i) => (
                  <CollegeCard
                    key={college.code}
                    college={college}
                    score={score}
                    quoteIdx={quoteOff + i}
                  />
                ))}
              </div>
            )}
            <p className="text-center text-[11px] text-slate-400 mt-6 pb-2">
              Showing {results.length} of {processed.length} colleges · Official MH CET Cell data 2022–2024
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
