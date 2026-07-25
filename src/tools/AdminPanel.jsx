import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';

const CAT_OPTIONS = ['open', 'obc', 'sebc', 'vjnt', 'sc', 'st'];

export default function AdminPanel() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const [password,    setPassword]    = useState('');
  const [unlocked,    setUnlocked]    = useState(false);
  const [adminPwd,    setAdminPwd]    = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError,   setAuthError]   = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAdminPwd(password);
        setUnlocked(true);
      } else {
        setAuthError('Invalid password — check your ADMIN_SECRET environment variable.');
      }
    } catch (_) {
      setAuthError('Server unreachable. Is the backend running?');
    }
    setAuthLoading(false);
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const [cutoffs,     setCutoffs]     = useState([]);
  const [leads,       setLeads]       = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [yearFilter,  setYearFilter]  = useState(2025);
  const [activeTab,   setActiveTab]   = useState('cutoffs');

  const loadData = useCallback(async (pwd) => {
    const key = pwd || adminPwd;
    if (!key) return;
    setDataLoading(true);
    try {
      const [cutRes, leadRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/data?year=${yearFilter}`, { headers: { 'X-Admin-Password': key } }),
        fetch(`${API_BASE}/api/admin/leads`,                   { headers: { 'X-Admin-Password': key } }),
      ]);
      if (cutRes.ok)  setCutoffs(await cutRes.json());
      if (leadRes.ok) setLeads(await leadRes.json());
    } catch (_) {}
    setDataLoading(false);
  }, [adminPwd, yearFilter]);

  useEffect(() => { if (unlocked) loadData(); }, [unlocked, yearFilter]);

  // ── Add cutoff form ──────────────────────────────────────────────────────────
  const [form,    setForm]    = useState({ college_code: '', year: 2025, category: 'open', cutoff_score: '' });
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/cutoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPwd },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setSaveMsg('✓ Cutoff entry saved.');
        setForm(f => ({ ...f, college_code: '', cutoff_score: '' }));
        loadData();
      } else {
        setSaveMsg(`Error: ${json.error}`);
      }
    } catch (_) {
      setSaveMsg('Error: Server unreachable.');
    }
    setSaving(false);
  }

  // ── Password gate ────────────────────────────────────────────────────────────
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
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter ADMIN_SECRET"
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {authError && <p className="text-rose-600 text-xs font-semibold">{authError}</p>}
            <button
              type="submit"
              disabled={authLoading || !password}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              {authLoading ? 'Verifying…' : 'Access Console →'}
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-400 mt-4">
            Access via <code className="bg-slate-100 px-1 rounded">/?tool=admin</code>
          </p>
        </div>
      </div>
    );
  }

  // ── Admin UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Sidebar — add cutoff form */}
      <div className="w-full md:w-72 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-80 md:max-h-none">
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Admin Console</p>
              <p className="text-[10px] text-slate-400">Supabase live connection</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Add Cutoff Entry</p>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">College Code</label>
                <input
                  type="text"
                  value={form.college_code}
                  onChange={e => setForm(f => ({ ...f, college_code: e.target.value }))}
                  placeholder="e.g. 1105"
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Year</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                  min={2022} max={2030}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {CAT_OPTIONS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cutoff Score</label>
                <input
                  type="number"
                  value={form.cutoff_score}
                  onChange={e => setForm(f => ({ ...f, cutoff_score: parseInt(e.target.value) }))}
                  placeholder="e.g. 651"
                  min={200} max={720}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {saveMsg && (
                <p className={`text-[11px] font-semibold ${saveMsg.startsWith('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {saveMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-2 rounded-lg transition-colors text-xs"
              >
                {saving ? 'Saving…' : 'Add Entry'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-auto bg-slate-50 p-5">
        {/* Tab + filter bar */}
        <div className="flex items-center gap-3 mb-4">
          {[['cutoffs', 'Cutoffs'], ['leads', 'Student Leads']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={['px-4 py-2 rounded-lg text-xs font-bold transition-all', activeTab === key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'].join(' ')}
            >
              {label}
            </button>
          ))}
          <div className="flex-1" />
          {activeTab === 'cutoffs' && [2022, 2023, 2024, 2025].map(y => (
            <button
              key={y}
              onClick={() => setYearFilter(y)}
              className={['px-3 py-1.5 rounded-lg text-xs font-bold transition-all', yearFilter === y ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'].join(' ')}
            >
              {y}
            </button>
          ))}
          <button
            onClick={() => loadData()}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:border-slate-300 text-slate-600"
          >
            ↻ Refresh
          </button>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Loading from Supabase…</div>
        ) : activeTab === 'cutoffs' ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm" style={{ minWidth: 620 }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">College</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Year</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cutoff</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cutoffs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center px-4 py-12 text-slate-400 text-[12px]">
                        {yearFilter === 2025
                          ? 'No 2025 entries yet — use the form to add the first one.'
                          : `No entries for ${yearFilter}. Run the seed script to populate historical data.`}
                      </td>
                    </tr>
                  ) : cutoffs.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-slate-800 leading-tight">{row.colleges?.name ?? '—'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">#{row.colleges?.code ?? '—'}</p>
                      </td>
                      <td className="text-center px-4 py-3 text-[12px] font-bold text-indigo-600">{row.year}</td>
                      <td className="text-center px-4 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full uppercase">{row.category}</span>
                      </td>
                      <td className="text-center px-4 py-3 text-[15px] font-black text-slate-900">{row.cutoff_score}</td>
                      <td className="text-center px-4 py-3 text-[10px] text-slate-400">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {cutoffs.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-2 text-right">{cutoffs.length} entries for {yearFilter}</p>
            )}
          </>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
                  <tr>
                    <td colSpan={5} className="text-center px-4 py-12 text-slate-400 text-[12px]">No leads captured yet.</td>
                  </tr>
                ) : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{lead.user_name}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">{lead.phone}</td>
                    <td className="text-center px-4 py-3 text-[13px] font-black text-indigo-700">{lead.user_score ?? '—'}</td>
                    <td className="text-center px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{lead.tool ?? '—'}</span>
                    </td>
                    <td className="text-center px-4 py-3 text-[10px] text-slate-400">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length > 0 && (
              <p className="text-[10px] text-slate-400 m-3 text-right">{leads.length} total leads</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
