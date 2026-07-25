import { useState, useMemo } from 'react';
import { useCollegeData } from '../lib/useCollegeData';
import { useUser } from '../context/UserContext';
import LeadCaptureModal from '../components/LeadCaptureModal';
import { API_BASE } from '../lib/api';

const CATEGORIES = [
  { value: 'open', label: 'Open / General' },
  { value: 'obc',  label: 'OBC' },
  { value: 'sebc', label: 'SEBC (Maratha)' },
  { value: 'vjnt', label: 'VJNT / NT / SBC' },
  { value: 'sc',   label: 'SC' },
  { value: 'st',   label: 'ST' },
  { value: 'ews',  label: 'EWS' },
];

const CUTOFF_KEY   = { open:'open', obc:'obc', sebc:'sebc', vjnt:'vjnt', sc:'sc', st:'st', ews:'open' };
const FEE_KEY_MALE   = { open:'open', obc:'obc_ebc_sebc_male',   sebc:'obc_ebc_sebc_male',   vjnt:'vjnt_sbc', sc:'sc_st', st:'sc_st', ews:'open' };
const FEE_KEY_FEMALE = { open:'open', obc:'obc_ebc_sebc_female', sebc:'obc_ebc_sebc_female', vjnt:'vjnt_sbc', sc:'sc_st', st:'sc_st', ews:'open' };

function getCutoff(college, cat) {
  const c = college.cutoffs[2024];
  return c ? (c[CUTOFF_KEY[cat]] ?? c.open) : null;
}

function getFee(college, cat, gender) {
  const key = (gender === 'female' ? FEE_KEY_FEMALE : FEE_KEY_MALE)[cat] ?? 'open';
  return college.fees[key] ?? college.fees.open ?? 0;
}

function fmtL(n) {
  return `₹${(n / 100000).toFixed(1)}L`;
}

