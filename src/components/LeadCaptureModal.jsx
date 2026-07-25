import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { API_BASE } from '../lib/api';

export default function LeadCaptureModal({ onClose, toolId, scoreHint }) {
  const { register } = useUser();
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimName = name.trim();
    const digits   = phone.replace(/\D/g, '');
    if (!trimName)         { setError('Please enter your full name.'); return; }
    if (digits.length !== 10) { setError('Enter a valid 10-digit phone number.'); return; }

    setSubmitting(true);
    setError('');

    try {
      await fetch(`${API_BASE}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName:  trimName,
          phone:     digits,
          userScore: scoreHint ?? null,
          tool:      toolId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (_) {
      // non-blocking — CRM failure must never break UX
    }

    register({ userName: trimName, phone: digits, userScore: scoreHint ?? null });
    onClose();
  }

  return (
    <>
      <style>{`
        @keyframes lcm-in {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .lcm-card { animation: lcm-in 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

        {/* Card */}
        <div className="lcm-card relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">

          {/* Brand header */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-t-2xl px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-base shrink-0">
                E
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">Save Your Analysis</p>
                <p className="text-indigo-200 text-[11px]">Eduniaa Global · Free · No spam</p>
              </div>
            </div>
            <p className="text-indigo-100 text-[12px] leading-relaxed">
              Create your free student profile to unlock saved shortlists and personalised counselling recommendations.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Full Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sumit Kumar"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Phone Number
              </label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 font-semibold shrink-0">
                  +91
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="98765 43210"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {scoreHint != null && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                <span className="text-[11px] text-indigo-600 font-medium">NEET Score captured:</span>
                <span className="text-[14px] font-black text-indigo-700">{scoreHint}</span>
              </div>
            )}

            {error && (
              <p className="text-rose-600 text-[12px] font-semibold">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              {submitting ? 'Saving profile…' : 'Save My Profile & Shortlist →'}
            </button>

            <p className="text-center text-[10px] text-slate-400 leading-relaxed">
              By submitting, you agree to receive counselling updates from Eduniaa Global.
            </p>
          </form>

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center text-white font-bold text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}
