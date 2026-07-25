import { useState } from 'react';
import { useUser } from '../context/UserContext';

const CATEGORIES = [
  { value: 'open',  label: 'Open (UR)'  },
  { value: 'obc',   label: 'OBC / SEBC' },
  { value: 'vjnt',  label: 'VJ / NT'    },
  { value: 'sc',    label: 'SC'         },
  { value: 'st',    label: 'ST'         },
];

export default function AuthModal({ onClose, scoreHint }) {
  const { register, login, authLoading, authError, setAuthError } = useUser();
  const [tab,   setTab]   = useState('register'); // 'register' | 'login'
  const [done,  setDone]  = useState(null);       // { pin } after successful register

  // Register fields
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [score,    setScore]    = useState(scoreHint != null ? String(scoreHint) : '');
  const [category, setCategory] = useState('open');
  const [gender,   setGender]   = useState('any');

  // Login fields
  const [lPhone, setLPhone] = useState('');
  const [lPin,   setLPin]   = useState('');

  function switchTab(t) { setTab(t); setAuthError(''); setDone(null); }

  async function handleRegister(e) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (!name.trim())         return setAuthError('Please enter your full name.');
    if (digits.length !== 10) return setAuthError('Enter a valid 10-digit phone number.');
    const result = await register({ name: name.trim(), phone: digits, userScore: score ? Number(score) : null, category, gender });
    if (result.ok) setDone({ pin: result.pin });
  }

  async function handleLogin(e) {
    e.preventDefault();
    const digits = lPhone.replace(/\D/g, '');
    if (digits.length !== 10) return setAuthError('Enter a valid 10-digit phone number.');
    if (!lPin.trim())         return setAuthError('Enter your 4-digit PIN.');
    const result = await login({ phone: digits, pin: lPin.trim() });
    if (result.ok) onClose();
  }

  return (
    <>
      <style>{`
        @keyframes auth-in {
          from { opacity:0; transform:translateY(20px) scale(0.96); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .auth-card { animation: auth-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />

        <div className="auth-card relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[90dvh]">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 pt-6 pb-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-base shrink-0">E</div>
              <div>
                <p className="text-white font-black text-sm">Eduniaa Student Profile</p>
                <p className="text-indigo-200 text-[11px]">Free · Persistent · Secure</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {[['register','Register — New Student'],['login','Login — Returning Student']].map(([t, label]) => (
                <button key={t} onClick={() => switchTab(t)}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${tab === t ? 'bg-white text-indigo-700 shadow' : 'text-white/70 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── PIN Success Screen ── */}
          {done ? (
            <div className="px-6 py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg">Profile Created!</p>
                <p className="text-slate-500 text-sm mt-1">Save your PIN — you'll need it to login next time</p>
              </div>
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6">
                <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Your 4-Digit PIN</p>
                <p className="text-5xl font-black text-indigo-700 tracking-[0.3em]">{done.pin}</p>
                <p className="text-[11px] text-indigo-400 mt-2">Screenshot this or write it down</p>
              </div>
              <button onClick={onClose}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                Got it — Take me in →
              </button>
            </div>
          ) : tab === 'register' ? (
            /* ── Register Form ── */
            <form onSubmit={handleRegister} className="px-6 py-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                  <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Sumit Kumar"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 font-semibold shrink-0">+91</div>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="98765 43210"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">NEET Score</label>
                  <input type="number" value={score} onChange={e => setScore(e.target.value)}
                    placeholder="e.g. 580" min={0} max={720}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gender</label>
                  <div className="flex gap-2">
                    {[['any','Any'],['male','Male'],['female','Female']].map(([v,l]) => (
                      <button key={v} type="button" onClick={() => setGender(v)}
                        className={`flex-1 py-2 text-[12px] font-semibold rounded-xl border transition-all ${gender === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {authError && <p className="text-rose-600 text-[12px] font-semibold">{authError}</p>}

              <button type="submit" disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {authLoading ? 'Creating profile…' : 'Create Profile & Get PIN →'}
              </button>
              <p className="text-center text-[10px] text-slate-400">Free · No spam · Your data is private</p>
            </form>
          ) : (
            /* ── Login Form ── */
            <form onSubmit={handleLogin} className="px-6 py-6 space-y-4 overflow-y-auto">
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
                Welcome back! Enter your phone number and 4-digit PIN to restore your profile, shortlist, and chat history.
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 font-semibold shrink-0">+91</div>
                  <input autoFocus type="tel" value={lPhone} onChange={e => setLPhone(e.target.value)}
                    placeholder="98765 43210"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">4-Digit PIN</label>
                <input type="text" inputMode="numeric" maxLength={4} value={lPin} onChange={e => setLPin(e.target.value.replace(/\D/g, '').slice(0,4))}
                  placeholder="• • • •"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 text-center tracking-[0.5em] font-black text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {authError && <p className="text-rose-600 text-[12px] font-semibold">{authError}</p>}

              <button type="submit" disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm">
                {authLoading ? 'Logging in…' : 'Login & Restore My Data →'}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                Forgot your PIN?{' '}
                <button type="button" onClick={() => switchTab('register')} className="text-indigo-500 font-semibold hover:underline">
                  Register again with the same number
                </button>
              </p>
            </form>
          )}

          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center text-white font-bold text-xl leading-none">
            ×
          </button>
        </div>
      </div>
    </>
  );
}
