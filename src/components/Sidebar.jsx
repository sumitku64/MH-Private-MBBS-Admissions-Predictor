const BADGE = {
  P0: 'bg-emerald-500 text-white',
  P1: 'bg-blue-500 text-white',
  P2: 'bg-amber-500 text-white',
  P3: 'bg-rose-500 text-white',
};

function NavItem({ tool, isActive, open, onSelect }) {
  const isComingSoon = tool.status === 'coming';

  return (
    <button
      onClick={() => onSelect(tool.id)}
      title={!open ? tool.label : undefined}
      className={[
        'w-full flex items-center rounded-lg transition-all duration-150 text-left',
        open ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5',
        isActive
          ? 'bg-indigo-600 text-white shadow-[0_2px_10px_rgba(79,70,229,0.4)]'
          : isComingSoon
            ? 'text-slate-600 hover:bg-white/[0.04] cursor-pointer'
            : 'text-slate-400 hover:bg-white/[0.07] hover:text-white',
      ].join(' ')}
    >
      <span className="text-[17px] leading-none shrink-0">{tool.icon}</span>
      {open && (
        <>
          <span className="flex-1 min-w-0">
            <span className={[
              'block text-[12.5px] font-semibold leading-tight truncate',
              isActive ? 'text-white' : isComingSoon ? 'text-slate-500' : 'text-slate-300',
            ].join(' ')}>
              {tool.label}
            </span>
            {isComingSoon && (
              <span className="text-[9.5px] text-slate-600 font-medium uppercase tracking-wide">
                Coming soon
              </span>
            )}
          </span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 leading-none ${BADGE[tool.phase]}`}>
            {tool.phase}
          </span>
        </>
      )}
    </button>
  );
}

export default function Sidebar({ tools, activeTool, onSelect, open, onToggle }) {
  const groups = [
    { label: 'Phase 1 — Live', items: tools.filter(t => t.group === 'Phase 1') },
    { label: 'Phase 2 — Live', items: tools.filter(t => t.group === 'Phase 2') },
  ];

  return (
    <aside
      className={[
        // Base styles
        'flex flex-col shrink-0 overflow-hidden border-r border-white/[0.05]',
        'transition-all duration-200 ease-out',
        // Mobile: fixed full-height drawer that slides in/out
        'fixed inset-y-0 left-0 z-50',
        open ? 'translate-x-0' : '-translate-x-full',
        // Desktop: static inline panel, translation always reset to 0
        'md:relative md:inset-y-auto md:left-auto md:z-auto md:translate-x-0',
      ].join(' ')}
      style={{
        width:      open ? 224 : 58,
        background: '#0d1117',
        // On mobile always show at full 224px width when open; the translate handles hide/show
        minWidth:   typeof window !== 'undefined' && window.innerWidth < 768 ? 224 : undefined,
      }}
    >
      {/* Brand */}
      <div className="h-14 shrink-0 border-b border-white/[0.07] flex items-center px-3.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white font-black text-sm shrink-0">
            E
          </div>
          {open && (
            <div className="overflow-hidden">
              <p className="text-white text-[11px] font-black tracking-widest leading-none uppercase">Eduniaa</p>
              <p className="text-indigo-400/60 text-[9px] font-medium tracking-[0.2em] leading-none mt-0.5 uppercase">Global</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-5">
        {groups.map(group => (
          <div key={group.label}>
            {open && (
              <p className="px-3.5 mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                {group.label}
              </p>
            )}
            <div className={open ? 'px-2 space-y-0.5' : 'px-1.5 space-y-0.5'}>
              {group.items.map(tool => (
                <NavItem
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  open={open}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle — desktop only; on mobile the backdrop handles close */}
      <div className="shrink-0 p-2 border-t border-white/[0.07] hidden md:block">
        <button
          onClick={onToggle}
          className="w-full h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
        >
          {open ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </aside>
  );
}
