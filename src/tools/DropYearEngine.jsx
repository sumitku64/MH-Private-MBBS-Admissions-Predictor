import { useState, useMemo } from 'react';

const CATEGORIES = [
  { value: 'open', label: 'Open / General' },
  { value: 'obc',  label: 'OBC' },
  { value: 'sebc', label: 'SEBC (Maratha)' },
  { value: 'vjnt', label: 'VJNT / NT / SBC' },
  { value: 'sc',   label: 'SC' },
  { value: 'st',   label: 'ST' },
  { value: 'ews',  label: 'EWS' },
];

// MH approximate government MBBS cutoffs (AIQ + decent state govt college)
const GOVT_CUTOFFS = {
  open: 610, obc: 575, sebc: 560, vjnt: 540, sc: 480, st: 430, ews: 590,
};

// Private college tiers with per-year fee ranges and minimum qualifying scores by category
const TIERS = [
  {
    id: 'top',
    label: 'Top-Tier Private',
    desc: 'Sion, Nair, BJ Medical, Grant',
    feeMin: 1200000,
    feeMax: 2000000,
    minScore: { open: 570, obc: 530, sebc: 515, vjnt: 500, sc: 445, st: 385, ews: 550 },
  },
  {
    id: 'mid',
    label: 'Mid-Tier Private',
    desc: 'KJ Somaiya, MGM, DY Patil, BJMC Pune',
    feeMin: 800000,
    feeMax: 1200000,
    minScore: { open: 510, obc: 470, sebc: 455, vjnt: 440, sc: 385, st: 320, ews: 490 },
  },
  {
    id: 'lower',
    label: 'Lower-Tier Private',
    desc: 'Remaining approved private colleges',
    feeMin: 500000,
    feeMax: 800000,
    minScore: { open: 440, obc: 400, sebc: 385, vjnt: 365, sc: 305, st: 250, ews: 420 },
  },
  {
    id: 'management',
    label: 'Management Quota',
    desc: 'Direct admission, any college',
    feeMin: 1800000,
    feeMax: 3000000,
    minScore: { open: 350, obc: 350, sebc: 350, vjnt: 350, sc: 350, st: 350, ews: 350 },
  },
];

// Score improvement projections per attempt
const IMPROVEMENT = {
  '1st':  { min: 20,  avg: 45, max: 75, note: 'First-time droppers typically see the biggest jump.' },
  '2nd':  { min: 5,   avg: 22, max: 45, note: 'Diminishing returns — focus on specific weak topics.' },
  '3rd+': { min: -10, avg: 8,  max: 25, note: 'Score plateaus after 3 attempts. Risk is high.' },
};

const LOAN_RATE   = 8.5;   // annual %
const LOAN_MONTHS = 120;   // 10 years

function calcEMI(principal) {
  if (principal <= 0) return 0;
  const r = LOAN_RATE / 100 / 12;
  return Math.round(principal * r * Math.pow(1 + r, LOAN_MONTHS) / (Math.pow(1 + r, LOAN_MONTHS) - 1));
}

