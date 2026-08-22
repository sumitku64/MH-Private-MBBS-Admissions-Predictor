import { useState, useMemo, useEffect } from 'react';
import { Download, Settings, ChevronLeft, ChevronRight, TrendingDown } from 'lucide-react';
import { useCollegeData } from '../lib/useCollegeData';
import { simulateRoundCutoffs, calculateAllocationStatus } from '../lib/simulator';
import { useUser } from '../context/UserContext';
import { CATEGORIES } from '../data';

export default function RoundwiseAnalysis() {
  const { collegeData } = useCollegeData();
  const { profile } = useUser();
  
  // State — auto-synced from profile on auth changes, then user-editable (What-If)
  const [userScore, setUserScore] = useState(() => profile?.userScore ? Number(profile.userScore) : 650);
  const [category, setCategory] = useState(() => profile?.category ?? 'open');
  const [activeRound, setActiveRound] = useState('r2');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Identity-aware profile sync
  const [hydratedUserId, setHydratedUserId] = useState(() => profile?.isRegistered ? profile.google_id : null);

  useEffect(() => {
    const currentAuth = profile?.isRegistered ? profile.google_id : null;
    
    if (currentAuth !== hydratedUserId) {
      if (currentAuth) {
        setUserScore(profile.userScore ? Number(profile.userScore) : 650);
        setCategory(profile.category ?? 'open');
      } else {
        setUserScore(650);
        setCategory('open');
      }
      setHydratedUserId(currentAuth);
    }
  }, [profile?.isRegistered, profile?.google_id, profile?.userScore, profile?.category, hydratedUserId]);
  
  // Calculate dynamic metrics across all colleges
  const analysisData = useMemo(() => {
    let totalSeats = 0;
    let safeCount = 0;
    let maxProb = 0;
    let totalDrop = 0;

    const mapped = collegeData.map(c => {
      const baseCutoff = c.cutoffs?.[2024]?.[category] ?? c.cutoffs?.[2024]?.open ?? 600;
      totalSeats += c.seats || 0;
      const status = calculateAllocationStatus(userScore, baseCutoff);
      
      const r1Score = status.rounds.r1;
      const currentScore = status.rounds[activeRound] || status.rounds.r1;
      const diff = r1Score - currentScore;
      
      totalDrop += diff;

      // Safe count based on the SELECTED round
      if (userScore >= currentScore) {
        safeCount++;
      }
      
      // Probability based on the existing overall percentage since round-specific percentages don't exist
      if (status.overallPercentage > maxProb) {
        maxProb = status.overallPercentage;
      }

      return {
        ...c,
        baseCutoff,
        status,
        currentScore,
        diff
      };
    }).sort((a, b) => {
      // Sort by whether they are in range for the current round, then by probability
      const aSafe = userScore >= a.currentScore ? 1 : 0;
      const bSafe = userScore >= b.currentScore ? 1 : 0;
      if (aSafe !== bSafe) return bSafe - aSafe;
      return b.status.overallPercentage - a.status.overallPercentage;
    });

    const avgDrop = collegeData.length ? Math.round(totalDrop / collegeData.length) : 0;
    
    let statusLabel = 'Risk';
    let statusSub = 'Need higher score';
    // Status relative to the selected round count
    if (safeCount > Math.floor(collegeData.length * 0.5)) { 
      statusLabel = 'Safe'; 
      statusSub = `For ${safeCount} Colleges`; 
    } else if (safeCount > 0) { 
      statusLabel = 'Borderline'; 
      statusSub = `For ${safeCount} Colleges`; 
    }

    return { 
      mapped, 
      metrics: { 
        avgDrop, 
        safeCount, 
        totalSeats, 
        maxProb,
        statusLabel,
        statusSub
      } 
    };
  }, [collegeData, userScore, category, activeRound]);

  const { mapped: allColleges, metrics } = analysisData;
  
  // Pagination
  const totalPages = Math.ceil(allColleges.length / rowsPerPage);
  const displayColleges = allColleges.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const renderProbabilityBar = (percentage) => {
    let colorClass = 'bg-rose-500';
    if (percentage >= 80) colorClass = 'bg-[#1D4ED8]'; // Deep blue from Figma
    else if (percentage >= 50) colorClass = 'bg-[#B45309]'; // Amber brown

    return (
      <div className="flex items-center gap-3 w-32">
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex-1">
          <div className={`h-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <span className="text-xs font-medium text-slate-700 w-8">{percentage}%</span>
      </div>
    );
  };

  const getShiftBadge = (diff) => {
    if (diff === 0) return <span className="text-slate-400 text-sm">-</span>;
    const isDrop = diff > 0; // In score terms, a drop means R1 was higher than R2
    return (
      <span className="inline-flex items-center gap-1 bg-[#E0F2FE] text-[#0284C7] text-xs font-bold px-2.5 py-1 rounded-md">
        {isDrop ? '↓' : '↑'} {Math.abs(diff)}
      </span>
    );
  };

  const roundName = activeRound === 'r1' ? '1' : activeRound === 'r2' ? '2' : activeRound === 'r3' ? '3' : 'Mop-up';

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 min-h-screen bg-[#F8FAFC]">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold text-[#0F172A] tracking-tight mb-3">Round-wise Analysis</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Track cutoff shifts, closing ranks, and seat movements across counseling rounds.
          </p>
        </div>
        
        {/* Round Selector Pill */}
        <div className="flex bg-[#EEF2FF] p-1.5 rounded-full shadow-inner shrink-0 max-w-full overflow-x-auto hide-scrollbar">
          <button style={{whiteSpace: "nowrap"}} onClick={() => { setActiveRound('r1'); setCurrentPage(1); }} className={`px-4 md:px-6 py-2.5 text-sm font-medium rounded-full transition-colors ${activeRound === 'r1' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-[#4F46E5] hover:text-[#3730A3]'}`}>Round 1</button>
          <button style={{whiteSpace: "nowrap"}} onClick={() => { setActiveRound('r2'); setCurrentPage(1); }} className={`px-4 md:px-6 py-2.5 text-sm font-medium rounded-full transition-colors ${activeRound === 'r2' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-[#4F46E5] hover:text-[#3730A3]'}`}>Round 2</button>
          <button style={{whiteSpace: "nowrap"}} onClick={() => { setActiveRound('r3'); setCurrentPage(1); }} className={`px-4 md:px-6 py-2.5 text-sm font-medium rounded-full transition-colors ${activeRound === 'r3' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-[#4F46E5] hover:text-[#3730A3]'}`}>Round 3</button>
          <button style={{whiteSpace: "nowrap"}} onClick={() => { setActiveRound('mopUp'); setCurrentPage(1); }} className={`px-4 md:px-6 py-2.5 text-sm font-medium rounded-full transition-colors ${activeRound === 'mopUp' ? 'bg-[#1D4ED8] text-white shadow-sm' : 'text-[#4F46E5] hover:text-[#3730A3]'}`}>Mop-up</button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" /> Average Cutoff Drop
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-[#0F172A]">{metrics.avgDrop}</span>
            <span className="text-[10px] font-bold text-[#EF4444]">↓ Points</span>
          </div>
        </div>
        
        <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19h16M4 15V9c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4v6M8 19v2M16 19v2" /></svg> 
            Seats Remaining
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-[#0F172A]">{metrics.totalSeats.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 font-medium">Across Data</span>
          </div>
        </div>

        <div className="bg-[#EEF2FF] p-6 rounded-2xl border border-[#E0E7FF] shadow-sm flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14l9-5-9-5-9 5 9 5zm0 0v10M5 10v9M19 10v9"/></svg>
            Colleges in Range
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-[#0F172A]">{metrics.safeCount}</span>
            <span className="text-[10px] font-bold text-[#2563EB]">↑ Based on Score</span>
          </div>
        </div>

        <div className="bg-[#1D4ED8] p-6 rounded-2xl shadow-md flex flex-col justify-center text-white relative">
          <div className="text-xs font-medium text-blue-200 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Your Status
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{metrics.statusLabel}</span>
            <span className="text-[10px] font-medium text-blue-200">{metrics.statusSub}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-12 gap-8">
        
        {/* Sidebar Filters */}
        <div className="md:col-span-4 lg:col-span-3 space-y-6">
           <div className="bg-white p-6 rounded-[20px] shadow-sm">
             <h3 className="font-bold text-[#0F172A] mb-6 text-lg">Filters</h3>
             
             <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Institute Type</label>
                  <select disabled className="w-full px-3 py-2.5 bg-[#F8FAFC] border-none rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-not-allowed opacity-80">
                    <option>All Types</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">State</label>
                  <select disabled className="w-full px-3 py-2.5 bg-[#F8FAFC] border-none rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-not-allowed opacity-80">
                    <option>All States</option>
                  </select>
                </div>

                {/* Score and Category (Must keep functional) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">NEET Score</label>
                  <input type="number" value={userScore} onChange={e => setUserScore(Number(e.target.value))} className="w-full px-3 py-2.5 bg-[#F8FAFC] border-none rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2.5 bg-[#F8FAFC] border-none rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-100">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                {/* Visual tolerance slider from Figma */}
                <div className="pt-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Rank Range Tolerance</span>
                    <span className="text-[#0F172A] font-bold">±500</span>
                  </label>
                  <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full mt-3">
                    <div className="h-full bg-[#93C5FD] rounded-full w-[40%]"></div>
                  </div>
                </div>
             </div>
           </div>
           
           <div className="bg-[#F3F4F6] p-6 rounded-[20px]">
             <div className="text-sm font-bold text-[#111827] mb-2">Pro Tip</div>
             <p className="text-xs text-slate-500 leading-relaxed">Round 2 historically sees an average drop in cutoff ranks for top-tier government colleges. Stay alert and track shifts closely.</p>
           </div>
        </div>

        {/* Data Table */}
        <div className="md:col-span-8 lg:col-span-9 min-w-0">
          <div className="bg-white rounded-[20px] shadow-sm flex flex-col h-full overflow-hidden min-w-0 w-full">
            
            <div className="p-6 border-b border-[#F1F5F9] flex justify-between items-center bg-[#F8FAFC]">
              <h2 className="text-lg font-semibold text-[#0F172A]">College Cutoff Analysis</h2>
              <div className="flex gap-4 text-slate-500">
                <button className="hover:text-[#0F172A] transition-colors"><Download className="w-5 h-5" /></button>
                <button className="hover:text-[#0F172A] transition-colors"><Settings className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-[#F1F5F9] text-xs font-semibold text-slate-500 bg-white">
                    <th className="p-5 w-[35%] font-medium">College Name</th>
                    <th className="p-5 font-medium text-center">R1 Closing</th>
                    <th className="p-5 font-medium text-center">Current R{roundName}</th>
                    <th className="p-5 font-medium text-center">Shift</th>
                    <th className="p-5 font-medium">Probability</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {displayColleges.map((c) => {
                    const { rounds, overallPercentage } = c.status;
                    
                    return (
                      <tr key={c.code} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-5">
                          <div className="font-bold text-[#0F172A] text-sm mb-1">{c.name}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {c.city || 'New Delhi, Delhi'} • {c.type || 'Govt.'}
                          </div>
                        </td>
                        <td className="p-5 text-center text-slate-600 font-medium">{rounds.r1}</td>
                        <td className="p-5 text-center font-bold text-[#0F172A]">{c.currentScore}</td>
                        <td className="p-5 text-center">
                          {getShiftBadge(c.diff)}
                        </td>
                        <td className="p-5">
                          {renderProbabilityBar(overallPercentage)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="mt-auto p-5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Showing {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, allColleges.length)} of {allColleges.length} results
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-transparent text-slate-400 font-medium text-xs rounded-lg disabled:opacity-50 hover:bg-slate-200 transition-colors">
                  Prev
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[#EEF2FF] text-[#1D4ED8] font-medium text-xs rounded-lg disabled:opacity-50 hover:bg-[#E0E7FF] transition-colors">
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
