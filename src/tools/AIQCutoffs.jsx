import { useState, useMemo } from 'react';
import { useAiqData } from '../lib/useAiqData';

const COURSES = [
  { value: 'mbbs',    label: 'MBBS' },
  { value: 'bds',     label: 'BDS' },
  { value: 'nursing', label: 'BSc Nursing' },
];

const CAT_ORDER  = ['UR', 'OBC', 'EWS', 'SC', 'ST'];
const YEARS      = [2025, 2024, 2023, 2022];
const ROUNDS     = [1, 2, 3, 4, 5];

const CAT_COLORS = {
  UR:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  OBC: 'bg-teal-50 text-teal-700 border-teal-200',
  EWS: 'bg-amber-50 text-amber-700 border-amber-200',
  SC:  'bg-violet-50 text-violet-700 border-violet-200',
  ST:  'bg-rose-50 text-rose-700 border-rose-200',
};

const fmt = n => (n == null ? '—' : n.toLocaleString('en-IN'));

export default function AIQCutoffs() {
  const [view,   setView]   = useState('rounds');   // 'rounds' | 'states'
  const [course, setCourse] = useState('mbbs');
  const [state,  setState]  = useState('ALL INDIA');
  const { aiq, loading } = useAiqData();

  const stateList = useMemo(() => {
    if (!aiq?.states?.length) return ['ALL INDIA'];
    const set = new Set(aiq.states.map(r => r.state));
    const list = [...set].filter(s => s !== 'ALL INDIA').sort();
    return ['ALL INDIA', ...list];
  }, [aiq]);

  // rounds view: { UR: {1: {air, score}, ...}, ... }
  const roundGrid = useMemo(() => {
    const grid = {};
    (aiq?.rounds ?? []).filter(r => r.course === course).forEach(r => {
      if (!grid[r.category]) grid[r.category] = {};
      grid[r.category][r.round] = { air: r.air, score: r.score };
    });
    return grid;
  }, [aiq, course]);

  // states view: { UR: {2025: {last_rank, score}, ...}, ... }
  const stateGrid = useMemo(() => {
    const grid = {};
    (aiq?.states ?? []).filter(r => r.state === state).forEach(r => {
      if (!grid[r.category]) grid[r.category] = {};
      grid[r.category][r.year] = { last_rank: r.last_rank, score: r.score };
    });
    return grid;
  }, [aiq, state]);

  const hasData = view === 'rounds'
    ? Object.keys(roundGrid).length > 0
    : Object.keys(stateGrid).length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full">

      {/* ── Left controls panel ── */}
      <div className="w-full md:w-72 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-5 overflow-y-auto max-h-80 md:max-h-none">
        <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">AIQ Cutoffs</h2>
        <p className="text-[11px] text-slate-400 mt-0.5 mb-5">All India Quota · MCC counselling data</p>

        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">View</p>
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setView('rounds')}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${view === 'rounds' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
          >
            Round-wise 2025
          </button>
          <button
            onClick={() => setView('states')}
            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${view === 'states' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
          >
            State-wise
          </button>
        </div>

        {view === 'rounds' ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Course</p>
            <div className="flex flex-wrap gap-2">
              {COURSES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCourse(c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${course === c.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">State / UT</p>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {stateList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}

        <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {view === 'rounds'
              ? 'Closing All India Rank (AIR) and NEET score for each MCC counselling round, 2025 session.'
              : 'Last allotted rank and score under 15% All India Quota in government medical colleges, year-wise.'}
          </p>
        </div>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mb-4">
          <h3 className="font-black text-slate-900 text-base">
            {view === 'rounds'
              ? `All India Quota ${COURSES.find(c => c.value === course)?.label} — Round-Wise Cutoff 2025`
              : `${state} — All India Quota MBBS Cutoff (Year-wise)`}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Closing AIR · corresponding NEET score</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 text-sm py-10 justify-center">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading AIQ data…
          </div>
        ) : !hasData ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm font-bold text-slate-600">No data available</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {view === 'states'
                ? 'No AIQ records for this state yet.'
                : 'Run supabase_migration4_aiq.sql in the Supabase SQL Editor to load AIQ data.'}
            </p>
          </div>
        ) : view === 'rounds' ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-black text-slate-500 uppercase tracking-wide text-[10px]">Category</th>
                  {ROUNDS.map(r => (
                    <th key={r} colSpan={2} className="px-3 py-3 font-black text-slate-500 uppercase tracking-wide text-[10px] text-center border-l border-slate-100">
                      Round {r}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50/60 border-b border-slate-200">
                  <th className="px-4 py-1.5" />
                  {ROUNDS.map(r => (
                    <_SubHead key={r} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAT_ORDER.filter(c => roundGrid[c]).map(cat => (
                  <tr key={cat} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CAT_COLORS[cat]}`}>{cat}</span>
                    </td>
                    {ROUNDS.map(r => (
                      <RoundCell key={r} cell={roundGrid[cat][r]} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-black text-slate-500 uppercase tracking-wide text-[10px]">Category</th>
                  {YEARS.map(y => (
                    <th key={y} colSpan={2} className="px-3 py-3 font-black text-slate-500 uppercase tracking-wide text-[10px] text-center border-l border-slate-100">
                      {y}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50/60 border-b border-slate-200">
                  <th className="px-4 py-1.5" />
                  {YEARS.map(y => (
                    <_SubHead key={y} rankLabel="Last Rank" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAT_ORDER.filter(c => stateGrid[c]).map(cat => (
                  <tr key={cat} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CAT_COLORS[cat]}`}>{cat}</span>
                    </td>
                    {YEARS.map(y => {
                      const cell = stateGrid[cat][y];
                      return (
                        <RoundCell key={y} cell={cell && { air: cell.last_rank, score: cell.score }} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-3 italic">
          Source: MCC AIQ counselling records. Scores across years are not directly comparable — NEET difficulty varies by year.
        </p>
      </div>
    </div>
  );
}

function _SubHead({ rankLabel = 'AIR' }) {
  return (
    <>
      <th className="px-3 py-1.5 text-[9px] font-bold text-slate-400 text-center border-l border-slate-100">{rankLabel}</th>
      <th className="px-3 py-1.5 text-[9px] font-bold text-slate-400 text-center">Score</th>
    </>
  );
}

function RoundCell({ cell }) {
  return (
    <>
      <td className="px-3 py-3 text-center text-slate-700 font-semibold border-l border-slate-100 tabular-nums">{fmt(cell?.air)}</td>
      <td className="px-3 py-3 text-center tabular-nums">
        {cell?.score != null
          ? <span className="font-black text-slate-900">{cell.score}</span>
          : <span className="text-slate-300">—</span>}
      </td>
    </>
  );
}
