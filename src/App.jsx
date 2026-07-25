import { useState } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import Sidebar from './components/Sidebar';
import NeetPredictor from './tools/NeetPredictor';
import AICounsellor from './tools/AICounsellor';
import DomicileMatrix from './tools/DomicileMatrix';
import DropYearEngine from './tools/DropYearEngine';
import ChoiceFilling from './tools/ChoiceFilling';
import SeatMovement from './tools/SeatMovement';
import ROICalculator from './tools/ROICalculator';
import AIQCutoffs from './tools/AIQCutoffs';
import AdminPanel from './tools/AdminPanel';

export const TOOLS = [
  { id: 'neet',          label: 'NEET College Predictor',     phase: 'P0', icon: '🎯', status: 'live', group: 'Phase 1' },
  { id: 'dhruv',         label: 'AI Counsellor — Dhruv',      phase: 'P0', icon: '💬', status: 'live', group: 'Phase 1' },
  { id: 'domicile',      label: 'Domicile + Quota Matrix',    phase: 'P1', icon: '📋', status: 'live', group: 'Phase 1' },
  { id: 'dropvsprivate', label: 'Drop Year vs. Private MBBS', phase: 'P1', icon: '⚖️', status: 'live', group: 'Phase 1' },
  { id: 'choicefill',    label: 'Choice Filling Optimizer',   phase: 'P2', icon: '📝', status: 'live', group: 'Phase 2' },
  { id: 'seatmove',      label: 'Seat Movement Simulator',    phase: 'P2', icon: '📊', status: 'live', group: 'Phase 2' },
  { id: 'roi',           label: 'MBBS ROI Calculator',        phase: 'P3', icon: '💰', status: 'live', group: 'Phase 2' },
  { id: 'aiq',           label: 'AIQ Cutoffs (All India)',    phase: 'P3', icon: '🇮🇳', status: 'live', group: 'Phase 2' },
];

const TOOL_MAP = {
  neet:          NeetPredictor,
  dhruv:         AICounsellor,
  domicile:      DomicileMatrix,
  dropvsprivate: DropYearEngine,
  choicefill:    ChoiceFilling,
  seatmove:      SeatMovement,
  roi:           ROICalculator,
  aiq:           AIQCutoffs,
  admin:         AdminPanel,
};

const TOOL_LABEL = Object.fromEntries(TOOLS.map(t => [t.id, t.label]));

function AppShell() {
  const [activeTool,  setActiveTool]  = useState(() => {
    const p = new URLSearchParams(window.location.search).get('tool');
    return p === 'admin' ? 'admin' : 'neet';
  });
  // Start closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const { profile } = useUser();
  const Tool = TOOL_MAP[activeTool];

  function handleToolSelect(id) {
    setActiveTool(id);
    // Auto-close the sidebar drawer on mobile after selecting a tool
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">

      {/* Mobile backdrop — tap outside sidebar to close */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        tools={TOOLS}
        activeTool={activeTool}
        onSelect={handleToolSelect}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 gap-3 z-10">
          {/* Hamburger — visible on all screen sizes when sidebar is closed, always on mobile */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-black text-[11px] tracking-[0.18em] uppercase text-indigo-600 shrink-0">
              EDUNIAA
            </span>
            {/* Active tool name on mobile, full subtitle on desktop */}
            <span className="text-[11px] text-slate-400 font-medium truncate md:hidden">
              · {TOOL_LABEL[activeTool] ?? 'Tools'}
            </span>
            <span className="w-px h-4 bg-slate-200 hidden md:block shrink-0" />
            <span className="text-[13px] text-slate-500 font-medium hidden md:block">
              Admission Prediction Tool Suite
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {profile.isRegistered ? (
              <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-full px-3 py-1.5">
                <span className="text-[11px] font-black text-indigo-700">
                  👤 {profile.userName}
                </span>
                {profile.userScore != null && (
                  <>
                    <span className="w-px h-3 bg-indigo-200" />
                    <span className="text-[11px] text-indigo-500 font-semibold">
                      Score: <strong className="text-indigo-700">{profile.userScore}</strong>
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full px-2.5 py-0.5 hidden md:inline">
                v1.0 · MH Private MBBS
              </span>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-black shrink-0">
              {profile.isRegistered ? profile.userName.charAt(0).toUpperCase() : 'E'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Tool />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppShell />
    </UserProvider>
  );
}
