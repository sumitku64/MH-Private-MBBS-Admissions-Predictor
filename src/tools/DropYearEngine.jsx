import { useState, useMemo, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { Link } from 'react-router-dom';

const CATEGORIES = [
  { value: 'open', label: 'Open / General' },
  { value: 'obc',  label: 'OBC' },
  { value: 'sebc', label: 'SEBC (Maratha)' },
  { value: 'vjnt', label: 'VJNT / NT / SBC' },
  { value: 'sc',   label: 'SC' },
  { value: 'st',   label: 'ST' },
  { value: 'ews',  label: 'EWS' },
];

const GOVT_CUTOFFS = {
  open: 610, obc: 575, sebc: 560, vjnt: 540, sc: 480, st: 430, ews: 590,
};

const TIERS = [
  {
    id: 'top', label: 'Top-Tier Private', desc: 'Sion, Nair, BJ Medical, Grant',
    feeMin: 1200000, feeMax: 2000000,
    minScore: { open: 570, obc: 530, sebc: 515, vjnt: 500, sc: 445, st: 385, ews: 550 },
  },
  {
    id: 'mid', label: 'Mid-Tier Private', desc: 'KJ Somaiya, MGM, DY Patil, BJMC Pune',
    feeMin: 800000, feeMax: 1200000,
    minScore: { open: 510, obc: 470, sebc: 455, vjnt: 440, sc: 385, st: 320, ews: 490 },
  },
  {
    id: 'lower', label: 'Lower-Tier Private', desc: 'Remaining approved private colleges',
    feeMin: 500000, feeMax: 800000,
    minScore: { open: 440, obc: 400, sebc: 385, vjnt: 365, sc: 305, st: 250, ews: 420 },
  },
  {
    id: 'management', label: 'Management Quota', desc: 'Direct admission, any college',
    feeMin: 1800000, feeMax: 3000000,
    minScore: { open: 350, obc: 350, sebc: 350, vjnt: 350, sc: 350, st: 350, ews: 350 },
  },
];

const IMPROVEMENT = {
  '1st':  { min: 20,  avg: 45, max: 75, note: 'First-time droppers typically see the biggest jump.' },
  '2nd':  { min: 5,   avg: 22, max: 45, note: 'Diminishing returns — focus on specific weak topics.' },
  '3rd+': { min: -10, avg: 8,  max: 25, note: 'Score plateaus after 3 attempts. Risk is high.' },
};

const LOAN_RATE   = 8.5;
const LOAN_MONTHS = 120;

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

export default function DropYearEngine() {
  const { profile } = useUser();
  
  const getAttempt = (year) => {
    if (!year) return '1st';
    const y = parseInt(year);
    if (isNaN(y)) return '1st';
    const current = new Date().getFullYear();
    const diff = current - y;
    if (diff <= 0) return '1st';
    if (diff === 1) return '2nd';
    return '3rd+';
  };

  const [score,      setScore]      = useState(() => profile?.userScore ?? '');
  const [category,   setCategory]   = useState(() => profile?.category ?? 'open');
  const [attempt,    setAttempt]    = useState(() => getAttempt(profile?.education?.class12Year));
  const [targetTier, setTargetTier] = useState('mid');
  const [budget,     setBudget]     = useState(() => profile?.annualBudget ? Math.round(profile.annualBudget / 100000) : '');
  
  const isProfileReady = score !== '' && budget !== '';
  const [submitted,  setSubmitted]  = useState(isProfileReady);
  
  // Identity-aware profile sync
  const [hydratedUserId, setHydratedUserId] = useState(() => profile?.isRegistered ? profile.google_id : null);

  useEffect(() => {
    const currentAuth = profile?.isRegistered ? profile.google_id : null;
    
    if (currentAuth !== hydratedUserId) {
      if (currentAuth) {
        const s = profile.userScore ?? '';
        const b = profile.annualBudget ? Math.round(profile.annualBudget / 100000) : '';
        setScore(s);
        setCategory(profile.category ?? 'open');
        setAttempt(getAttempt(profile.education?.class12Year));
        setBudget(b);
        if (s !== '' && b !== '') setSubmitted(true);
      } else {
        setScore('');
        setCategory('open');
        setAttempt('1st');
        setBudget('');
        setSubmitted(false);
      }
      setHydratedUserId(currentAuth);
    }
  }, [profile?.isRegistered, profile?.google_id, profile?.userScore, profile?.category, profile?.education, profile?.annualBudget, hydratedUserId]);

  const ready = score !== '' && !isNaN(parseInt(score)) && parseInt(score) >= 200 && parseInt(score) <= 720 && budget !== '';

  const analysis = useMemo(() => {
    if (!submitted || !ready) return null;
    const sc = parseInt(score);
    if (isNaN(sc) || sc < 200 || sc > 720) return null;

    const govtCutoff    = GOVT_CUTOFFS[category] ?? GOVT_CUTOFFS.open;
    const imp           = IMPROVEMENT[attempt];
    const gapToGovt     = govtCutoff - sc;
    const currentYear   = new Date().getFullYear();

    const projMin = sc + imp.min;
    const projAvg = sc + imp.avg;
    const projMax = sc + imp.max;

    const govtProb =
      projAvg >= govtCutoff + 25  ? { label: 'High',         cls: 'bg-emerald-100 text-emerald-700' } :
      projAvg >= govtCutoff        ? { label: 'Moderate',     cls: 'bg-amber-100 text-amber-700' }    :
      projAvg >= govtCutoff - 20   ? { label: 'Low–Moderate', cls: 'bg-amber-100 text-amber-700' }    :
                                     { label: 'Low',          cls: 'bg-rose-100 text-rose-700' };

    const accessible = TIERS.filter(t => sc >= (t.minScore[category] ?? 9999));

    const target   = TIERS.find(t => t.id === targetTier) ?? TIERS[1];
    const canHitTarget = accessible.some(t => t.id === target.id);
    const useTier  = canHitTarget ? target : accessible[0] ?? null;

    const feeMin = useTier ? useTier.feeMin * 4.5 : 0;
    const feeMax = useTier ? useTier.feeMax * 4.5 : 0;

    const budgetTotal = (parseInt(budget) || 0) * 100000 * 4.5;

    const loanMin = Math.max(0, feeMin - budgetTotal);
    const loanMax = Math.max(0, feeMax - budgetTotal);

    const emiMin = calcEMI(loanMin);
    const emiMax = calcEMI(loanMax);

    const repayMin = emiMin * LOAN_MONTHS;
    const repayMax = emiMax * LOAN_MONTHS;
    const intMin   = repayMin - loanMin;
    const intMax   = repayMax - loanMax;

    const MBBS_YEARS      = 4.5;
    const INTERN_YEARS    = 1;
    const careerStart     = Math.ceil(currentYear + MBBS_YEARS + INTERN_YEARS);
    const loanRepaid      = loanMax > 0 ? careerStart + 10 : careerStart;
    const dropCareerStart = Math.ceil(currentYear + 1 + MBBS_YEARS + INTERN_YEARS);
    const dropBreakEven   = loanMax > 0 ? dropCareerStart + 10 : dropCareerStart + 1;

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
      recLevel = (parseInt(budget) || 0) * 100000 >= (useTier?.feeMin ?? 999999) ? 'Recommended' : 'Consider if budget allows';
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
  }, [submitted, ready, score, category, attempt, targetTier, budget]);

  const missingFields = [];
  if (score === '') missingFields.push('NEET Score');
  if (budget === '') missingFields.push('Annual Budget');

  return (
    <div className="flex flex-col lg:flex-row h-full bg-[#F8FAFC] font-sans rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100">
      {/* ── Input panel (Strategic Engine) ── */}
      <div className="w-full lg:w-[420px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto p-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Strategic Engine</h2>
          <p className="text-sm text-slate-500 mt-2 mb-8 leading-relaxed">
            Configure your profile to evaluate the viability of admission vs. taking a drop year.
          </p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">NEET Score</label>
              <input type="number" value={score} min={200} max={720}
                onChange={e => { setScore(e.target.value); setSubmitted(false); }}
                placeholder="0"
                className="w-20 bg-transparent text-right font-black text-blue-600 text-xl focus:outline-none" />
            </div>
            <input type="range" min={200} max={720} value={score || 200}
              onChange={e => { setScore(e.target.value); setSubmitted(false); }}
              className="w-full accent-blue-600 mb-2 relative z-10" />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 relative z-10">
              <span>200</span><span>720</span>
            </div>
            
            <div className="mt-8 bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 relative z-10">
               <div className="flex justify-between items-end mb-2">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Success Probability Trajectory</span>
                 <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">High Growth Zone</span>
               </div>
               <div className="flex items-end gap-1 h-16">
                  {[400, 450, 500, 550, 600, 650, 700].map(val => (
                    <div key={val} className="flex-1 bg-blue-100 rounded-t-sm transition-all" style={{height: `${Math.max(15, (val/720)*100)}%`, opacity: parseInt(score||0) >= val ? 1 : 0.4, backgroundColor: parseInt(score||0) >= val && parseInt(score||0) < val+50 ? '#2563eb' : '#bfdbfe'}}></div>
                  ))}
               </div>
               <div className="flex justify-between text-[8px] font-bold text-slate-400 mt-2">
                 <span>400</span><span>500</span><span className="text-blue-600 bg-blue-50 px-1 rounded">{score || 'N/A'}</span><span>650</span><span>720</span>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-2">Category</label>
              <select value={category} onChange={e => { setCategory(e.target.value); setSubmitted(false); }} className="w-full bg-[#F8FAFC] border border-slate-100 text-slate-700 font-bold text-sm px-3 py-3 rounded-xl focus:outline-none focus:border-blue-500">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label.split(' ')[0]}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-2">Attempt</label>
              <select value={attempt} onChange={e => { setAttempt(e.target.value); setSubmitted(false); }} className="w-full bg-[#F8FAFC] border border-slate-100 text-slate-700 font-bold text-sm px-3 py-3 rounded-xl focus:outline-none focus:border-blue-500">
                {['1st', '2nd', '3rd+'].map(a => <option key={a} value={a}>{a === '1st' ? 'First Attempt' : a === '2nd' ? 'Second Attempt' : '3rd+ Attempt'}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-2">Target Tier (PG Aspirations)</label>
            <div className="flex bg-[#F8FAFC] rounded-xl p-1 border border-slate-100">
              {TIERS.slice(0,3).map(t => (
                <button key={t.id} onClick={() => { setTargetTier(t.id); setSubmitted(false); }}
                  className={`flex-1 py-2.5 px-1 text-[11px] font-bold rounded-lg transition-colors ${targetTier === t.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                  {t.id === 'top' ? 'AIIMS/Top Gov' : t.id === 'mid' ? 'Mid Gov' : 'Private/Deemed'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-4 flex justify-between">
              Annual Budget (INR) <span className="text-blue-600 font-black text-xs">{budget ? `₹${budget}L` : '---'}</span>
            </label>
            <input type="range" min={2} max={30} step={1} value={budget || 2}
              onChange={e => { setBudget(parseInt(e.target.value)); setSubmitted(false); }}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
              <span>₹2L</span><span>₹30L+</span>
            </div>
          </div>

          <button onClick={() => setSubmitted(true)} disabled={!ready}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-black transition-colors disabled:opacity-40 shadow-md">
            Analyse Options
          </button>
        </div>
      </div>

      {/* ── Results panel ── */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-transparent">
        {!submitted || !analysis ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl opacity-50">⚖️</span>
            {missingFields.length > 0 ? (
              <>
                <h3 className="text-lg font-bold text-slate-700">Missing Profile Data</h3>
                <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
                  To view affordability and strategic insights, please set the following in your Personal Profile: 
                  <strong className="block mt-2 text-slate-700">{missingFields.join(' and ')}</strong>
                </p>
                <Link to="/profile" className="mt-4 px-6 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-700 transition-colors">
                  Go to Personal Profile
                </Link>
                <p className="text-slate-400 text-xs mt-4 max-w-xs">Or manually enter the values in the Strategic Engine on the left to test hypothetical scenarios.</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-700">Awaiting Profile Configuration</h3>
                <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                  Enter your details in the strategic engine to get a comprehensive comparison between enrolling now and taking a drop year.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 pb-10">

            {/* Recommendation Top Card */}
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col md:flex-row items-center gap-10">
               <div className="shrink-0 relative flex items-center justify-center w-36 h-36 rounded-full border-[12px] border-[#EEF2FF]">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="60" cy="60" r="60" fill="transparent" stroke="#2563eb" strokeWidth="12" strokeDasharray="376.99" strokeDashoffset={376.99 - (376.99 * (analysis.rec === 'Drop Year' ? 0.35 : 0.75))} className="translate-x-[12px] translate-y-[12px]" />
                  </svg>
                  <div className="text-center z-10 bg-white w-full h-full rounded-full flex flex-col items-center justify-center">
                    <div className="text-3xl font-black text-slate-900 leading-none mb-1">{analysis.rec === 'Drop Year' ? '35%' : '75%'}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Viability</div>
                  </div>
               </div>
               <div>
                  <h2 className="text-3xl font-black text-slate-900 mb-4">{analysis.rec === 'Drop Year' ? 'Favorable for Drop Year' : 'Favorable for Private Admission'}</h2>
                  <p className="text-slate-600 text-[15px] leading-relaxed">
                    Based on your score of <strong className="text-slate-900">{analysis.sc}</strong> and budget, securing a {analysis.rec === 'Drop Year' ? 'government seat next year' : 'management quota seat'} is {analysis.rec === 'Drop Year' ? 'your primary strategic path' : 'highly probable'}. A drop year is statistically {analysis.attempt === '3rd+' ? 'highly risky for achieving an AIIMS tier upgrade.' : analysis.rec === 'Drop Year' ? 'your best option to avoid severe debt.' : 'risky for achieving an AIIMS tier upgrade.'}
                  </p>
               </div>
            </div>

            {/* Side-by-side scenarios */}
            <div className="grid lg:grid-cols-2 gap-8">
               
               {/* Scenario A */}
               <div className="bg-[#EEF2FF] rounded-2xl p-8 border border-[#E0E7FF] relative overflow-hidden shadow-sm">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/50 -mr-16 -mt-16 rotate-45 rounded-[2rem]"></div>
                 <h3 className="text-xl font-black text-indigo-950 mb-8 relative z-10">Scenario A: Enroll Now</h3>
                 <div className="space-y-5 relative z-10">
                   <div className="flex justify-between items-center text-sm border-b border-indigo-100/60 pb-4">
                     <span className="text-indigo-900/70 font-bold">Time to Practice</span>
                     <span className="font-black text-indigo-950">5.5 Years</span>
                   </div>
                   <div className="flex justify-between items-center text-sm border-b border-indigo-100/60 pb-4">
                     <span className="text-indigo-900/70 font-bold">Est. Total Cost</span>
                     <span className="font-black text-indigo-950">{fmtL(analysis.feeMin)} - {fmtL(analysis.feeMax)}</span>
                   </div>
                   <div className="pt-2 pb-2">
                     <div className="flex h-3 w-full rounded-full overflow-hidden mb-3">
                       <div className="bg-blue-600 w-[60%]"></div>
                       <div className="bg-indigo-400 w-[30%] border-l-2 border-white/20"></div>
                       <div className="bg-amber-600 w-[10%] border-l-2 border-white/20"></div>
                     </div>
                     <div className="flex gap-5 text-[11px] font-bold text-indigo-900/70">
                       <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Tuition</span>
                       <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span> Hostel</span>
                       <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span> Hidden</span>
                     </div>
                   </div>
                   <div className="flex justify-between items-center text-sm border-b border-indigo-100/60 pb-4 pt-2">
                     <span className="text-indigo-900/70 font-bold">Education Loan EMI</span>
                     <span className="font-black text-blue-600">{analysis.loanMax > 0 ? `${fmtEMI(analysis.emiMin)} /mo` : 'None'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm pb-1 pt-1">
                     <span className="text-indigo-900/70 font-bold">Accessible Tier</span>
                     <span className="font-black text-indigo-950">{analysis.useTier ? analysis.useTier.label : 'None'}</span>
                   </div>
                 </div>
               </div>

               {/* Scenario B */}
               <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                 <h3 className="text-xl font-black text-slate-900 mb-8">Scenario B: Drop Year</h3>
                 <div className="space-y-6">
                   <div className="flex justify-between items-center text-[15px] border-b border-slate-100 pb-5">
                     <span className="text-slate-500 font-bold">Target Score Req.</span>
                     <span className="font-black text-rose-600">{analysis.govtCutoff}+ <span className="text-sm font-bold opacity-70">({analysis.gapToGovt > 0 ? '+' : ''}{analysis.gapToGovt} pts)</span></span>
                   </div>
                   <div className="flex justify-between items-center text-[15px] border-b border-slate-100 pb-5">
                     <span className="text-slate-500 font-bold">Historical Success</span>
                     <span className="font-black text-slate-700">{Math.min(100, Math.round(analysis.imp.avg * 1.5))}% <span className="text-sm font-normal text-slate-400 font-bold">(Drop 1 to Govt)</span></span>
                   </div>
                   <div className="flex justify-between items-center text-[15px] pb-2 border-b border-slate-100 pb-5">
                     <span className="text-slate-500 font-bold">Opportunity Cost</span>
                     <span className="font-black text-slate-900">1 Year Income</span>
                   </div>
                   <div className="flex justify-between items-center text-[15px] pb-2">
                     <span className="text-slate-500 font-bold">Career Starts</span>
                     <span className="font-black text-slate-900">~{analysis.dropCareerStart}</span>
                   </div>
                 </div>
               </div>

            </div>

            {/* RISK / REWARD Chart */}
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm mt-8">
               <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-widest mb-10">RISK/REWARD: 5-YEAR FINANCIAL TRAJECTORY</h3>
               
               <div className="space-y-8 mb-10">
                 <div className="relative">
                   <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-2.5">
                     <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">Enroll Now</span>
                     <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-300"></span> Lifetime Earnings</span>
                   </div>
                   <div className="h-16 w-full bg-blue-50/50 rounded-md relative border border-blue-100 overflow-hidden">
                     <div className="absolute inset-y-0 left-0 bg-[#0047b3] rounded-md" style={{width: '75%'}}></div>
                     <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white font-black text-sm">{fmtL(analysis.feeMax)}</span>
                   </div>
                 </div>
                 
                 <div className="relative">
                   <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-2.5">
                     <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-100">Drop Year</span>
                     <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-200"></span> Net Wealth (5yr)</span>
                   </div>
                   <div className="h-16 w-full bg-rose-50/50 rounded-md relative border border-rose-100 overflow-hidden">
                     <div className="absolute inset-y-0 left-0 bg-[#b91c1c] rounded-md" style={{width: '90%'}}></div>
                     <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white font-black text-sm">₹3.5L - ₹6.5L</span>
                   </div>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-6">
                   <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Break-Even</div>
                   <div className="text-3xl font-black text-blue-600">{Math.max(0, analysis.dropBreakEven - analysis.currentYear)} Years</div>
                 </div>
                 <div className="border border-rose-100 bg-rose-50/30 rounded-xl p-6">
                   <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Opportunity Cost</div>
                   <div className="text-3xl font-black text-rose-600">₹45L - ₹60L</div>
                 </div>
               </div>
            </div>

            <div className="flex justify-end gap-4 pt-6">
               <button className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Save Analysis</button>
               <button className="px-6 py-3.5 bg-blue-700 text-white font-bold text-sm rounded-xl hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-sm">View Detailed Breakdown &rarr;</button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
