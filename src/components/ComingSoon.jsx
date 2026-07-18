const PHASE_COLORS = {
  P2: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500' },
  P3: { bg: 'bg-rose-50',  border: 'border-rose-200',  text: 'text-rose-700',  badge: 'bg-rose-500' },
};

export default function ComingSoon({ icon, title, phase, description, features, eta }) {
  const c = PHASE_COLORS[phase] || PHASE_COLORS.P2;

  return (
    <div className="min-h-full flex items-center justify-center p-8 bg-slate-50">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Top accent */}
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

          <div className="p-8">
            {/* Icon + phase */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-4xl">{icon}</span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${c.badge}`}>{phase}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">In Development</span>
                </div>
                <h2 className="text-xl font-black text-slate-900">{title}</h2>
              </div>
            </div>

            <p className="text-slate-600 text-sm leading-relaxed mb-6">{description}</p>

            {/* Features list */}
            <div className={`rounded-xl border p-4 mb-6 ${c.bg} ${c.border}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wider mb-3 ${c.text}`}>Planned Features</p>
              <ul className="space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className={`mt-0.5 text-[10px] font-black ${c.text}`}>—</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* ETA */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-slate-500 font-medium">Expected: <strong className="text-slate-700">{eta}</strong></span>
              </div>
              <button
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                onClick={() => {}}
              >
                Notify Me
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Phase 1 tools are live now — explore the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
