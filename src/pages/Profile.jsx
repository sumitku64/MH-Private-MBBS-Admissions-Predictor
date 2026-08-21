import { useUser } from '../context/UserContext';
import { Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { INDIAN_STATES, QUALIFICATIONS } from '../components/AuthModal';
import { CATEGORIES } from '../data';

export default function Profile() {
  const { profile, updateProfile } = useUser();
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    userName: profile.userName || '',
    fatherName: profile.fatherName || '',
    userScore: profile.userScore || '',
    gender: profile.gender || 'any',
    category: profile.category || 'open',
    dob: profile.dob || '',
    altPhone: profile.altPhone || '',
    allIndiaRank: profile.allIndiaRank || '',
    categoryRank: profile.categoryRank || '',
    annualBudget: profile.annualBudget || 1500000,
    domicileState: profile.domicileState || 'MH',
    preferredInstituteType: profile.preferredInstituteType || [],
    reservationSubcategory: profile.reservationSubcategory || [],
    education: profile.education || { 
      class10State: 'MH', class12State: 'MH', class12Year: '2024', qualification: '12th Science',
      class12Board: '', class12Percentage: '', class12Physics: '', class12Chemistry: '', class12Biology: '', class12English: '',
      class10Board: '', class10Year: '', class10Cgpa: ''
    },
    preferredRegions: profile.preferredRegions || [],
    needsHostel: profile.needsHostel || false,
  });

  useEffect(() => {
    setFormData({
      userName: profile.userName || '',
      fatherName: profile.fatherName || '',
      userScore: profile.userScore || '',
      gender: profile.gender || 'any',
      category: profile.category || 'open',
      dob: profile.dob || '',
      altPhone: profile.altPhone || '',
      allIndiaRank: profile.allIndiaRank || '',
      categoryRank: profile.categoryRank || '',
      annualBudget: profile.annualBudget || 1500000,
      domicileState: profile.domicileState || 'MH',
      preferredInstituteType: profile.preferredInstituteType || [],
      reservationSubcategory: profile.reservationSubcategory || [],
      education: profile.education || { 
        class10State: 'MH', class12State: 'MH', class12Year: '2024', qualification: '12th Science',
        class12Board: '', class12Percentage: '', class12Physics: '', class12Chemistry: '', class12Biology: '', class12English: '',
        class10Board: '', class10Year: '', class10Cgpa: ''
      },
      preferredRegions: profile.preferredRegions || [],
      needsHostel: profile.needsHostel || false,
    });
  }, [profile]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [newRegion, setNewRegion] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    const res = await updateProfile({
      userName: formData.userName,
      fatherName: formData.fatherName,
      userScore: Number(formData.userScore) || null,
      gender: formData.gender,
      category: formData.category,
      dob: formData.dob,
      altPhone: formData.altPhone,
      allIndiaRank: formData.allIndiaRank,
      categoryRank: formData.categoryRank,
      annualBudget: formData.annualBudget,
      domicileState: formData.domicileState,
      preferredInstituteType: formData.preferredInstituteType,
      reservationSubcategory: formData.reservationSubcategory,
      education: formData.education,
      preferredRegions: formData.preferredRegions,
      needsHostel: formData.needsHostel,
    });
    
    setIsSaving(false);
    
    if (res && res.ok === false) {
      alert("Failed to save: " + (res.error || "Network error"));
    } else {
      setSaveMessage('Profile saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const addRegion = () => {
    if (newRegion && !formData.preferredRegions.includes(newRegion)) {
      setFormData({ ...formData, preferredRegions: [...formData.preferredRegions, newRegion] });
      setNewRegion('');
    }
  };

  const removeRegion = (region) => {
    setFormData({ ...formData, preferredRegions: formData.preferredRegions.filter(r => r !== region) });
  };

  const toggleArrayItem = (arrayName, value) => {
    const current = formData[arrayName];
    if (current.includes(value)) {
      setFormData({ ...formData, [arrayName]: current.filter(i => i !== value) });
    } else {
      setFormData({ ...formData, [arrayName]: [...current, value] });
    }
  };

  const scrollToSection = (id) => {
    setActiveTab(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const tabs = [
    { id: 'basic', label: 'Basic Information' },
    { id: 'academic', label: 'Academic Profile' },
    { id: 'counseling', label: 'Counseling & Demographics' },
    { id: 'budget', label: 'Budget & Preferences' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 pb-20 w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Personal Profile</h1>
          <p className="text-slate-500 mt-1">Manage your academic credentials, personal details, and college preferences.</p>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && <span className="text-sm font-bold text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4"/> Saved</span>}
          <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shadow-sm shrink-0">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(formData.userName || 'User')}&background=random`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm py-2 px-4 md:px-6 rounded-lg transition-colors shadow-sm whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex overflow-x-auto no-scrollbar border-b border-slate-200">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => scrollToSection(tab.id)}
            className={`py-3 px-4 md:px-6 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-12">
        
        {/* Basic Information */}
        <section id="basic" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 scroll-mt-24">
          <h2 className="text-xl font-black text-slate-900 mb-6">Basic Information</h2>
          <div className="grid md:grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                <input type="text" value={formData.userName} onChange={e => setFormData({...formData, userName: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Dr. Sharma" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Father's/Guardian's Name</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
                <input type="text" value={formData.fatherName} onChange={e => setFormData({...formData, fatherName: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Enter name" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📅</span>
                <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
              <div className="flex gap-3 h-[46px]">
                {['male', 'female', 'other'].map(g => (
                  <button 
                    key={g} onClick={() => setFormData({...formData, gender: g})}
                    className={`flex-1 font-bold text-sm py-2 rounded-lg capitalize transition-all ${formData.gender === g ? 'bg-white border-2 border-blue-600 text-blue-700 shadow-sm' : 'bg-[#F4F7FD] border border-transparent text-slate-600 hover:bg-slate-200'}`}
                  >{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📱</span>
                <input type="text" readOnly value={profile.phone || ''} className="w-full pl-9 pr-4 py-3 bg-slate-100 border border-transparent rounded-lg text-sm text-slate-500 cursor-not-allowed focus:outline-none" title="Phone number cannot be changed" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Alt. Mobile Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">☎️</span>
                <input type="text" value={formData.altPhone} onChange={e => setFormData({...formData, altPhone: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="+91 XXXXXXXXXX" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Social Category</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {CATEGORIES.map(c => (
                <button 
                  key={c.value} 
                  onClick={() => setFormData({...formData, category: c.value})}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all
                    ${formData.category === c.value ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm' : 'bg-[#F4F7FD] border-transparent text-slate-600 hover:bg-slate-200'}
                  `}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                    ${formData.category === c.value ? 'border-blue-600' : 'border-slate-400'}
                  `}>
                    {formData.category === c.value && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Academic Profile */}
        <section id="academic" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 scroll-mt-24">
          <h2 className="text-xl font-black text-slate-900 mb-6">Academic Profile</h2>
          
          <div className="bg-[#F8FAFC] p-6 rounded-xl border border-slate-100 mb-8">
            <div className="flex items-center gap-2 text-blue-700 font-bold mb-4">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              NEET Details
            </div>
            <div className="grid md:grid-cols-3 gap-6">
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">NEET Score</label>
                  <input type="number" value={formData.userScore} onChange={e => setFormData({...formData, userScore: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. 685" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">All India Rank</label>
                  <input type="number" value={formData.allIndiaRank} onChange={e => setFormData({...formData, allIndiaRank: e.target.value})} placeholder="e.g. 1245" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
               </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Category Rank</label>
                  <input type="number" value={formData.categoryRank} onChange={e => setFormData({...formData, categoryRank: e.target.value})} placeholder="e.g. 450" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500" />
               </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 12th Standard Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-4">12th Standard Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Board Name</label>
                  <input type="text" value={formData.education.class12Board} onChange={e => setFormData({...formData, education: {...formData.education, class12Board: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="e.g. CBSE" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Year</label>
                    <input type="text" value={formData.education.class12Year} onChange={e => setFormData({...formData, education: {...formData.education, class12Year: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="2023" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Percentage</label>
                    <input type="text" value={formData.education.class12Percentage} onChange={e => setFormData({...formData, education: {...formData.education, class12Percentage: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="95%" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Physics</label>
                    <input type="text" value={formData.education.class12Physics} onChange={e => setFormData({...formData, education: {...formData.education, class12Physics: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="Marks" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Chemistry</label>
                    <input type="text" value={formData.education.class12Chemistry} onChange={e => setFormData({...formData, education: {...formData.education, class12Chemistry: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="Marks" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Biology</label>
                    <input type="text" value={formData.education.class12Biology} onChange={e => setFormData({...formData, education: {...formData.education, class12Biology: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="Marks" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">English</label>
                    <input type="text" value={formData.education.class12English} onChange={e => setFormData({...formData, education: {...formData.education, class12English: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="Marks" />
                  </div>
                </div>
              </div>
            </div>

            {/* 10th Standard Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-4">10th Standard Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Board Name</label>
                  <input type="text" value={formData.education.class10Board} onChange={e => setFormData({...formData, education: {...formData.education, class10Board: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="e.g. ICSE" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Year</label>
                    <input type="text" value={formData.education.class10Year} onChange={e => setFormData({...formData, education: {...formData.education, class10Year: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="2021" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">CGPA/Percentage</label>
                    <input type="text" value={formData.education.class10Cgpa} onChange={e => setFormData({...formData, education: {...formData.education, class10Cgpa: e.target.value}})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white" placeholder="9.8" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Counseling & Demographics */}
        <section id="counseling" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 scroll-mt-24">
          <h2 className="text-xl font-black text-slate-900 mb-6">Counseling & Demographic Details</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Domicile Category</label>
              <select value={formData.domicileState} onChange={e => setFormData({...formData, domicileState: e.target.value})} className="w-full px-4 py-3 bg-[#F4F7FD] border border-transparent rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors">
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s === formData.domicileState ? s + ' (85% Quota)' : s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Preferred Institute Type</label>
              <div className="flex gap-3">
                {['Govt', 'Private', 'Deemed'].map(type => (
                  <button 
                    key={type}
                    onClick={() => toggleArrayItem('preferredInstituteType', type)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                      formData.preferredInstituteType.includes(type) ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-[#F4F7FD] border-transparent text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <div className={`w-4 h-4 flex items-center justify-center rounded border ${formData.preferredInstituteType.includes(type) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                      {formData.preferredInstituteType.includes(type) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Reservation Sub-category</label>
            <div className="flex flex-wrap gap-3">
              {['PWD', 'Defence', 'Freedom Fighter', 'None'].map(sub => (
                <button 
                  key={sub}
                  onClick={() => toggleArrayItem('reservationSubcategory', sub)}
                  className={`flex items-center gap-2 px-4 md:px-6 py-3 rounded-xl border text-sm font-bold transition-all ${
                    formData.reservationSubcategory.includes(sub) ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-[#F4F7FD] border-transparent text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 flex items-center justify-center rounded border ${formData.reservationSubcategory.includes(sub) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                    {formData.reservationSubcategory.includes(sub) && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  {sub}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Budget & Preferences */}
        <section id="budget" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 scroll-mt-24">
          <h2 className="text-xl font-black text-slate-900 mb-6">Budget & Preferences</h2>
          
          <div className="mb-8">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Annual Fee Budget (Max)</label>
            <div className="flex items-end justify-between mb-4">
              <div className="text-3xl font-black text-blue-600">
                ₹ {Number(formData.annualBudget).toLocaleString('en-IN')}
              </div>
              <div className="text-sm text-slate-400 font-medium">Per Year</div>
            </div>
            <input 
              type="range" min="50000" max="5000000" step="50000" 
              value={formData.annualBudget} 
              onChange={e => setFormData({...formData, annualBudget: e.target.value})}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-2"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">
               <span>₹ 50K</span>
               <span>₹ 25L</span>
               <span>₹ 50L+</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
             <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Preferred Regions</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.preferredRegions.map(region => (
                    <span key={region} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                      {region} <button onClick={() => removeRegion(region)} className="hover:text-blue-900">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" value={newRegion} onChange={e => setNewRegion(e.target.value)}
                    placeholder="+ Add Region" className="flex-1 px-4 py-2 bg-[#F4F7FD] border border-transparent rounded-full text-sm font-medium focus:outline-none focus:border-blue-500 focus:bg-white" 
                    onKeyDown={e => e.key === 'Enter' && addRegion()}
                  />
                  <button onClick={addRegion} className="hidden"></button>
                </div>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Hostel Requirement</label>
                <div 
                  className="flex items-center justify-between bg-[#F4F7FD] px-5 py-4 rounded-xl border border-transparent cursor-pointer transition-colors"
                  onClick={() => setFormData({...formData, needsHostel: !formData.needsHostel})}
                >
                   <span className="text-sm font-bold text-slate-700">Do you require hostel facilities?</span>
                   <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.needsHostel ? 'bg-blue-600' : 'bg-blue-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.needsHostel ? 'left-5' : 'left-1'}`}></div>
                   </div>
                </div>
             </div>
          </div>
        </section>

      </div>
    </div>
  );
}
