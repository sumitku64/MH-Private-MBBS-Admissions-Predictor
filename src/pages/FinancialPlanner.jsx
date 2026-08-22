import { useState, useMemo, useEffect } from 'react';
import { IndianRupee, Calculator, CheckCircle2, TrendingDown, PieChart as PieChartIcon, AlertTriangle, AlertCircle, ArrowRightLeft, MapPin, Bookmark, Clock, BarChart3, Settings } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart as RechartsBarChart, Bar, XAxis, YAxis, AreaChart, Area, CartesianGrid } from 'recharts';
import { useCollegeData } from '../lib/useCollegeData';
import { useUser } from '../context/UserContext';
import { CATEGORIES } from '../data';
import DropYearEngine from '../tools/DropYearEngine';
import { AllocationTab } from './CollegeDetail';

const HOSTEL_MESS_FEE_YEARLY = 150000;
const COURSE_YEARS_TUITION = 4.5;
const COURSE_YEARS_HOSTEL = 5.5;
const PIE_COLORS = ['#4f46e5', '#f59e0b', '#10b981'];

// DETERMINISTIC LOCAL SAMPLE DATASET
const SAMPLE_ROI_DATA = {
  "default": { sampleStartingSalary: 900000, roiScore: 5.5 },
  "1105": { sampleStartingSalary: 1200000, roiScore: 6.8 }, // e.g. K.J. Somaiya
  "1106": { sampleStartingSalary: 1050000, roiScore: 4.5 },
  "1107": { sampleStartingSalary: 1000000, roiScore: 8.2 },
  "1110": { sampleStartingSalary: 1100000, roiScore: 7.5 },
};

function getSampleROIMetrics(collegeCode, totalCost = 0) {
  const data = SAMPLE_ROI_DATA[collegeCode] || SAMPLE_ROI_DATA["default"];
  const breakEvenYears = totalCost > 0 ? (totalCost / data.sampleStartingSalary).toFixed(1) : 0;
  return {
    ...data,
    breakEvenYears,
    sampleStartingSalaryLakhs: (data.sampleStartingSalary / 100000).toFixed(1)
  };
}

