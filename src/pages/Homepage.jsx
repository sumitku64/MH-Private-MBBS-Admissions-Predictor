import { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart2, ShieldCheck, CheckCircle2, ChevronDown, Search, LayoutGrid, List, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CATEGORIES, GENDERS } from '../data';
import { useCollegeData } from '../lib/useCollegeData';
import { calcFee, calcProb, BUDGET_CAP } from '../lib/predictionEngine';
import { useUser } from '../context/UserContext';

const PROB_ORDER = { high: 0, borderline: 1, low: 2 };

const PROB_CONFIG = {
  high: { label: 'High Probability', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
  borderline: { label: 'Borderline', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-400', dot: 'bg-amber-500' },
  low: { label: 'Low Probability', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', bar: 'bg-rose-500', dot: 'bg-rose-500' },
};

const FAQS = [
  { q: 'How accurate is this prediction?', a: 'Our predictions are based on 5+ years of official MCC and state counselling data. We model cutoff trends, category-wise closing ranks, and management quota availability for all 23 Maharashtra private medical colleges.' },
  { q: 'Does it include state quota seats?', a: 'Yes. The predictor covers both 85% Maharashtra state quota seats and the 15% All India Quota for all private MBBS colleges in Maharashtra. Category-wise cutoffs are applied.' },
  { q: 'What are the nuances of State Quota counselling?', a: 'State quota requires MH domicile (15-year residency or parent born in Maharashtra). Seats are allotted through MH CET Cell using centralised counselling. Category-specific cutoffs apply.' },
  { q: 'How does the AI Counsellor for MH help?', a: 'Dhruv, our AI counsellor, has deep knowledge of all 23 private MH colleges, fee structures, domicile rules, category concessions, and the MH CET Cell process. Ask it anything.' },
];

const SUCCESS_STORIES = [
  { text: 'Got into my first-choice college after following the drop year advice. The predictor showed me exactly where I stood.', name: 'Arjun M.', tag: 'MBBS Student, Pune' },
  { text: 'As an OBC female student, the fee concession calculation was incredibly accurate. Saved our family from miscalculating.', name: 'Priya S.', tag: 'MBBS Student, Mumbai' },
  { text: 'The round-wise analysis helped me pick the right choice filling strategy. Got a seat in Round 2!', name: 'Rahul D.', tag: 'MBBS Student, Nashik' },
];

function formatBudget(val) {
  if (val >= 1000000) return `\u20b9${(val / 100000).toFixed(0)}L`;
  if (val >= 1000) return `\u20b9${(val / 1000).toFixed(0)}K`;
  return `\u20b9${val}`;
}

function CollegeCard({ college, viewMode }) {
  const cfg = PROB_CONFIG[college.prob] || PROB_CONFIG.high;
  const pct = college.cutoff ? Math.min(100, Math.round((college.userScore / college.cutoff) * 100)) : 0;

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-6 hover:shadow-md transition-shadow">
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-bold text-slate-900 text-base leading-snug truncate">{college.name}</h3>
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-slate-500">Code {college.code} &middot; {college.seats} seats &middot; {college.quota}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-black text-slate-900">
            {college.fees ? `\u20b9${(college.fees / 100000).toFixed(1)}L` : 'N/A'}<span className="text-xs font-medium text-slate-500">/yr</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Cutoff: {college.cutoff ?? 'N/A'}</div>
        </div>
        <Link to={`/college/${college.id}`} className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">
          Details →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4 gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-base leading-snug mb-1">{college.name}</h3>
            <p className="text-[11px] text-slate-400 font-medium">Code {college.code} &middot; {college.seats} seats</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-600">Score: {college.userScore}</span>
            <span className="text-slate-400">Cutoff: {college.cutoff ?? 'N/A'}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 text-right mt-1">
            {college.cutoff ? `${pct}% of cutoff` : 'No cutoff data'}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-black text-slate-900 text-lg">
              {college.fees ? `\u20b9${(college.fees / 100000).toFixed(2)}L` : 'N/A'}
              <span className="text-xs text-slate-500 font-medium">/yr</span>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{college.quota}</span>
          </div>
          <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
        </div>
      </div>

      <div className="px-5 pb-4">
        <Link
          to={`/college/${college.id}`}
          className="block w-full py-2.5 text-center text-sm font-bold text-indigo-600 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}

export default function Homepage() {
  const { profile } = useUser();
  const [activeFaq, setActiveFaq] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Predictor state — auto-synced from profile on auth changes, then user-editable (What-If)
  const [score, setScore] = useState(() => profile?.userScore ? Number(profile.userScore) : 650);
  const [category, setCategory] = useState(() => profile?.category ?? 'open');
  const [gender, setGender] = useState(() => profile?.gender ?? 'any');
  const [year, setYear] = useState(2024);
  const [budget, setBudget] = useState(() => profile?.annualBudget ? Number(profile.annualBudget) : 2500000);
  const [visibleCount, setVisibleCount] = useState(6);
  const resultsRef = useRef(null);

  // Identity-aware profile sync (handles logout and account switching without overwriting active What-Ifs)
  const [hydratedUserId, setHydratedUserId] = useState(() => profile?.isRegistered ? profile.google_id : null);

  useEffect(() => {
    const currentAuth = profile?.isRegistered ? profile.google_id : null;
    
    if (currentAuth !== hydratedUserId) {
      if (currentAuth) {
        // Logged in or Account Switched: Hydrate with the active user's data
        setScore(profile.userScore ? Number(profile.userScore) : 650);
        setCategory(profile.category ?? 'open');
        setGender(profile.gender ?? 'any');
        setBudget(profile.annualBudget ? Number(profile.annualBudget) : 2500000);
      } else {
        // Logged out: Reset to anonymous defaults (No stale data leak)
        setScore(650);
        setCategory('open');
        setGender('any');
        setBudget(2500000);
      }
      setHydratedUserId(currentAuth);
    }
  }, [profile?.isRegistered, profile?.google_id, profile?.userScore, profile?.category, profile?.gender, profile?.annualBudget, hydratedUserId]);

  const { collegeData: colleges } = useCollegeData();

  const processed = useMemo(() => colleges.map(c => {
    const effectiveGender = gender === 'any' ? 'male' : gender;
    const cutoff = c.cutoffs[year]?.[category] ?? null;
    const fee = calcFee(c.fees, category, effectiveGender);
    const canAfford = fee != null && fee <= budget;
    const { prob, viaMgmt } = calcProb(score, cutoff, { canAfford });

    return {
      id: c.code,
      name: c.name,
      code: c.code,
      seats: c.seats,
      userScore: score,
      cutoff,
      prob,
      fees: fee,
      quota: viaMgmt ? 'Mgmt Quota' : 'AIQ / State',
    };
  }), [colleges, score, category, gender, year, budget]);

  // Step 2: Hard budget filter — remove colleges whose known fee exceeds the active budget.
  // Colleges with null fee (no data) are kept; we cannot determine affordability without data.
  // This step is SEPARATE from canAfford inside calcProb, which only influences the
  // probability tier (management-quota upgrade path) and not inclusion/exclusion.
  const budgetFiltered = useMemo(() =>
    processed.filter(c => c.fees == null || c.fees <= budget),
  [processed, budget]);

  // Step 3: Sort by probability, then apply name search within the already-filtered list.
  // Search NEVER bypasses budget, score, category, gender, or year — it narrows budgetFiltered.
  const sorted = useMemo(() => {
    let list = [...budgetFiltered];
    list.sort((a, b) => PROB_ORDER[a.prob] - PROB_ORDER[b.prob] || (b.cutoff ?? 0) - (a.cutoff ?? 0));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [budgetFiltered, searchQuery]);

  const visibleResults = sorted.slice(0, visibleCount);

  // Quick-stat counts use budgetFiltered (not raw processed) so they stay consistent
  // with what is actually displayed in the results section.
  const highCount = budgetFiltered.filter(c => c.prob === 'high').length;
  const borderlineCount = budgetFiltered.filter(c => c.prob === 'borderline').length;

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="w-full bg-white">

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 md:px-4 md:px-6 py-10 md:py-16 grid md:grid-cols-12 gap-8 md:gap-12 items-start">

        {/* Left */}
        <div className="md:col-span-7 pt-4">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200 mb-6">
            <CheckCircle2 className="w-3.5 h-3.5" /> Trusted by 500K+ Students
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-5">
            <span className="text-orange-500">NEET</span> All India &amp; State<br />College Predictor<br />
            <span className="text-slate-900">2026</span>
          </h1>
          <p className="text-base md:text-lg text-slate-500 mb-8 max-w-lg leading-relaxed">
            Get precise college predictions powered by multi-year cut-off trends across all 23 Maharashtra private MBBS colleges.
          </p>

          <div className="space-y-4 mb-8">
            {[
              { icon: <BarChart2 className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', title: 'Historical Data Analysis', sub: '5+ years of official MCC & state cutoff trends' },
              { icon: <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, bg: 'bg-indigo-50', title: 'Smart Predictions', sub: 'Category-wise probability for every college' },
              { icon: <ShieldCheck className="w-5 h-5 text-slate-700" />, bg: 'bg-slate-100', title: 'Verified Data', sub: 'Official MCC & MH CET Cell counselling data' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>{item.icon}</div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                  <p className="text-xs text-slate-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Predictor Form — always visible and editable */}
        <div className="md:col-span-5">
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-slate-100 p-6 md:p-8">

            {/* All India / State toggle — visual only */}
            <div className="mb-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Select Predictor</p>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button className="flex-1 bg-white text-indigo-600 font-bold text-sm py-2 rounded-lg shadow-sm">All India</button>
                <button className="flex-1 text-slate-500 hover:text-slate-700 font-medium text-sm py-2 rounded-lg">State Quota</button>
              </div>
            </div>

            <h2 className="text-lg font-black text-slate-900 mb-0.5">Enter NEET Exam Details</h2>
            <p className="text-xs text-slate-400 mb-5">
              {profile.isRegistered ? (
                <span>Auto-filled from your saved profile &middot; <Link to="/profile" className="text-indigo-500 hover:underline font-medium">Edit Profile</Link></span>
              ) : 'Get personalized college recommendations instantly'}
            </p>

            <div className="space-y-4">
              {/* NEET Score */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  NEET Score <span className="text-slate-400 font-normal">(0–720)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none">🏆</span>
                  <input
                    type="number" min="0" max="720" value={score}
                    onChange={e => { setScore(Number(e.target.value)); setVisibleCount(6); }}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Caste Group / Category</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none">👥</span>
                  <select
                    value={category}
                    onChange={e => { setCategory(e.target.value); setVisibleCount(6); }}
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Gender <span className="text-slate-400 font-normal">(affects female OBC/SEBC concession)</span>
                </label>
                <div className="flex gap-2">
                  {GENDERS.map(g => (
                    <button
                      key={g.value}
                      onClick={() => { setGender(g.value); setVisibleCount(6); }}
                      className={`flex-1 font-bold text-sm py-2.5 rounded-xl border transition-all ${gender === g.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Annual Budget */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 flex justify-between items-center">
                  <span>Annual Budget</span>
                  <span className="font-black text-indigo-600">{formatBudget(budget)}</span>
                </label>
                <input
                  type="range" min="500000" max="10000000" step="100000" value={budget}
                  onChange={e => { setBudget(Number(e.target.value)); setVisibleCount(6); }}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>₹5L</span><span>₹1Cr</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={scrollToResults}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-xl shadow-[0_4px_14px_0_rgb(249,115,22,0.35)] transition-all active:scale-[0.98]"
              >
                Find Colleges →
              </button>

              {/* Quick Stats */}
              {colleges.length > 0 && (
                <div className="flex gap-3 pt-1">
                  <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-black text-emerald-700">{highCount}</div>
                    <div className="text-[10px] font-bold text-emerald-600">High Match</div>
                  </div>
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-black text-amber-700">{borderlineCount}</div>
                    <div className="text-[10px] font-bold text-amber-600">Borderline</div>
                  </div>
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-black text-slate-700">{colleges.length}</div>
                    <div className="text-[10px] font-bold text-slate-500">Total Colleges</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* RECOMMENDED COLLEGES */}
      <section ref={resultsRef} className="max-w-7xl mx-auto px-4 md:px-4 md:px-6 mt-8 md:mt-16 pb-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Recommended Colleges</h2>
            <p className="text-sm text-slate-500">Based on your score ({score}) and preferences &middot; {sorted.length} matches found</p>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-8 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[180px] max-w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search colleges..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
            />
          </div>

          <div className="relative">
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="appearance-none pl-4 pr-8 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none cursor-pointer">
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={category} onChange={e => { setCategory(e.target.value); setVisibleCount(6); }} className="appearance-none pl-4 pr-8 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none cursor-pointer">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={gender} onChange={e => { setGender(e.target.value); setVisibleCount(6); }} className="appearance-none pl-4 pr-8 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 focus:outline-none cursor-pointer">
              {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5 ml-auto">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {visibleResults.length > 0 ? (
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-5' : 'flex flex-col gap-3'}>
            {visibleResults.map((c, i) => <CollegeCard key={i} college={c} viewMode={viewMode} />)}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-slate-600 font-bold mb-2">No colleges match your criteria</p>
            <p className="text-sm text-slate-400">Try adjusting your score, budget, or search query.</p>
          </div>
        )}

        {visibleCount < sorted.length && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setVisibleCount(prev => prev + 6)}
              className="bg-white border border-slate-200 text-slate-700 font-bold text-sm py-3 px-8 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
            >
              Load More Results ({sorted.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </section>

      {/* DATA FOUNDATION */}
      <section className="bg-slate-50 py-16 md:py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 md:px-4 md:px-6 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200/50">
            <img
              src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1000"
              alt="Medical student studying"
              className="w-full h-[300px] md:h-[400px] object-cover"
            />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-3">Massive, Verified Data Foundation</h2>
            <p className="text-slate-500 mb-8 leading-relaxed text-sm">
              Our predictions aren't magic; they are math. We aggregate, clean, and analyze official MCC and state counseling data to give you the most accurate landscape possible.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { val: '700+', label: 'Medical Colleges', accent: 'border-indigo-500', text: 'text-indigo-700' },
                { val: '1L+', label: 'MBBS Seats Analyzed', accent: 'border-violet-500', text: 'text-violet-700' },
                { val: '5 Yrs', label: 'Historical Data', accent: 'border-orange-500', text: 'text-orange-600' },
                { val: '98%', label: 'Prediction Accuracy', accent: 'border-emerald-500', text: 'text-emerald-600' },
              ].map((s, i) => (
                <div key={i} className={`bg-white p-5 rounded-xl border-l-4 shadow-sm ${s.accent}`}>
                  <div className={`text-3xl font-black mb-0.5 ${s.text}`}>{s.val}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-4xl mx-auto px-4 md:px-4 md:px-6 py-16 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Frequently Asked Questions</h2>
          <p className="text-sm text-slate-500">Everything you need to know about MH MBBS admissions</p>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex justify-between items-center px-4 md:px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              >
                <span className="font-bold text-slate-900 text-sm pr-4">{faq.q}</span>
                {activeFaq === i ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {activeFaq === i && (
                <div className="px-4 md:px-6 pb-5">
                  <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SUCCESS STORIES */}
      <section className="bg-slate-50 border-t border-slate-100 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-4 md:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">Success Stories</h2>
            <p className="text-sm text-slate-500">From students who used Eduniaa to navigate MH MBBS admissions</p>
          </div>
          <div className="grid md:grid-cols-1 md:grid-cols-3 gap-6">
            {SUCCESS_STORIES.map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-3xl font-black text-indigo-200 mb-3 leading-none">"</div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">{s.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                    <div className="text-[11px] text-slate-400">{s.tag}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