function fmtL(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${(n / 1000).toFixed(0)}K`;
}

function fmtEMI(n) {
  return `₹${n.toLocaleString('en-IN')}/mo`;
}

function Row({ label, value, valueClass = 'text-slate-700' }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function DropYearEngine() {
  const [score,      setScore]      = useState('');
  const [category,   setCategory]   = useState('open');
  const [attempt,    setAttempt]    = useState('1st');
  const [targetTier, setTargetTier] = useState('mid');
  const [budget,     setBudget]     = useState(10);   // ₹L per year
  const [submitted,  setSubmitted]  = useState(false);

  const ready = score !== '' && !isNaN(parseInt(score)) && parseInt(score) >= 200 && parseInt(score) <= 720;

  const analysis = useMemo(() => {
    if (!submitted) return null;
    const sc = parseInt(score);
    if (isNaN(sc) || sc < 200 || sc > 720) return null;

    const govtCutoff    = GOVT_CUTOFFS[category] ?? GOVT_CUTOFFS.open;
    const imp           = IMPROVEMENT[attempt];
    const gapToGovt     = govtCutoff - sc;
    const currentYear   = new Date().getFullYear();

    // Drop year score projections
    const projMin = sc + imp.min;
    const projAvg = sc + imp.avg;
    const projMax = sc + imp.max;

    // Govt college probability
    const govtProb =
      projAvg >= govtCutoff + 25  ? { label: 'High',         cls: 'bg-emerald-100 text-emerald-700' } :
      projAvg >= govtCutoff        ? { label: 'Moderate',     cls: 'bg-amber-100 text-amber-700' }    :
      projAvg >= govtCutoff - 20   ? { label: 'Low–Moderate', cls: 'bg-amber-100 text-amber-700' }    :
                                     { label: 'Low',          cls: 'bg-rose-100 text-rose-700' };

    // Which tiers the student qualifies for NOW
    const accessible = TIERS.filter(t => sc >= (t.minScore[category] ?? 9999));

    // Chosen target tier (for Path B fee calculation)
    const target   = TIERS.find(t => t.id === targetTier) ?? TIERS[1];
    const canHitTarget = accessible.some(t => t.id === target.id);
    const useTier  = canHitTarget ? target : accessible[0] ?? null;

    // 4.5-year fee totals
    const feeMin = useTier ? useTier.feeMin * 4.5 : 0;
    const feeMax = useTier ? useTier.feeMax * 4.5 : 0;

    // Budget covers portion
    const budgetTotal = budget * 100000 * 4.5;          // family budget over 4.5 years

    // Loan = fees − budget (floored at 0)
    const loanMin = Math.max(0, feeMin - budgetTotal);
    const loanMax = Math.max(0, feeMax - budgetTotal);

    // EMI
    const emiMin = calcEMI(loanMin);
    const emiMax = calcEMI(loanMax);

    // Total repayment and interest
    const repayMin = emiMin * LOAN_MONTHS;
    const repayMax = emiMax * LOAN_MONTHS;
    const intMin   = repayMin - loanMin;
    const intMax   = repayMax - loanMax;

    // Timeline (from now)
    const MBBS_YEARS      = 4.5;
    const INTERN_YEARS    = 1;
    const careerStart     = Math.ceil(currentYear + MBBS_YEARS + INTERN_YEARS);      // Path B
    const loanRepaid      = loanMax > 0 ? careerStart + 10 : careerStart;
    const dropCareerStart = Math.ceil(currentYear + 1 + MBBS_YEARS + INTERN_YEARS);  // Path A (1 gap yr)
    const dropBreakEven   = loanMax > 0 ? dropCareerStart + 10 : dropCareerStart + 1;

    // Recommendation logic
    let rec, recLevel;
    if (attempt === '3rd+') {
      rec = 'Private MBBS Now'; recLevel = 'Strongly Recommended';
    } else if (gapToGovt <= 0) {
      rec = 'Drop Year'; recLevel = 'Strongly Recommended';
    } else if (gapToGovt <= 35 && attempt === '1st') {
      rec = 'Drop Year'; recLevel = 'Strongly Recommended';
    } else if (gapToGovt <= 55) {
      rec = 'Drop Year'; recLevel = 'Recommended';
    } else if (gapToGovt <= 90 && attempt === '1st') {
      rec = 'Discuss with Counsellor'; recLevel = 'Borderline Case';
    } else {
      rec = 'Private MBBS Now';
      recLevel = budget * 100000 >= (useTier?.feeMin ?? 999999) ? 'Recommended' : 'Consider if budget allows';
    }

    return {
      sc, govtCutoff, gapToGovt, imp,
      projMin, projAvg, projMax, govtProb,
      accessible, useTier, canHitTarget,
      feeMin, feeMax, budgetTotal,
      loanMin, loanMax, emiMin, emiMax,
      repayMin, repayMax, intMin, intMax,
      careerStart, loanRepaid,
      dropCareerStart, dropBreakEven,
      currentYear, rec, recLevel,
    };
  }, [submitted, score, category, attempt, targetTier, budget]);

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* ── Input panel ── */}
      <div className="w-full md:w-80 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-80 md:max-h-none">
        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Drop Year vs. Private MBBS</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Financial &amp; strategic comparison engine</p>
          </div>

          {/* NEET Score */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Current NEET Score <span className="text-slate-300 normal-case font-normal">(200–720)</span>
            </label>
            <input type="number" value={score} min={200} max={720}
              onChange={e => { setScore(e.target.value); setSubmitted(false); }}
              placeholder="e.g. 520"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {score && !ready && (
              <p className="text-[10px] text-rose-500 mt-1">Enter a valid score between 200 and 720.</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Category</label>
            <div className="space-y-1.5">
              {CATEGORIES.map(c => (
                <button key={c.value}
                  onClick={() => { setCategory(c.value); setSubmitted(false); }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                    category === c.value
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Attempt */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Attempt Number</label>
            <div className="flex gap-1.5">
              {['1st', '2nd', '3rd+'].map(a => (
                <button key={a}
                  onClick={() => { setAttempt(a); setSubmitted(false); }}
                  className={[
                    'flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                    attempt === a
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Target College Tier */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Target College Tier</label>
            <div className="space-y-1.5">
              {TIERS.map(t => (
                <button key={t.id}
                  onClick={() => { setTargetTier(t.id); setSubmitted(false); }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-lg border transition-all',
                    targetTier === t.id
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  <p className={`text-xs font-bold ${targetTier === t.id ? 'text-indigo-700' : 'text-slate-700'}`}>{t.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Annual Budget slider */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Annual Family Budget
              <span className="ml-2 text-indigo-600 font-black">₹{budget}L / yr</span>
            </label>
            <input type="range" min={2} max={30} step={1} value={budget}
              onChange={e => { setBudget(parseInt(e.target.value)); setSubmitted(false); }}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>₹2L/yr</span><span>₹30L/yr</span>
            </div>
          </div>

          <button onClick={() => setSubmitted(true)} disabled={!ready}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40">
            Analyse My Options →
          </button>
        </div>
      </div>

      {/* ── Results panel ── */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        {!submitted || !analysis ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl">⚖️</span>
            <h3 className="text-lg font-bold text-slate-700">Drop Year vs. Private MBBS Engine</h3>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Enter your NEET score, category, attempt number, target college tier, and annual budget — get a side-by-side financial and strategic comparison of both paths.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl space-y-5">

            {/* Recommendation banner */}
            {(() => {
              const isDrop = analysis.rec === 'Drop Year';
              const isPriv = analysis.rec === 'Private MBBS Now';
              return (
                <div className={`rounded-xl p-4 border shadow-sm flex items-center gap-4 flex-wrap ${isDrop ? 'bg-emerald-50 border-emerald-200' : isPriv ? 'bg-indigo-50 border-indigo-200' : 'bg-amber-50 border-amber-200'}`}>
                  <span className="text-2xl">{isDrop ? '📚' : isPriv ? '🏥' : '⚖️'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-black text-sm ${isDrop ? 'text-emerald-800' : isPriv ? 'text-indigo-800' : 'text-amber-800'}`}>
                        Recommendation: {analysis.rec}
                      </p>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${isDrop ? 'bg-emerald-200 text-emerald-800' : isPriv ? 'bg-indigo-200 text-indigo-800' : 'bg-amber-200 text-amber-800'}`}>
                        {analysis.recLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Score {analysis.sc} · {category.toUpperCase()} · {attempt} attempt ·
                      Budget ₹{budget}L/yr ·
                      Gap to govt cutoff: {analysis.gapToGovt > 0 ? `${analysis.gapToGovt} marks below` : `${Math.abs(analysis.gapToGovt)} marks above`}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* ── Side-by-side path cards ── */}
            <div className="grid grid-cols-2 gap-4">

              {/* PATH A: Drop Year */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-0.5">Path A</p>
                  <p className="font-black text-base leading-tight">Take a Drop Year</p>
                  <p className="text-[11px] text-emerald-100 mt-0.5">Re-attempt NEET · Target government seat</p>
                </div>
                <div className="p-4 space-y-4">

                  {/* Score projections */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Score Improvement — {attempt} Attempt</p>
                    <div className="bg-emerald-50 rounded-lg p-3 space-y-2">
                      {[
                        ['Conservative', analysis.projMin, analysis.imp.min, false],
                        ['Expected',     analysis.projAvg, analysis.imp.avg, true],
                        ['Best Case',    analysis.projMax, analysis.imp.max, false],
                      ].map(([label, proj, delta, highlight]) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className={`text-[12px] ${highlight ? 'font-black text-emerald-800' : 'text-slate-500'}`}>
                            {label} {delta >= 0 ? '+' : ''}{delta} marks
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[13px] font-black ${highlight ? 'text-emerald-700' : 'text-slate-600'}`}>{proj}</span>
                            {proj >= analysis.govtCutoff && (
                              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">✓ Govt</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 italic leading-relaxed">{analysis.imp.note}</p>
                  </div>

                  {/* Govt probability */}
                  <div className="flex items-center justify-between py-2.5 border-y border-slate-100">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-700">Govt College Probability</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">MH {category.toUpperCase()} cutoff: {analysis.govtCutoff}</p>
                    </div>
                    <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${analysis.govtProb.cls}`}>
                      {analysis.govtProb.label}
                    </span>
                  </div>

                  {/* Gap year cost */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gap Year Cost Estimate</p>
                    <div className="space-y-1.5">
                      <Row label="Coaching + test series"     value="₹1.5L – ₹3L" />
                      <Row label="Study materials / online"   value="₹20K – ₹50K" />
                      <Row label="Living + miscellaneous"     value="₹1.5L – ₹3L" />
                      <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-slate-100">
                        <span className="font-bold text-slate-700">Total gap year cost</span>
                        <span className="font-black text-emerald-700">₹3.5L – ₹6.5L</span>
                      </div>
                    </div>
                  </div>

                  {/* If govt college scenario */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">✓ If You Secure a Govt Seat</p>
                    <div className="space-y-1.5">
                      <Row label="4.5yr tuition total"            value="₹1.5L – ₹3.5L" />
                      <Row label="Education loan needed"          value="None (or minimal)" valueClass="text-emerald-600" />
                      <Row label="Doctor career starts"           value={`~${analysis.dropCareerStart}`} valueClass="text-indigo-700" />
                      <Row label="Financial break-even"           value={`~${analysis.dropBreakEven}`}  valueClass="text-emerald-700" />
                    </div>
                  </div>

                  {/* Risk note */}
                  <div className={`rounded-lg px-3 py-2.5 text-[11px] leading-relaxed ${attempt === '3rd+' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700'}`}>
                    ⚠ Risk: If your score doesn't improve enough, you still end up in a private college — but one year later, with the same loan burden.
                    {attempt === '3rd+' && ' Score gains after 3 attempts are statistically very low.'}
                  </div>
                </div>
              </div>

              {/* PATH B: Private MBBS Now */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-0.5">Path B</p>
                  <p className="font-black text-base leading-tight">Take Private MBBS Now</p>
                  <p className="text-[11px] text-indigo-200 mt-0.5">
                    {analysis.useTier ? `${analysis.useTier.label} · ${analysis.useTier.desc}` : 'Score needs to improve first'}
                  </p>
                </div>

                {analysis.useTier ? (
                  <div className="p-4 space-y-4">

                    {/* Accessible tiers */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">College Tiers You Qualify For (Score: {analysis.sc})</p>
                      <div className="space-y-1">
                        {TIERS.map(t => {
                          const ok = analysis.accessible.some(a => a.id === t.id);
                          const isTgt = t.id === targetTier;
                          return (
                            <div key={t.id}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] ${isTgt && ok ? 'bg-indigo-50' : ''}`}>
                              <span className={ok ? (isTgt ? 'font-bold text-indigo-700' : 'text-slate-600') : 'text-slate-300'}>{t.label}</span>
                              <span className={ok ? (isTgt ? 'text-indigo-600 font-black text-[10px]' : 'text-emerald-600 font-bold text-[11px]') : 'text-slate-300 text-[11px]'}>
                                {ok ? (isTgt ? '← Target ✓' : '✓') : '✗'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {!analysis.canHitTarget && (
                        <p className="text-[10px] text-amber-600 mt-1.5 leading-relaxed">
                          Your target tier requires a higher score. Showing costs for your best accessible tier ({analysis.useTier.label}).
                        </p>
                      )}
                    </div>

                    {/* Fee breakdown */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">4.5-Year Fee Breakdown</p>
                      <div className="space-y-1.5">
                        <Row label="Annual fee range"
                          value={`${fmtL(analysis.useTier.feeMin)} – ${fmtL(analysis.useTier.feeMax)}`} />
                        <Row label="Total 4.5-year fees"
                          value={`${fmtL(analysis.feeMin)} – ${fmtL(analysis.feeMax)}`}
                          valueClass="text-indigo-700" />
                        <Row label={`Your budget covers (₹${budget}L/yr × 4.5yr)`}
                          value={fmtL(analysis.budgetTotal)} />
                        <Row label="Education loan needed"
                          value={analysis.loanMax > 0 ? `${fmtL(analysis.loanMin)} – ${fmtL(analysis.loanMax)}` : 'None — budget covers it!'}
                          valueClass={analysis.loanMax > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                      </div>
                    </div>

                    {/* EMI calculations */}
                    {analysis.loanMax > 0 && (
                      <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-2">Education Loan @ {LOAN_RATE}% — 10 Years</p>
                        <div className="space-y-1.5">
                          <Row label="Loan amount"
                            value={`${fmtL(analysis.loanMin)} – ${fmtL(analysis.loanMax)}`} />
                          <Row label="Monthly EMI"
                            value={`${fmtEMI(analysis.emiMin)} – ${fmtEMI(analysis.emiMax)}`}
                            valueClass="text-rose-700 font-black" />
                          <Row label="Total repayment (10yr)"
                            value={`${fmtL(analysis.repayMin)} – ${fmtL(analysis.repayMax)}`} />
                          <Row label="Total interest paid"
                            value={`${fmtL(analysis.intMin)} – ${fmtL(analysis.intMax)}`}
                            valueClass="text-amber-700" />
                        </div>
                      </div>
                    )}

                    {/* Career timeline */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Career Timeline from Now</p>
                      <div className="space-y-1.5">
                        <Row label="MBBS complete (4.5yr)"         value={`~${analysis.currentYear + 5}`} />
                        <Row label="Internship done · Career starts" value={`~${analysis.careerStart}`} valueClass="text-indigo-700" />
                        <Row label="Loan fully repaid (10yr EMI)"
                          value={analysis.loanMax > 0 ? `~${analysis.loanRepaid}` : 'No loan — debt-free career'}
                          valueClass={analysis.loanMax > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                        <Row label="Financial break-even"
                          value={`~${analysis.loanRepaid}`}
                          valueClass="text-emerald-700" />
                      </div>
                    </div>

                    {budget * 100000 < (analysis.useTier?.feeMin ?? 0) && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 rounded-lg px-3 py-2.5 leading-relaxed border border-rose-100">
                        ⚠ Your budget (₹{budget}L/yr) is below the minimum annual fee (₹{(analysis.useTier.feeMin / 100000).toFixed(0)}L/yr) for this tier. An education loan will be needed for the shortfall.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-sm font-bold text-slate-700 mb-1">Score Below Qualifying Range</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                      At {analysis.sc} marks, you currently don't qualify for any state quota private MBBS seats. A drop year is your primary path forward.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Comparison summary table ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Side-by-Side Comparison Summary</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide w-1/3">Factor</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-emerald-600 uppercase tracking-wide">📚 Path A — Drop Year</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-indigo-600 uppercase tracking-wide">🏥 Path B — Private Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[12px]">
                  {[
                    [
                      'Total investment',
                      '₹3.5L–₹6.5L (if govt seat)',
                      analysis.useTier ? `${fmtL(analysis.repayMin)}–${fmtL(analysis.repayMax)} (inc. interest)` : 'N/A',
                    ],
                    [
                      'Monthly EMI burden',
                      'None (govt seat = no loan)',
                      analysis.loanMax > 0 ? `${fmtEMI(analysis.emiMin)}–${fmtEMI(analysis.emiMax)} for 10 yrs` : 'No loan needed',
                    ],
                    [
                      'Career starts',
                      `~${analysis.dropCareerStart} (1 yr delay)`,
                      `~${analysis.careerStart} (earlier)`,
                    ],
                    [
                      'Financial break-even',
                      `~${analysis.dropBreakEven}`,
                      analysis.useTier ? `~${analysis.loanRepaid}` : '—',
                    ],
                    [
                      'Risk level',
                      attempt === '3rd+' ? 'Very High' : analysis.gapToGovt > 60 ? 'High (large gap)' : 'Moderate',
                      'Low — guaranteed MBBS seat',
                    ],
                    [
                      'Certainty',
                      'None — depends on next NEET',
                      'Confirmed seat this year',
                    ],
                  ].map(([factor, pathA, pathB]) => (
                    <tr key={factor} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-500 font-medium">{factor}</td>
                      <td className="px-5 py-3 text-slate-700 font-semibold">{pathA}</td>
                      <td className="px-5 py-3 text-slate-700 font-semibold">{pathB}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white text-center">
              <p className="font-bold text-sm mb-1">Every student's situation is unique.</p>
              <p className="text-[12px] text-indigo-100 mb-3 max-w-md mx-auto leading-relaxed">
                Our counsellors factor in your college preferences, PG aspirations, family finances, and career goals — giving you a complete picture beyond this financial snapshot.
              </p>
              <a href="https://eduniaa.com/book" target="_blank" rel="noopener noreferrer"
                className="inline-block bg-white text-indigo-700 font-bold text-xs px-6 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                Book a Free Eduniaa Counselling Session →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