export default function FinancialPlanner() {
  const { collegeData } = useCollegeData();
  const { profile } = useUser();
  
  const [activeTab, setActiveTab] = useState('roi');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [category, setCategory] = useState(() => profile?.category || 'open');
  const [downpayment, setDownpayment] = useState(500000);
  const [interestRate, setInterestRate] = useState(9.5);
  const [chartDuration, setChartDuration] = useState(10);
  const [isEditingCompetitors, setIsEditingCompetitors] = useState(false);
  const [alt1, setAlt1] = useState('');
  const [alt2, setAlt2] = useState('');
  
  // Identity-aware profile sync
  const [hydratedUserId, setHydratedUserId] = useState(() => profile?.isRegistered ? profile.google_id : null);

  useEffect(() => {
    const currentAuth = profile?.isRegistered ? profile.google_id : null;
    
    if (currentAuth !== hydratedUserId) {
      if (currentAuth) {
        setCategory(profile.category || 'open');
      } else {
        setCategory('open');
      }
      setHydratedUserId(currentAuth);
    }
  }, [profile?.isRegistered, profile?.google_id, profile?.category, hydratedUserId]);

  useEffect(() => {
    if (collegeData && collegeData.length > 0 && !selectedCollegeId) {
      // Find Somaiya or default to first
      const somaiya = collegeData.find(c => c.name.toLowerCase().includes('somaiya') || c.code === '1105');
      if (somaiya) setSelectedCollegeId(somaiya.code);
      else setSelectedCollegeId(collegeData[0].code);
    }
  }, [collegeData]);

  const studentBudget = Number(profile?.annualBudget) || 0;

  const college = useMemo(() => collegeData?.find(c => c.code === selectedCollegeId) || null, [collegeData, selectedCollegeId]);

  const calculations = useMemo(() => {
    if (!college) return null;

    const openAnnualFee = college.fees['open'] || 0;
    const catAnnualFee = college.fees[category] !== undefined ? college.fees[category] : openAnnualFee;
    const totalTuition = catAnnualFee * COURSE_YEARS_TUITION;
    const totalLivingCost = HOSTEL_MESS_FEE_YEARLY * COURSE_YEARS_HOSTEL;
    const trueTotalCost = totalTuition + totalLivingCost;

    const loanPrincipal = Math.max(0, trueTotalCost - downpayment);
    const months = 10 * 12;
    const monthlyRate = (interestRate / 100) / 12;
    let emi = 0;
    if (loanPrincipal > 0) {
      if (monthlyRate > 0) emi = (loanPrincipal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
      else emi = loanPrincipal / months;
    }
    const totalInterest = (emi * months) - loanPrincipal;

    const annualCollegeCost = catAnnualFee + HOSTEL_MESS_FEE_YEARLY;
    const budgetUtilization = studentBudget > 0 ? (annualCollegeCost / studentBudget) * 100 : 0;
    let budgetStatus = ""; let budgetColor = "text-slate-500"; let budgetBg = "bg-white"; let Icon = CheckCircle2;
    
    if (budgetUtilization === 0) { budgetStatus = "Budget Missing"; Icon = AlertCircle; } 
    else if (budgetUtilization <= 80) { budgetStatus = "Very Affordable"; budgetColor = "text-emerald-700"; budgetBg = "bg-emerald-50/50 border-emerald-100"; Icon = CheckCircle2; } 
    else if (budgetUtilization <= 100) { budgetStatus = "Within Budget"; budgetColor = "text-blue-700"; budgetBg = "bg-blue-50/50 border-blue-100"; Icon = CheckCircle2; } 
    else if (budgetUtilization <= 120) { budgetStatus = "Slightly Over Budget"; budgetColor = "text-amber-700"; budgetBg = "bg-amber-50/50 border-amber-100"; Icon = AlertTriangle; } 
    else { budgetStatus = "Significantly Over Budget"; budgetColor = "text-rose-700"; budgetBg = "bg-rose-50/50 border-rose-100"; Icon = AlertTriangle; }

    const roi = getSampleROIMetrics(college.code, trueTotalCost);

    return {
      catAnnualFee, trueTotalCost, totalTuition, totalLivingCost,
      loanPrincipal, emi, totalInterest,
      annualCollegeCost, budgetUtilization, budgetStatus, budgetColor, budgetBg, Icon, roi,
      costBreakdownData: [ { name: 'Total Tuition', value: totalTuition }, { name: 'Hostel & Mess', value: totalLivingCost } ]
    };
  }, [college, category, downpayment, interestRate, studentBudget]);

  const alternatives = useMemo(() => {
    if (!college || !collegeData) return [];
    const others = collegeData.filter(c => c.code !== college.code);
    const first = alt1 ? collegeData.find(c => c.code === alt1) : others[0];
    const second = alt2 ? collegeData.find(c => c.code === alt2) : (others.find(c => c.code !== first?.code) || others[1]);
    return [first, second].filter(Boolean);
  }, [college, collegeData, alt1, alt2]);

  const comparisonColleges = useMemo(() => {
    if (!college || !alternatives) return [];
    return [college, ...alternatives].map(c => {
      const fee = c.fees[category] !== undefined ? c.fees[category] : (c.fees['open'] || 0);
      const tuition = fee * COURSE_YEARS_TUITION;
      const living = HOSTEL_MESS_FEE_YEARLY * COURSE_YEARS_HOSTEL;
      const totalCost = tuition + living;
      const metrics = getSampleROIMetrics(c.code, totalCost);
      return { ...c, totalCost, metrics, fee };
    });
  }, [college, alternatives, category]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const formatLakhs = (amount) => `₹${(amount / 100000).toFixed(2)} L`;
  const formatCrores = (amount) => amount >= 10000000 ? `₹${(amount / 10000000).toFixed(2)} Cr` : formatLakhs(amount);

  // Generate Break-Even Chart Data
  const chartData = useMemo(() => {
    if (!calculations) return [];
    const data = [];
    let cashFlow = -calculations.trueTotalCost;
    for (let year = 1; year <= chartDuration; year++) {
      cashFlow = -calculations.trueTotalCost + (year * calculations.roi.sampleStartingSalary);
      data.push({ year: `Yr ${year}`, cashFlow });
    }
    return data;
  }, [calculations, chartDuration]);

  return (
    <div className="w-full min-h-screen bg-[#F4F7FD] pb-20 font-sans">
         {!calculations ? (
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 flex flex-col items-center justify-center text-slate-400">
          <Calculator className="w-16 h-16 mb-4 text-slate-300" />
          <p className="font-medium">Select a college to view the Financial Planner</p>
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <div className="relative w-full min-h-[280px] md:h-[280px] py-10 md:py-0 bg-slate-50 overflow-hidden border-b border-slate-200">
            <div className="absolute inset-0 bg-cover bg-center opacity-10 mix-blend-multiply" style={{backgroundImage: 'url("https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=2000")'}}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent"></div>
            <div className="relative max-w-6xl mx-auto px-4 md:px-6 h-full flex flex-col justify-end pb-8">
               <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-black tracking-wider uppercase rounded">PRIVATE</span>
                  <span className="text-slate-500 text-xs font-bold flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> {college.city || 'Mumbai'}, Maharashtra</span>
               </div>
               <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-2 leading-tight">{college.name}</h1>
               <p className="text-slate-600 text-sm font-medium max-w-2xl">A comprehensive analysis of admission probability, return on investment, and strategic alternatives for prospective medical students.</p>
               
               <div className="absolute bottom-8 right-6 hidden md:flex gap-3">
                   <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"><Bookmark className="w-4 h-4"/> Save</button>
                   <button onClick={() => { setActiveTab('roi'); setTimeout(() => document.getElementById('comparison-table')?.scrollIntoView({behavior: 'smooth'}), 100); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"><ArrowRightLeft className="w-4 h-4"/> Compare</button>
               </div>
            </div>
          </div>

          {/* Controls & Tabs */}
          <div className="bg-white shadow-sm mb-8 relative z-10">
            <div className="max-w-6xl mx-auto px-4 md:px-6">
              
              {/* College Selector / Search */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-4 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto flex flex-col sm:flex-row">
                   <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Analyze Another College:</span>
                   <select value={selectedCollegeId} onChange={e => setSelectedCollegeId(e.target.value)} className="w-full md:w-80 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
                     <option value="">-- Select a College --</option>
                     {collegeData?.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                   </select>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto flex flex-col sm:flex-row">
                   <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Category Quota:</span>
                   <select value={category} onChange={e => setCategory(e.target.value)} className="w-full md:w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
                     {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                   </select>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 md:gap-8 overflow-x-auto whitespace-nowrap hide-scrollbar pb-1">
                 <button onClick={() => setActiveTab('roi')} className={`py-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'roi' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>ROI Calculator</button>
                 <button onClick={() => setActiveTab('allocation')} className={`py-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'allocation' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Allocation Simulator</button>
                 <button onClick={() => setActiveTab('dropyear')} className={`py-4 font-bold text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dropyear' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Strategic Analysis</button>
              </div>
            </div>
          </div>

          {activeTab === 'roi' && (
            <div className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Sidebar - Financial Overview */}
            <div className="lg:col-span-3 space-y-6">
              <h2 className="text-lg font-black text-slate-900 mb-2">Financial Overview</h2>
              
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden group hover:border-blue-200 transition-colors">
                <div className="absolute top-4 right-4 w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><IndianRupee className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Est. Fees</div>
                <div className="text-3xl font-black text-slate-900 mb-2">{formatCrores(calculations.trueTotalCost)}</div>
                <div className="flex items-center gap-1.5 text-rose-600 text-xs font-bold bg-rose-50 w-fit px-2 py-1 rounded">
                   <TrendingDown className="w-3 h-3 rotate-180"/> +8% YOY
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
                <div className="absolute top-4 right-4 w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Clock className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Duration</div>
                <div className="text-3xl font-black text-slate-900 mb-1">5.5 Yrs</div>
                <div className="text-xs text-slate-500 font-medium">Includes 1 yr compulsory internship</div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative">
                <div className="absolute top-4 right-4 w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center text-amber-600"><BarChart3 className="w-4 h-4"/></div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  ROI Score <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px]">SAMPLE</span>
                </div>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-4xl font-black text-slate-900">{calculations.roi.roiScore}</span>
                  <span className="text-sm font-bold text-slate-400 mb-1">/ 10</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{width: `${calculations.roi.roiScore * 10}%`}}></div>
                </div>
              </div>
            </div>

            {/* Right Main Content */}
            <div className="lg:col-span-9 space-y-8 min-w-0">
              
              {/* Break-Even Analysis */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-8 min-w-0">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-8 gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-1">Break-Even Analysis</h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                      <span className="text-blue-600 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Cumulative Cash Flow</span>
                      <span className="text-slate-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-200"></div> Annual Expenses</span>
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] uppercase">Sample Data</span>
                    </div>
                  </div>
                  <div className="flex bg-slate-100 rounded-lg p-1 shrink-0">
                    {/* Dynamic Chart Duration Buttons */}
                      <button onClick={() => setChartDuration(10)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${chartDuration === 10 ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>10 Yrs</button>
                      <button onClick={() => setChartDuration(15)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${chartDuration === 15 ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>15 Yrs</button>
                  </div>
                </div>

                <div className="h-[250px] w-full mb-8 relative hidden md:block">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} tickFormatter={(val) => val === 0 ? '₹0' : formatCrores(val)} />
                      <RechartsTooltip formatter={(val) => formatCurrency(val)} labelStyle={{color: '#0f172a', fontWeight: 'bold'}} />
                      <Area type="monotone" dataKey="cashFlow" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCash)" />
                    </AreaChart>
                  </ResponsiveContainer>
                  {/* Break Even Point Marker */}
                  <div className="absolute top-[40%] flex flex-col items-center -translate-x-1/2" style={{ left: `calc(${Math.min(95, Math.max(5, (calculations.roi.breakEvenYears / chartDuration) * 100))}%) ` }}>
                    <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md mb-1 whitespace-nowrap">Break-Even</div>
                    <div className="w-3 h-3 border-2 border-amber-500 bg-white rounded-full"></div>
                    <div className="w-px h-16 border-l-2 border-dashed border-amber-500/50"></div>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] rounded-xl p-5 text-sm text-slate-600 flex items-start gap-3 border border-slate-100">
                   <div className="mt-0.5 shrink-0"><div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">i</div></div>
                   <p><strong>Illustrative estimate based on sample salary data.</strong> Assuming an illustrative starting salary of <strong className="text-slate-900">{formatLakhs(calculations.roi.sampleStartingSalary)}/year</strong>, it takes approximately <strong className="text-slate-900">{calculations.roi.breakEvenYears} years</strong> to recover the initial investment of {formatCrores(calculations.trueTotalCost)}.</p>
                </div>
              </div>

              {/* Budget Friendliness */}
              <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 ${calculations.budgetBg} shadow-sm`}>
                <div>
                  <h2 className={`text-lg font-black flex items-center gap-2 mb-2 ${calculations.budgetColor}`}>
                    <calculations.Icon className="w-5 h-5" /> {calculations.budgetStatus}
                  </h2>
                  <p className="text-slate-700 font-medium text-sm">
                    Estimated annual cost (Tuition + Living): <strong className="font-bold">{formatCurrency(calculations.annualCollegeCost)} / yr</strong>.
                  </p>
                  {studentBudget === 0 ? (
                    <p className="text-xs text-slate-500 mt-1">Set your annual budget in Personal Profile to see affordability insights.</p>
                  ) : (
                    <p className="text-xs text-slate-600 mt-1">
                      Your budget is <strong>{formatCurrency(studentBudget)} / yr</strong>. 
                      This college utilizes <strong className={calculations.budgetUtilization > 100 ? 'text-rose-600 font-bold' : 'font-bold'}>{calculations.budgetUtilization.toFixed(0)}%</strong>.
                    </p>
                  )}
                </div>
                {studentBudget > 0 && (
                  <div className="shrink-0 w-full md:w-56 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <span>Budget Used</span>
                      <span>{calculations.budgetUtilization.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${calculations.budgetUtilization > 100 ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(calculations.budgetUtilization, 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* ROI Comparison Table */}
                <div id="comparison-table" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white">
                   <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                     <ArrowRightLeft className="w-5 h-5 text-blue-600" /> College ROI Comparison
                   </h2>
                   <button onClick={() => setIsEditingCompetitors(!isEditingCompetitors)} className="text-blue-600 text-sm font-bold flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"><Settings className="w-4 h-4"/> {isEditingCompetitors ? 'Done' : 'Edit Competitors'}</button>
                </div>
                {isEditingCompetitors && (
                  <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Competitor 1</label>
                      <select value={alt1 || (alternatives[0]?.code || '')} onChange={e => setAlt1(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500">
                        <option value="">-- Select --</option>
                        {collegeData?.filter(c => c.code !== college.code && c.code !== alt2).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Competitor 2</label>
                      <select value={alt2 || (alternatives[1]?.code || '')} onChange={e => setAlt2(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500">
                        <option value="">-- Select --</option>
                        {collegeData?.filter(c => c.code !== college.code && c.code !== alt1).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px] sm:min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="p-5 font-bold text-slate-400 text-[10px] uppercase tracking-wider w-[25%] border-b border-slate-100 bg-[#F8FAFC]">Metric</th>
                        {comparisonColleges.map((c, i) => (
                          <th key={c.code} className={`p-5 w-[25%] border-b border-slate-100 bg-white`}>
                            <div className={`font-black text-sm mb-1 ${i === 0 ? 'text-blue-700' : 'text-slate-700'}`}>{c.name.split(' ')[0]} {c.name.split(' ')[1]}</div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Maharashtra</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      <tr>
                        <td className="p-5 font-bold text-slate-500 border-b border-slate-50 bg-[#F8FAFC]">Tuition Fees (Total)</td>
                        {comparisonColleges.map((c, i) => (
                          <td key={c.code} className={`p-5 font-black text-slate-900 border-b border-slate-50 ${i === 0 ? 'bg-blue-50/30' : ''}`}>{formatCrores(c.fee * COURSE_YEARS_TUITION)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-5 font-bold text-slate-500 border-b border-slate-50 bg-[#F8FAFC]">Living Exp. (5.5 Yrs)</td>
                        {comparisonColleges.map((c, i) => (
                          <td key={c.code} className={`p-5 font-bold text-slate-700 border-b border-slate-50 ${i === 0 ? 'bg-blue-50/30' : ''}`}>{formatLakhs(HOSTEL_MESS_FEE_YEARLY * COURSE_YEARS_HOSTEL)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-5 font-bold text-slate-500 border-b border-slate-50 bg-[#F8FAFC]">
                          Exp. Starting Salary
                          <div className="mt-1"><span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] uppercase">Sample</span></div>
                        </td>
                        {comparisonColleges.map((c, i) => (
                          <td key={c.code} className={`p-5 font-black text-slate-900 border-b border-slate-50 ${i === 0 ? 'bg-blue-50/30' : ''}`}>
                            {c.metrics.sampleStartingSalaryLakhs} LPA
                            {i === 0 && <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold">Highest</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-5 font-bold text-slate-500 border-b border-slate-50 bg-[#F8FAFC]">
                          Years to Break-Even
                          <div className="mt-1"><span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] uppercase">Sample</span></div>
                        </td>
                        {comparisonColleges.map((c, i) => (
                          <td key={c.code} className={`p-5 font-black border-b border-slate-50 ${i === 0 ? 'bg-blue-50/30 text-blue-700' : 'text-slate-700'}`}>
                            {c.metrics.breakEvenYears} Yrs
                            {i === 2 && <span className="ml-2 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold">Fastest</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-5 font-bold text-slate-500 bg-[#F8FAFC]">
                          Overall ROI Score
                          <div className="mt-1"><span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] uppercase">Sample</span></div>
                        </td>
                        {comparisonColleges.map((c, i) => (
                          <td key={c.code} className={`p-5 font-black ${i === 0 ? 'bg-blue-50/30 text-amber-600 rounded-br-2xl border-t-2 border-blue-600' : 'text-slate-700'}`}>
                            {c.metrics.roiScore} <span className="text-xs text-slate-400 font-medium">/10</span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legacy Cost & Loan Setup (Required to preserve) */}
              <div className="grid lg:grid-cols-2 gap-8 pt-8 border-t border-slate-200">
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-blue-600" /> True Cost Breakdown
                  </h2>
                  <div className="h-[200px] w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={calculations.costBreakdownData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                          {calculations.costBreakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600"></div> Tuition (4.5 Yrs)</span><span className="font-bold text-slate-900">{formatCurrency(calculations.totalTuition)}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Hostel (5.5 Yrs)</span><span className="font-bold text-slate-900">{formatCurrency(calculations.totalLivingCost)}</span></div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100"><span className="font-bold text-slate-900">Total Cost</span><span className="font-black text-blue-600">{formatCurrency(calculations.trueTotalCost)}</span></div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-blue-600" /> Education Loan EMI
                  </h2>
                  <div className="space-y-6 mb-8">
                    <div>
                      <div className="flex justify-between mb-2"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Downpayment</label><span className="text-sm font-bold text-blue-600">{formatCurrency(downpayment)}</span></div>
                      <input type="range" min="0" max={calculations.trueTotalCost} step="50000" value={downpayment} onChange={e => setDownpayment(Number(e.target.value))} className="w-full accent-blue-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Interest Rate (% p.a.)</label>
                      <input type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} className="w-full px-4 py-2.5 bg-[#F4F7FD] border border-transparent rounded-lg text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" />
                    </div>
                  </div>
                  <div className="bg-[#F8FAFC] border border-slate-100 rounded-xl p-5">
                    <div className="flex justify-between items-end pb-3 border-b border-slate-200 mb-3">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Monthly EMI (10 Yrs)</span>
                      <span className="text-2xl font-black text-slate-900">{formatCurrency(calculations.emi)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-medium text-slate-500 mb-1"><span>Principal</span><span>{formatCurrency(calculations.loanPrincipal)}</span></div>
                    <div className="flex justify-between text-xs font-medium text-slate-500"><span>Total Interest</span><span>{formatCurrency(calculations.totalInterest)}</span></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          )}

          {activeTab === 'allocation' && (
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
              <AllocationTab college={college} />
            </div>
          )}

          {activeTab === 'dropyear' && (
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                <DropYearEngine />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
