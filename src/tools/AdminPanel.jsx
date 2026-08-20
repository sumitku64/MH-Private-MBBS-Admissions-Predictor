import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const FEE_CATEGORIES = [
  { key: 'open',                label: 'Open' },
  { key: 'obc_ebc_sebc_male',   label: 'OBC/EBC/SEBC Male' },
  { key: 'obc_ebc_sebc_female', label: 'OBC/EBC/SEBC Female' },
  { key: 'vjnt_sbc',            label: 'VJ/NT/SBC' },
  { key: 'sc_st',               label: 'SC/ST' },
  { key: 'institutional',       label: 'Institutional' },
];
const CUTOFF_CATEGORIES = ['open', 'obc', 'sebc', 'vjnt', 'sc', 'st'];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];

// Default blank fee structure
const blankFees = () => FEE_CATEGORIES.map(c => ({ category: c.key, amount: '' }));
// Default one blank cutoff row
const blankCutoff = () => ({ year: 2025, category: 'open', cutoff_score: '' });

// ── Small helper components ───────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
      {children}
    </label>
  );
}
function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white ${className}`}
      {...props}
    />
  );
}
function Msg({ text }) {
  if (!text) return null;
  const ok = text.startsWith('✓');
  return <p className={`text-[11px] font-semibold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>{text}</p>;
}
function SectionTitle({ children }) {
  return <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4 mb-2 border-t border-slate-100 pt-3">{children}</p>;
}

// Ticking session-expiry countdown shown in the sidebar header
function SessionCountdown({ expiresAt }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, expiresAt - Date.now())), 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const mins = Math.floor(remaining / 60_000);
  const hrs  = Math.floor(mins / 60);
  const label = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
  const urgent = mins < 10;
  return (
    <p className={`text-[10px] font-bold tabular-nums ${urgent ? 'text-rose-500' : 'text-emerald-600'}`}>
      {label} left
    </p>
  );
}


// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPanel() {

  // ── Auth ───────────────────────────────────────────────────────────────────
  // The session token is stored in a useRef — refs are invisible to React
  // DevTools, so the token never appears in the component inspector.
  const sessionToken   = useRef(null);
  const [password,    setPassword]    = useState('');
  const [unlocked,    setUnlocked]    = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError,   setAuthError]   = useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null); // for countdown

  // Helper — returns the auth header object for every API call
  function authHeader() {
    return { 'X-Admin-Token': sessionToken.current ?? '' };
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthLoading(true); setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (res.ok && json.token) {
        sessionToken.current = json.token;        // store token in ref — NOT in state
        setPassword('');                          // immediately clear the password from memory
        setSessionExpiresAt(Date.now() + json.expiresIn);
        setUnlocked(true);
      } else {
        const msg = json.error ?? '';
        if (res.status === 429) setAuthError('Too many login attempts — please wait 15 minutes.');
        else setAuthError('Invalid password — check your ADMIN_SECRET environment variable.');
      }
    } catch (_) { setAuthError('Server unreachable. Is the backend running?'); }
    setAuthLoading(false);
  }

  // Auto-logout when session expires
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const remaining = sessionExpiresAt - Date.now();
    if (remaining <= 0) { sessionToken.current = null; setUnlocked(false); return; }
    const t = setTimeout(() => {
      sessionToken.current = null;
      setUnlocked(false);
      setAuthError('Your session expired. Please log in again.');
    }, remaining);
    return () => clearTimeout(t);
  }, [sessionExpiresAt]);

  // ── Table data ─────────────────────────────────────────────────────────────
  const [cutoffs,     setCutoffs]     = useState([]);
  const [leads,       setLeads]       = useState([]);
  const [colList,     setColList]     = useState([]);
  const [feeList,     setFeeList]     = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [yearFilter,  setYearFilter]  = useState(2025);
  const [activeTab,   setActiveTab]   = useState('cutoffs');

  const loadTableData = useCallback(async () => {
    if (!sessionToken.current) return;
    setDataLoading(true);
    const H = authHeader();
    try {
      const [cutRes, leadRes, colRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/data?year=${yearFilter}`, { headers: H }),
        fetch(`${API_BASE}/api/admin/leads`,                   { headers: H }),
        fetch(`${API_BASE}/api/admin/colleges`,                { headers: H }),
      ]);
      if (cutRes.ok)  setCutoffs(await cutRes.json());
      if (leadRes.ok) setLeads(await leadRes.json());
      if (colRes.ok)  { const d = await colRes.json(); setColList(d.colleges||[]); setFeeList(d.fees||[]); }
    } catch (_) {}
    setDataLoading(false);
  }, [yearFilter]);

  useEffect(() => { if (unlocked) loadTableData(); }, [unlocked, yearFilter, loadTableData]);

  // ── Sidebar mode: 'add' | 'edit' ──────────────────────────────────────────
  const [mode, setMode] = useState('add');

  // ── Shared college form state ──────────────────────────────────────────────
  const emptyForm = () => ({ code: '', name: '', seats: '', fees: blankFees(), cutoffs: [blankCutoff()] });
  const [form,    setForm]    = useState(emptyForm());
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })); }
  function setFeeAmt(idx, val) {
    setForm(f => { const fees = [...f.fees]; fees[idx] = { ...fees[idx], amount: val }; return { ...f, fees }; });
  }
  function setCutoffField(idx, key, val) {
    setForm(f => { const cutoffs = [...f.cutoffs]; cutoffs[idx] = { ...cutoffs[idx], [key]: val }; return { ...f, cutoffs }; });
  }
  function addCutoffRow()    { setForm(f => ({ ...f, cutoffs: [...f.cutoffs, blankCutoff()] })); }
  function removeCutoffRow(idx) { setForm(f => ({ ...f, cutoffs: f.cutoffs.filter((_, i) => i !== idx) })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/colleges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg(`✓ Saved! (${json.saved?.fees ?? 0} fees, ${json.saved?.cutoffs ?? 0} cutoffs)`);
        if (mode === 'add') setForm(emptyForm());
        loadTableData();
      } else setSaveMsg(`Error: ${json.error}`);
    } catch (_) { setSaveMsg('Error: Server unreachable.'); }
    setSaving(false);
  }

  // ── Search (Edit mode) ─────────────────────────────────────────────────────
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const searchTimer = useRef(null);

  function onQueryChange(val) {
    setQuery(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/search?q=${encodeURIComponent(val)}`, {
          headers: authHeader(),
        });
        if (res.ok) setSuggestions(await res.json());
      } catch (_) {}
      setSearching(false);
    }, 300);
  }

  async function loadForEdit(code) {
    setSuggestions([]);
    setQuery('');
    setSaveMsg('');
    setLoadingEdit(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/college/${code}`, {
        headers: authHeader(),
      });
      if (!res.ok) { setSaveMsg('Error: College not found.'); setLoadingEdit(false); return; }
      const { college, fees, cutoffs } = await res.json();

      // Build fee array: start with blanks, fill in existing values
      const feeMap = Object.fromEntries(fees.map(f => [f.category, f.amount]));
      const hydratedFees = FEE_CATEGORIES.map(c => ({ category: c.key, amount: feeMap[c.key] ?? '' }));
      const hydratedCutoffs = cutoffs.length > 0 ? cutoffs : [blankCutoff()];

      setForm({ code: college.code, name: college.name, seats: college.seats ?? '', fees: hydratedFees, cutoffs: hydratedCutoffs });
    } catch (_) { setSaveMsg('Error: Server unreachable.'); }
    setLoadingEdit(false);
  }

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black">E</div>
            <div>
              <p className="font-black text-slate-900 text-sm">Eduniaa Admin Console</p>
              <p className="text-[11px] text-slate-400">Database management · Restricted access</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Admin Password</Label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter ADMIN_SECRET" autoFocus
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {authError && <p className="text-rose-600 text-xs font-semibold">{authError}</p>}
            <button type="submit" disabled={authLoading || !password}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm">
              {authLoading ? 'Verifying…' : 'Access Console →'}
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-4">Access via <code className="bg-slate-100 px-1 rounded">/?tool=admin</code></p>
        </div>
      </div>
    );
  }

  // ── College form (shared by Add and Edit modes) ───────────────────────────
  const CollegeForm = (
    <form onSubmit={handleSave} className="space-y-1">
      {/* College Info */}
      <SectionTitle>College Info</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Code *</Label>
          <Input value={form.code} onChange={e => setField('code', e.target.value)} placeholder="e.g. 1105" required disabled={mode === 'edit' && !!form.code} />
        </div>
        <div>
          <Label>Total Seats</Label>
          <Input type="number" value={form.seats} onChange={e => setField('seats', e.target.value)} placeholder="e.g. 150" />
        </div>
      </div>
      <div>
        <Label>College Name *</Label>
        <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Grant Medical College, Mumbai" required />
      </div>

      {/* Fees */}
      <SectionTitle>Fee Structure (₹)</SectionTitle>
      <p className="text-[10px] text-slate-400 mb-2">Leave blank to skip saving that category</p>
      <div className="space-y-2">
        {form.fees.map((fee, idx) => {
          const cat = FEE_CATEGORIES.find(c => c.key === fee.category);
          return (
            <div key={fee.category} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 w-32 shrink-0 leading-tight">{cat?.label}</span>
              <Input type="number" value={fee.amount} onChange={e => setFeeAmt(idx, e.target.value)} placeholder="Amount in ₹" min={0} />
            </div>
          );
        })}
      </div>

      {/* Cutoffs */}
      <SectionTitle>Historical Cutoffs</SectionTitle>
      <p className="text-[10px] text-slate-400 mb-2">Add one row per year+category combination</p>
      <div className="space-y-2">
        {form.cutoffs.map((row, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <Input
              type="number"
              value={row.year}
              onChange={e => setCutoffField(idx, 'year', e.target.value)}
              placeholder="Year"
              min={2010} max={2030}
              className="w-20"
            />
            <select value={row.category} onChange={e => setCutoffField(idx, 'category', e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white flex-1">
              {CUTOFF_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <Input type="number" value={row.cutoff_score} onChange={e => setCutoffField(idx, 'cutoff_score', e.target.value)}
              placeholder="Score" min={200} max={720} className="w-20" />
            <button type="button" onClick={() => removeCutoffRow(idx)}
              className="text-slate-300 hover:text-rose-500 font-bold text-sm leading-none transition-colors px-1">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addCutoffRow}
        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold mt-1">+ Add Cutoff Row</button>

      {/* Submit */}
      <div className="pt-3">
        <Msg text={saveMsg} />
        <button type="submit" disabled={saving}
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition-colors text-xs">
          {saving ? 'Saving…' : mode === 'add' ? '✓ Add College to Database' : '✓ Save Changes'}
        </button>
      </div>
    </form>
  );

  // ── Admin UI ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row h-full">

      {/* ── Sidebar ── */}
      <div className="w-full md:w-80 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-[50vh] md:max-h-none">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Admin Console</p>
                <p className="text-[10px] text-slate-400">Supabase live connection</p>
              </div>
            </div>
            {sessionExpiresAt && (
              <div className="text-right shrink-0">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Session</p>
                <SessionCountdown expiresAt={sessionExpiresAt} />
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button onClick={() => { setMode('add'); setForm(emptyForm()); setSaveMsg(''); }}
              className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${mode === 'add' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              ＋ Add New College
            </button>
            <button onClick={() => { setMode('edit'); setForm(emptyForm()); setSaveMsg(''); setQuery(''); setSuggestions([]); }}
              className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${mode === 'edit' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
              ✎ Search & Edit
            </button>
          </div>

          {/* Edit mode — search */}
          {mode === 'edit' && (
            <div className="mb-4">
              <Label>Search by College Name or Code</Label>
              <div className="relative">
                <Input
                  value={query}
                  onChange={e => onQueryChange(e.target.value)}
                  placeholder="Type college name or code…"
                />
                {searching && <p className="text-[10px] text-slate-400 mt-1">Searching…</p>}
                {suggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                    {suggestions.map(s => (
                      <button key={s.code} type="button" onClick={() => loadForEdit(s.code)}
                        className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-slate-100 last:border-0">
                        <p className="text-[12px] font-semibold text-slate-800 leading-tight">{s.name}</p>
                        <p className="text-[10px] text-slate-400">Code #{s.code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {loadingEdit && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Loading college data…
                </div>
              )}
              {mode === 'edit' && !form.code && !loadingEdit && (
                <p className="text-[11px] text-slate-400 mt-3 text-center">Search for a college above to load its data</p>
              )}
            </div>
          )}

          {/* Form — show in Add mode always, in Edit mode only once a college is loaded */}
          {(mode === 'add' || (mode === 'edit' && form.code)) && CollegeForm}
        </div>
      </div>

      {/* ── Main panel — data tables ── */}
      <div className="flex-1 overflow-auto bg-slate-50 p-5">
        {/* Tab + filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[['cutoffs', 'Cutoffs'], ['colleges', 'Colleges & Fees'], ['leads', 'Student Leads']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'}`}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          {activeTab === 'cutoffs' && (
            <select
              value={yearFilter}
              onChange={e => setYearFilter(parseInt(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button onClick={loadTableData} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:border-slate-300 text-slate-600">↻ Refresh</button>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading from Supabase…</div>

        ) : activeTab === 'cutoffs' ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 580 }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">College</th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Year</th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cutoff</th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cutoffs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center px-4 py-12 text-slate-400 text-[12px]">
                      {yearFilter === 2025 ? 'No 2025 entries yet — use the Add form.' : `No entries for ${yearFilter}.`}
                    </td></tr>
                  ) : cutoffs.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="text-[12px] font-semibold text-slate-800 leading-tight">{row.colleges?.name ?? '—'}</p>
                        <p className="text-[10px] text-slate-400">#{row.colleges?.code ?? '—'}</p>
                      </td>
                      <td className="text-center px-3 py-2.5 text-[12px] font-bold text-indigo-600">{row.year}</td>
                      <td className="text-center px-3 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase">{row.category}</span>
                      </td>
                      <td className="text-center px-3 py-2.5 text-[15px] font-black text-slate-900">{row.cutoff_score}</td>
                      <td className="text-center px-3 py-2.5">
                        <button onClick={() => { setMode('edit'); loadForEdit(row.colleges?.code); }}
                          className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cutoffs.length > 0 && <p className="text-[10px] text-slate-400 mt-2 text-right">{cutoffs.length} entries for {yearFilter}</p>}
          </>

        ) : activeTab === 'colleges' ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Code</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Seats</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Fees</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colList.length === 0 ? (
                  <tr><td colSpan={5} className="text-center px-4 py-12 text-slate-400 text-[12px]">No colleges found.</td></tr>
                ) : colList.map(col => {
                  const colFees = feeList.filter(f => f.college_code === col.code);
                  return (
                    <tr key={col.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-indigo-700">{col.code}</td>
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">{col.name}</td>
                      <td className="text-center px-4 py-2.5 text-[12px] text-slate-600">{col.seats ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {colFees.map(f => (
                            <span key={f.category} className="text-[9px] font-medium px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                              {f.category}: ₹{Number(f.amount).toLocaleString('en-IN')}
                            </span>
                          ))}
                          {colFees.length === 0 && <span className="text-[10px] text-slate-400">No fees set</span>}
                        </div>
                      </td>
                      <td className="text-center px-4 py-2.5">
                        <button onClick={() => { setMode('edit'); loadForEdit(col.code); }}
                          className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {colList.length > 0 && <p className="text-[10px] text-slate-400 m-3 text-right">{colList.length} total colleges</p>}
          </div>

        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Phone</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Score</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tool</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.length === 0 ? (
                  <tr><td colSpan={5} className="text-center px-4 py-12 text-slate-400 text-[12px]">No leads captured yet.</td></tr>
                ) : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">{lead.user_name}</td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600">{lead.phone}</td>
                    <td className="text-center px-4 py-2.5 text-[13px] font-black text-indigo-700">{lead.user_score ?? '—'}</td>
                    <td className="text-center px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{lead.tool ?? '—'}</span>
                    </td>
                    <td className="text-center px-4 py-2.5 text-[10px] text-slate-400">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length > 0 && <p className="text-[10px] text-slate-400 m-3 text-right">{leads.length} total leads</p>}
          </div>
        )}
      </div>
    </div>
  );
}
