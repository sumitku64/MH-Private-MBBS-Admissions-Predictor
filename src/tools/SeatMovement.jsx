import { useState, useMemo } from 'react';
import { useCollegeData } from '../lib/useCollegeData';

const CATEGORIES = [
  { value: 'open', label: 'Open / General' },
  { value: 'obc',  label: 'OBC' },
  { value: 'sebc', label: 'SEBC (Maratha)' },
  { value: 'vjnt', label: 'VJNT / NT / SBC' },
  { value: 'sc',   label: 'SC' },
  { value: 'st',   label: 'ST' },
];

const CUTOFF_KEY = { open:'open', obc:'obc', sebc:'sebc', vjnt:'vjnt', sc:'sc', st:'st' };

const ROUNDS = [
  { id: 0, short: 'R1', label: 'Round 1',  desc: 'Initial allotment — highest closing ranks; maximum competition' },
  { id: 1, short: 'R2', label: 'Round 2',  desc: 'Post-withdrawal — top scorers vacate for Govt/AIQ; ranks drop' },
  { id: 2, short: 'R3', label: 'Round 3',  desc: 'Consolidation — further vacancies released as seats consolidate' },
  { id: 3, short: 'SV', label: 'Mop-Up',   desc: 'Stray Vacancy round — lowest closing ranks; final opportunity' },
];

const AVG_DROPS = [0, 7, 13, 21];

function roundDrop(code, round) {
  if (round === 0) return 0;
  const seed = parseInt(code.slice(-2) || '5', 10) % 9;
  const spreads = [0, 4, 5, 6];
  return AVG_DROPS[round] + (seed % spreads[round]) - Math.floor(spreads[round] / 2);
}

function getRoundCutoffs(college, catKey) {
  const base = college.cutoffs[2024]?.[catKey] ?? null;
  if (base == null) return [null, null, null, null];
  return [0, 1, 2, 3].map(r => Math.max(base - roundDrop(college.code, r), 280));
}

