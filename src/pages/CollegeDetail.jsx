import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bookmark, CopyPlus, MapPin, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useCollegeData } from '../lib/useCollegeData';

export default function CollegeDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('allocation');
  const { collegeData } = useCollegeData();

  // Find college
  const college = useMemo(() => {
    return collegeData.find(c => c.code === id) || null;
  }, [collegeData, id]);

  if (!college) {
    return (
      <div className="w-full bg-slate-50 min-h-screen flex items-center justify-center">
        <p className="text-slate-500">College not found...</p>
      </div>
    );
  }

  // Use real data where possible, fallback to placeholders for now
  const displayData = {
    name: college.name,
    code: college.code,
    estd: college.established || '1991',
    type: college.type || 'Private',
    location: college.city ? `${college.city}, Maharashtra` : 'Maharashtra',
    seats: college.seats,
    affiliation: college.affiliation || 'MUHS'
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen pb-24">
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-6 py-4 text-xs font-medium text-slate-500 flex items-center gap-2">
        <Link to="/" className="hover:text-indigo-600">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/" className="hover:text-indigo-600">Colleges</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-400">Maharashtra</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 font-bold">{displayData.name}</span>
      </div>

      {/* Hero Header */}
      <div className="bg-white border-y border-slate-200 relative overflow-hidden">
        {/* Background Pattern/Image placeholder */}
        <div className="absolute inset-0 opacity-5 bg-[url('https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
          <div className="flex gap-2 mb-4">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded border border-indigo-100 uppercase tracking-wider">{displayData.type}</span>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 uppercase tracking-wider">Estd. {displayData.estd}</span>
            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-200 uppercase tracking-wider">Code: {displayData.code}</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4 max-w-4xl">
            {displayData.name}
          </h1>
          
          <div className="flex items-center gap-2 text-slate-500 mb-8">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">{displayData.location}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-8 mb-8 bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-slate-100 inline-flex">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Intake</div>
              <div className="text-xl font-black text-slate-900">{displayData.seats} Seats</div>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type</div>
              <div className="text-xl font-black text-slate-900">{displayData.type}</div>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Affiliation</div>
              <div className="text-xl font-black text-slate-900">{displayData.affiliation}</div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold text-sm py-2.5 px-6 rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
              <Bookmark className="w-4 h-4" /> Save
            </button>
            <button className="flex items-center gap-2 bg-indigo-600 border border-indigo-600 text-white font-bold text-sm py-2.5 px-6 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
              <CopyPlus className="w-4 h-4" /> Compare
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white sticky top-16 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex gap-8">
          <TabButton active={true} onClick={() => {}}>Allocation Simulator</TabButton>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <AllocationTab college={college} />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button 
      onClick={onClick}
      className={`py-4 text-sm font-bold border-b-2 transition-colors ${active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------
// ALLOCATION SIMULATOR TAB
// ---------------------------------------------------------
import { calculateAllocationStatus } from '../lib/simulator';
import { useUser } from '../context/UserContext';

export function AllocationTab({ college }) {
  const { profile } = useUser();
  const [simScore, setSimScore] = useState(profile.userScore || 650);

  const baseCutoff = college.cutoffs?.[2024]?.open || 600;
  
  const status = useMemo(() => {
    return calculateAllocationStatus(simScore, baseCutoff);
  }, [simScore, baseCutoff]);

  if (!status) return null;

  return (
    <div className="grid md:grid-cols-12 gap-8">
      {/* Left Sidebar (Status) */}
      <div className="md:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-bold text-slate-900">Admission Probability</h3>
             <span className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Live Simulator</span>
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-5xl font-black text-slate-900">{status.overallPercentage}%</span>
            <span className={`text-xs font-bold px-2 py-1 rounded ${status.overallPercentage >= 80 ? 'bg-green-100 text-green-700' : status.overallPercentage >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {status.overallPercentage >= 80 ? 'High Chances' : status.overallPercentage >= 40 ? 'Borderline' : 'Low Chances'}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-6">
            <div className={`h-full rounded-full ${status.overallPercentage >= 80 ? 'bg-green-500' : status.overallPercentage >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${status.overallPercentage}%` }}></div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Based on your score of <strong className="text-slate-900">{simScore}</strong> and historical trends. Adjust toggles to see dynamic shifts.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Refine Prediction</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">NEET Score</label>
              <input type="number" min="0" max="720" value={simScore} onChange={(e) => setSimScore(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500">
                  <option>Open</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quota</label>
                <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-indigo-500">
                  <option>State (85%)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Content (Timeline) */}
      <div className="md:col-span-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-900">Step-by-Step Allocation Logic</h2>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button className="px-4 py-1.5 bg-white text-indigo-700 font-bold text-xs rounded shadow-sm">2024 (Simulated)</button>
              </div>
           </div>

           <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-slate-100">
             
             {/* R1 */}
             <div className="relative pl-12">
               <div className={`absolute left-0 top-1.5 w-10 h-10 bg-white border-[3px] ${status.timeline.r1.status === 'Secured' ? 'border-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]' : 'border-slate-200'} rounded-full z-10 flex items-center justify-center`}>
                 <div className={`w-3 h-3 ${status.timeline.r1.status === 'Secured' ? 'bg-indigo-600' : 'bg-slate-300'} rounded-full`}></div>
               </div>
               <div className={`${status.timeline.r1.status === 'Secured' ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-100'} rounded-xl p-6 border`}>
                 <div className="flex justify-between items-start mb-2">
                   <div className={`text-[10px] font-bold ${status.timeline.r1.status === 'Secured' ? 'text-indigo-600' : 'text-slate-500'} uppercase tracking-wider`}>Round 1 Allocation</div>
                   <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">Sim. Cutoff Score: {status.rounds.r1}</div>
                 </div>
                 <h4 className={`text-lg font-black ${status.timeline.r1.status === 'Secured' ? 'text-slate-900' : 'text-slate-500'} mb-4`}>{status.timeline.r1.title}</h4>
                 <div className="bg-white p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed font-medium">
                   <strong>The Logic:</strong> {status.timeline.r1.desc}
                 </div>
               </div>
             </div>

             {/* R2 */}
             <div className="relative pl-12">
               <div className={`absolute left-0 top-1.5 w-10 h-10 bg-white border-[3px] ${status.securedRound === 'r2' ? 'border-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]' : 'border-slate-200'} rounded-full z-10 flex items-center justify-center`}>
                 <div className={`w-3 h-3 ${status.securedRound === 'r2' ? 'bg-indigo-600' : 'bg-slate-300'} rounded-full`}></div>
               </div>
               <div className={`${status.securedRound === 'r2' ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-100'} rounded-xl p-6 border`}>
                 <div className="flex justify-between items-start mb-2">
                   <div className={`text-[10px] font-bold ${status.securedRound === 'r2' ? 'text-indigo-600' : 'text-slate-500'} uppercase tracking-wider`}>Round 2 Allocation</div>
                   <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">Sim. Cutoff Score: {status.rounds.r2}</div>
                 </div>
                 <h4 className={`text-lg font-black ${status.securedRound === 'r2' ? 'text-slate-900' : 'text-slate-500'} mb-4`}>{status.timeline.r2.title}</h4>
                 <div className="bg-white p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed font-medium mb-4 shadow-sm">
                   <strong>The Logic:</strong> {status.timeline.r2.desc}
                 </div>
               </div>
             </div>

             {/* R3 */}
             <div className="relative pl-12">
               <div className={`absolute left-0 top-1.5 w-10 h-10 bg-white border-[3px] ${status.securedRound === 'r3' ? 'border-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]' : 'border-slate-200'} rounded-full z-10 flex items-center justify-center`}>
                 <div className={`w-3 h-3 ${status.securedRound === 'r3' ? 'bg-indigo-600' : 'bg-slate-300'} rounded-full`}></div>
               </div>
               <div className={`${status.securedRound === 'r3' ? 'bg-indigo-50/30 border-indigo-100' : 'bg-slate-50 border-slate-100'} rounded-xl p-6 border`}>
                 <div className="flex justify-between items-start mb-2">
                   <div className={`text-[10px] font-bold ${status.securedRound === 'r3' ? 'text-indigo-600' : 'text-slate-500'} uppercase tracking-wider`}>Round 3 Allocation</div>
                   <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">Sim. Cutoff Score: {status.rounds.r3}</div>
                 </div>
                 <h4 className={`text-lg font-black ${status.securedRound === 'r3' ? 'text-slate-900' : 'text-slate-500'} mb-4`}>{status.timeline.r3.title}</h4>
                 <div className="bg-white p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed font-medium">
                   <strong>The Logic:</strong> {status.timeline.r3.desc}
                 </div>
               </div>
             </div>
             
             {/* Stray */}
             <div className="relative pl-12 opacity-80">
               <div className={`absolute left-0 top-1.5 w-10 h-10 bg-white border-[3px] ${status.securedRound === 'mopUp' ? 'border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.1)]' : 'border-slate-200'} rounded-full z-10 flex items-center justify-center`}>
                 <div className={`w-3 h-3 ${status.securedRound === 'mopUp' ? 'bg-amber-500' : 'bg-slate-300'} rounded-full`}></div>
               </div>
               <div className={`${status.securedRound === 'mopUp' ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-50 border-slate-100'} rounded-xl p-6 border`}>
                 <div className="flex justify-between items-start mb-2">
                   <div className={`text-[10px] font-bold ${status.securedRound === 'mopUp' ? 'text-amber-600' : 'text-slate-500'} uppercase tracking-wider`}>Stray Vacancy / Mop-Up</div>
                   <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">Sim. Cutoff Score: {status.rounds.mopUp}</div>
                 </div>
                 <h4 className={`text-lg font-black ${status.securedRound === 'mopUp' ? 'text-slate-900' : 'text-slate-400'} mb-4`}>{status.timeline.mopUp.title}</h4>
                 <p className="text-sm text-slate-500 leading-relaxed bg-white p-4 rounded-lg border border-slate-100">
                   <strong>The Logic:</strong> {status.timeline.mopUp.desc}
                 </p>
               </div>
             </div>

           </div>
        </div>
      </div>
    </div>
  );
}