export default function ChoiceFilling() {
  const { collegeData }         = useCollegeData();
  const [score,    setScore]    = useState('');
  const [category, setCategory] = useState('open');
  const [gender,   setGender]   = useState('male');
  const [searchQ,  setSearchQ]  = useState('');
  const [choices,  setChoices]  = useState([]);
  const { profile }             = useUser();
  const [showModal, setShowModal] = useState(false);

  const sc       = parseInt(score);
  const hasScore = score !== '' && !isNaN(sc) && sc >= 200 && sc <= 720;

  const choiceSet = useMemo(() => new Set(choices.map(c => c.code)), [choices]);

  const enriched = useMemo(() =>
    choices.map(c => ({ ...c, cutoff: getCutoff(c, category), fee: getFee(c, category, gender) })),
    [choices, category, gender]
  );

  const warnPositions = useMemo(() => {
    const w = new Set();
    for (let i = 0; i < enriched.length; i++) {
      const ci = enriched[i].cutoff ?? 0;
      for (let j = i + 1; j < enriched.length; j++) {
        if ((enriched[j].cutoff ?? 0) > ci) { w.add(i); break; }
      }
    }
    return w;
  }, [enriched]);

  const available = useMemo(() => {
    const q = searchQ.toLowerCase();
    return collegeData
      .filter(c => !choiceSet.has(c.code) && (!q || c.name.toLowerCase().includes(q)))
      .map(c => ({ ...c, cutoff: getCutoff(c, category), fee: getFee(c, category, gender) }))
      .sort((a, b) => (b.cutoff ?? 0) - (a.cutoff ?? 0));
  }, [searchQ, choiceSet, category, gender]);

  function chance(cutoff) {
    if (!hasScore || cutoff == null) return null;
    if (sc >= cutoff + 15) return { l: 'Likely',     cls: 'bg-emerald-100 text-emerald-700' };
    if (sc >= cutoff)       return { l: 'Borderline', cls: 'bg-amber-100 text-amber-700' };
    if (sc >= cutoff - 25)  return { l: 'Reach',      cls: 'bg-orange-100 text-orange-700' };
    return                         { l: 'Unlikely',   cls: 'bg-rose-100 text-rose-700' };
  }

  const add      = (c)    => setChoices(p => [...p, c]);
  const remove   = (code) => setChoices(p => p.filter(c => c.code !== code));
  const moveUp   = (i)    => setChoices(p => { if (i === 0) return p; const a = [...p]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; });
  const moveDown = (i)    => setChoices(p => { if (i >= p.length - 1) return p; const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; });

  function handleSaveList() {
    if (choices.length === 0) return;
    if (!profile.isRegistered) { setShowModal(true); return; }
    fetch(`${API_BASE}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName:  profile.userName,
        phone:     profile.phone,
        userScore: hasScore ? sc : null,
        tool:      'choice-filling',
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  }

  const likelyCnt     = enriched.filter(c => hasScore && c.cutoff != null && sc >= c.cutoff + 15).length;
  const borderlineCnt = enriched.filter(c => hasScore && c.cutoff != null && sc >= c.cutoff && sc < c.cutoff + 15).length;
  const reachCnt      = enriched.filter(c => hasScore && c.cutoff != null && sc >= c.cutoff - 25 && sc < c.cutoff).length;
  const belowCnt      = enriched.filter(c => hasScore && c.cutoff != null && sc < c.cutoff - 25).length;

  return (
    <>
      {showModal && (
        <LeadCaptureModal
          onClose={() => setShowModal(false)}
          toolId="choice-filling"
          scoreHint={hasScore ? sc : null}
        />
      )}

      <div className="flex flex-col md:flex-row h-full">
        {/* ── Picker panel ── */}
        <div className="w-full md:w-72 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col overflow-hidden max-h-80 md:max-h-none">
          <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
            <div>
              <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Choice Filling Optimizer</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Build & validate your mock priority list</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Your NEET Score</label>
              <input type="number" value={score} onChange={e => setScore(e.target.value)}
                placeholder="e.g. 580" min={200} max={720}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Gender</label>
                <div className="flex gap-1">
                  {[['male','M'],['female','F']].map(([v,l]) => (
                    <button key={v} onClick={() => setGender(v)}
                      className={['px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                        gender === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'
                      ].join(' ')}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 pt-3 pb-2 shrink-0">
            <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search college name…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {available.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">All colleges added to your list</p>
            ) : available.map(c => {
              const ch = chance(c.cutoff);
              return (
                <div key={c.code} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <p className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2 mb-1.5">{c.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] text-slate-500">Cutoff <span className="font-bold text-slate-800">{c.cutoff ?? '—'}</span></p>
                      <p className="text-[10px] text-slate-500">{fmtL(c.fee)}/yr · {c.seats} seats</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {ch && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ch.cls}`}>{ch.l}</span>}
                      <button onClick={() => add(c)}
                        className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-bold transition-colors">
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Choice list panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Your Mock Choice List</p>
              <p className="text-[11px] text-slate-500">
                {choices.length === 0
                  ? 'Pick colleges from the left — Position 1 = highest preference'
                  : `${choices.length} college${choices.length > 1 ? 's' : ''} · Position 1 is your top choice`}
              </p>
            </div>
            {warnPositions.size > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 shrink-0">
                <span>⚠</span>
                <div>
                  <p className="text-[10px] font-black text-amber-800">{warnPositions.size} Ordering {warnPositions.size === 1 ? 'Risk' : 'Risks'}</p>
                  <p className="text-[9px] text-amber-600">Higher-ranked college placed below lower-ranked one</p>
                </div>
              </div>
            )}
            {choices.length > 0 && (
              <>
                <button
                  onClick={handleSaveList}
                  className={[
                    'text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0',
                    profile.isRegistered
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white',
                  ].join(' ')}
                >
                  {profile.isRegistered ? '✓ List Saved' : '💾 Save List'}
                </button>
                <button onClick={() => setChoices([])} className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors shrink-0">
                  Clear all
                </button>
              </>
            )}
          </div>

          {choices.length > 0 && (
            <div className="bg-white border-b border-slate-100 px-5 py-2 flex items-center gap-5 text-[10px] font-semibold text-slate-500 shrink-0">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Likely</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Borderline</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Reach</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />Unlikely</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {choices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
                <span className="text-5xl">📝</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">Build Your Choice List</h3>
                  <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                    Add colleges from the left panel in order of preference. Use ↑↓ to reorder. The optimizer flags when a more competitive college is ranked below a less competitive one.
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-sm text-left">
                  <p className="text-[11px] font-bold text-amber-800 mb-1">⚠ Key NEET Counselling Rule</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Place your MOST PREFERRED college at Position 1. The system gives you the highest-ranked college you qualify for — so rank your dream college first.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl space-y-2.5">
                {enriched.map((college, i) => {
                  const hasWarn = warnPositions.has(i);
                  const ch = chance(college.cutoff);
                  return (
                    <div key={college.code}
                      className={['rounded-xl border bg-white shadow-sm transition-all',
                        hasWarn ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200',
                      ].join(' ')}>

                      {hasWarn && (
                        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 rounded-t-xl">
                          <p className="text-[11px] text-amber-700 font-bold">
                            ⚠ Ordering Risk — a more competitive college (higher cutoff) is ranked below this position. You may lose that seat even if you qualify for both.
                          </p>
                        </div>
                      )}

                      <div className="px-4 py-3.5 flex items-center gap-3">
                        <div className={['w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0',
                          hasWarn ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700',
                        ].join(' ')}>
                          {i + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 leading-tight">{college.name}</p>
                          <div className="flex items-center flex-wrap gap-x-3 mt-1">
                            <span className="text-[11px] text-slate-500">
                              2024 cutoff ({category.toUpperCase()}): <strong className="text-slate-800">{college.cutoff ?? '—'}</strong>
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[11px] text-slate-500">
                              Fee: <strong className="text-indigo-600">{fmtL(college.fee)}/yr</strong>
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[11px] text-slate-400">{college.seats} seats</span>
                          </div>
                        </div>

                        {ch && (
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 ${ch.cls}`}>
                            {ch.l}
                          </span>
                        )}

                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => moveUp(i)} disabled={i === 0}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-25 transition-colors font-bold text-base leading-none">
                            ↑
                          </button>
                          <button onClick={() => moveDown(i)} disabled={i === enriched.length - 1}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-25 transition-colors font-bold text-base leading-none">
                            ↓
                          </button>
                          <button onClick={() => remove(college.code)}
                            className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-colors font-black text-lg leading-none ml-0.5">
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {enriched.length >= 2 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-3">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">List Summary</p>
                    <div className="grid grid-cols-4 gap-3 text-center mb-3">
                      {[
                        ['Likely',       likelyCnt,     'text-emerald-700'],
                        ['Borderline',   borderlineCnt, 'text-amber-700'],
                        ['Reach',        reachCnt,      'text-orange-700'],
                        ['Below cutoff', belowCnt,      'text-rose-700'],
                      ].map(([label, val, col]) => (
                        <div key={label}>
                          <p className={`text-2xl font-black ${col}`}>{val}</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide">{label}</p>
                        </div>
                      ))}
                    </div>
                    {warnPositions.size > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[11px] text-amber-700">
                        <strong>{warnPositions.size} ordering {warnPositions.size === 1 ? 'risk' : 'risks'} detected.</strong>{' '}
                        Review highlighted positions — reorder so more competitive colleges appear higher in the list.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