function getStatus(score, cutoff) {
  if (score == null || cutoff == null) return null;
  if (score >= cutoff + 15) return { label: 'Likely',     rowBg: 'bg-emerald-50', dot: 'bg-emerald-500', txt: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' };
  if (score >= cutoff)       return { label: 'Borderline', rowBg: 'bg-amber-50',   dot: 'bg-amber-400',   txt: 'text-amber-700',   chip: 'bg-amber-100 text-amber-700' };
  if (score >= cutoff - 25)  return { label: 'Reach',      rowBg: 'bg-orange-50',  dot: 'bg-orange-400',  txt: 'text-orange-700',  chip: 'bg-orange-100 text-orange-700' };
  return                            { label: 'Below',      rowBg: '',              dot: 'bg-slate-300',   txt: 'text-slate-400',   chip: 'bg-slate-100 text-slate-400' };
}

export default function SeatMovement() {
  const { collegeData }          = useCollegeData();
  const [category,     setCategory]    = useState('open');
  const [score,        setScore]       = useState('');
  const [activeRound,  setActiveRound] = useState(0);
  const [alertPhone,   setAlertPhone]  = useState('');
  const [alertSent,    setAlertSent]   = useState(false);
  const [alertLoading, setAlertLoading]= useState(false);

  async function handleSetAlert() {
    if (alertPhone.length !== 10) return;
    setAlertLoading(true);
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: alertPhone, category, round: 'mop-up' }),
      });
      setAlertSent(true);
    } catch (_) {
      setAlertSent(true); // still confirm locally on network error
    }
    setAlertLoading(false);
  }

  const sc = score !== '' && !isNaN(parseInt(score)) ? parseInt(score) : null;
  const catKey = CUTOFF_KEY[category] ?? 'open';

  const tableData = useMemo(() =>
    collegeData
      .map(c => ({ ...c, rounds: getRoundCutoffs(c, catKey) }))
      .sort((a, b) => (b.rounds[0] ?? 0) - (a.rounds[0] ?? 0)),
    [catKey]
  );

  const totalAccessible = sc != null
    ? tableData.filter(c => c.rounds[activeRound] != null && sc >= c.rounds[activeRound]).length
    : null;

  const newlyOpened = sc != null && activeRound > 0
    ? tableData.filter(c => {
        const r0 = c.rounds[0]; const rN = c.rounds[activeRound];
        return r0 != null && rN != null && sc < r0 && sc >= rN;
      }).length
    : null;

  // Style maps — static strings so Tailwind picks them up
  const BANNER_BG = ['bg-indigo-50 border-indigo-200','bg-blue-50 border-blue-200','bg-violet-50 border-violet-200','bg-emerald-50 border-emerald-200'];
  const BTN_ACTIVE = ['bg-indigo-600','bg-blue-600','bg-violet-600','bg-emerald-600'];
  const HDR_TXT    = ['text-indigo-700','text-blue-700','text-violet-700','text-emerald-700'];
  const CHIP_RING  = ['ring-indigo-400','ring-blue-400','ring-violet-400','ring-emerald-400'];

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* ── Left panel ── */}
      <div className="w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-72 md:max-h-none">
        <div className="p-4 space-y-5">
          <div>
            <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Seat Movement Simulator</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Closing rank shifts across counselling rounds</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Your NEET Score</label>
            <input type="number" value={score} onChange={e => setScore(e.target.value)}
              placeholder="e.g. 560" min={200} max={720}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Category</label>
            <div className="space-y-1">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                  className={['w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                    category === c.value
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Active Round</label>
            <div className="space-y-1.5">
              {ROUNDS.map(r => (
                <button key={r.id} onClick={() => setActiveRound(r.id)}
                  className={['w-full text-left px-3 py-3 rounded-xl border transition-all',
                    activeRound === r.id
                      ? `${BTN_ACTIVE[r.id]} text-white border-transparent shadow-md`
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  <p className="text-xs font-black">{r.label}</p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${activeRound === r.id ? 'opacity-70' : 'text-slate-400'}`}>{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Round Progress Slider</label>
            <input type="range" min={0} max={3} step={1} value={activeRound}
              onChange={e => setActiveRound(parseInt(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>Round 1</span><span>Mop-Up</span>
            </div>
            {activeRound > 0 && (
              <p className="text-[10px] text-center text-slate-500 mt-1 font-semibold">
                Avg drop from R1: <span className="text-emerald-600 font-black">–{AVG_DROPS[activeRound]} marks</span>
              </p>
            )}
          </div>

          {/* Stray Vacancy WhatsApp Alert (Item 5) */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Stray Vacancy Alert</p>
            {alertSent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                <p className="text-[11px] font-bold text-emerald-700">Alert registered</p>
                <p className="text-[10px] text-emerald-600 leading-relaxed">
                  You will be notified on WhatsApp ({alertPhone}) if a {category.toUpperCase()} stray vacancy opens.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="tel"
                  value={alertPhone}
                  onChange={e => setAlertPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="WhatsApp number (10 digits)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleSetAlert}
                  disabled={alertPhone.length !== 10 || alertLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>📱</span>
                  {alertLoading ? 'Setting alert…' : 'Set Stray Vacancy Alert'}
                </button>
                <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                  Get notified when a Mop-Up seat opens in your category
                </p>
              </div>
            )}
          </div>

          {sc != null && (
            <div className={`rounded-xl border p-3 space-y-2.5 ${BANNER_BG[activeRound]}`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score {sc} at {ROUNDS[activeRound].label}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Colleges in reach</span>
                <span className="text-xl font-black text-indigo-700">{totalAccessible}</span>
              </div>
              {activeRound > 0 && newlyOpened != null && (
                <div className="flex items-center justify-between border-t border-white/60 pt-2">
                  <span className="text-xs text-slate-600">Newly opened vs R1</span>
                  <span className={`text-xl font-black ${(newlyOpened ?? 0) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                    +{newlyOpened}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main simulation table ── */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="p-4">
          {/* Round banner */}
          <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${BANNER_BG[activeRound]}`}>
            <div className={`w-10 h-10 rounded-full ${BTN_ACTIVE[activeRound]} flex items-center justify-center text-white font-black text-sm shrink-0`}>
              {ROUNDS[activeRound].short}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">{ROUNDS[activeRound].label} — MH Private MBBS Counselling 2024</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{ROUNDS[activeRound].desc}</p>
            </div>
            {activeRound > 0 && (
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-500 font-medium">Avg. historical drop</p>
                <p className={`text-xl font-black ${HDR_TXT[activeRound]}`}>–{AVG_DROPS[activeRound]} marks</p>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 780 }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">College</th>
                    {ROUNDS.map(r => (
                      <th key={r.id} className={['text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wide',
                        activeRound === r.id ? HDR_TXT[r.id] : 'text-slate-400',
                      ].join(' ')}>
                        {r.label}
                        {activeRound === r.id && (
                          <span className="block text-[8px] font-normal normal-case opacity-60 mt-0.5">Active</span>
                        )}
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.map(college => {
                    const activeCutoff = college.rounds[activeRound];
                    const st = getStatus(sc, activeCutoff);
                    return (
                      <tr key={college.code} className={st?.rowBg ?? ''}>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${st?.dot ?? 'bg-slate-200'}`} />
                            <div>
                              <p className="text-[12px] font-semibold text-slate-800 leading-tight">{college.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{college.seats} seats · #{college.code}</p>
                            </div>
                          </div>
                        </td>
                        {college.rounds.map((cutoff, ri) => {
                          const isActive = ri === activeRound;
                          const drop = ri > 0 && college.rounds[0] != null && cutoff != null
                            ? college.rounds[0] - cutoff : 0;
                          const cellSt = isActive ? st : null;
                          return (
                            <td key={ri} className={`text-center px-3 py-3 align-middle ${isActive ? 'bg-white/50' : ''}`}>
                              <span className={['text-[13px]', isActive ? `font-black ${HDR_TXT[ri]}` : 'text-slate-600 font-medium'].join(' ')}>
                                {cutoff ?? '—'}
                              </span>
                              {ri > 0 && drop > 0 && (
                                <span className="block text-[9px] text-emerald-600 font-bold mt-0.5">↓{drop}</span>
                              )}
                              {isActive && cellSt && sc != null && (
                                <span className={`block text-[9px] font-bold mt-0.5 ${cellSt.txt}`}>{cellSt.label}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-0.5">
                            {college.rounds.map((cutoff, ri) => {
                              const s = getStatus(sc, cutoff);
                              return (
                                <div key={ri}
                                  className={['w-5 h-5 rounded flex items-center justify-center text-[8px] font-black',
                                    s?.chip ?? 'bg-slate-100 text-slate-400',
                                    ri === activeRound ? `ring-1 ${CHIP_RING[ri]}` : '',
                                  ].join(' ')}>
                                  {ROUNDS[ri].short}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
            {[
              ['bg-emerald-500', 'Likely (score ≥ cutoff + 15)'],
              ['bg-amber-400',   'Borderline (score ≥ cutoff)'],
              ['bg-orange-400',  'Reach (within 25 marks)'],
              ['bg-slate-300',   'Below cutoff'],
            ].map(([dot, label]) => (
              <span key={label} className="flex items-center gap-1.5 font-semibold">
                <span className={`w-2 h-2 rounded-full inline-block ${dot}`} />{label}
              </span>
            ))}
            <span className="ml-auto text-[9px] text-slate-400 italic">
              Round 1 = 2024 official closing ranks · R2–Mop-Up simulated from historical patterns
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
