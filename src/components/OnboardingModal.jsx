import { useState } from 'react';
import { CATEGORIES, GENDERS } from '../data';
import { INDIAN_STATES } from '../data/constants';
import { useUser } from '../context/UserContext';

export default function OnboardingModal({ onComplete }) {
  const { profile, updateProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    userName: profile.userName || profile.google_name || '',
    userScore: '',
    category: 'open',
    gender: '',
    annualBudget: '',
    domicileState: 'MH'
  });

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.userName.trim()) return setError('Name is required.');
    
    const scoreNum = Number(formData.userScore);
    if (formData.userScore === '' || isNaN(scoreNum) || scoreNum < 0 || scoreNum > 720) {
      return setError('Please enter a valid NEET score (0 to 720).');
    }
    
    if (!formData.gender) return setError('Gender is required.');
    
    const budgetNum = Number(formData.annualBudget);
    if (formData.annualBudget === '' || isNaN(budgetNum) || budgetNum < 0) {
      return setError('Please enter a valid annual budget.');
    }

    setLoading(true);
    
    // Save to context and DB
    const res = await updateProfile({
      userName: formData.userName.trim(),
      userScore: scoreNum,
      category: formData.category,
      gender: formData.gender,
      annualBudget: budgetNum,
      domicileState: formData.domicileState
    });

    setLoading(false);
    if (res.ok) {
      if (onComplete) onComplete();
    } else {
      setError(res.error || 'Failed to save profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Let's personalize your EDUNIAA experience</h2>
            <p className="text-sm text-slate-500 mt-2">We just need a few details to personalize your college recommendations.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
              <input 
                type="text" 
                name="userName"
                value={formData.userName} 
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Your Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">NEET Score</label>
                <input 
                  type="number" 
                  name="userScore"
                  value={formData.userScore} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="e.g. 650"
                  min="0"
                  max="720"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                <select 
                  name="category"
                  value={formData.category} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gender</label>
                <div className="flex gap-2">
                  {GENDERS.filter(g => g.value !== 'any').map(g => (
                    <button 
                      key={g.value} 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, gender: g.value }))}
                      className={`flex-1 py-3 text-sm font-bold capitalize rounded-xl transition-all ${
                        formData.gender === g.value 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Annual Budget (₹)</label>
                <input 
                  type="number" 
                  name="annualBudget"
                  value={formData.annualBudget} 
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="e.g. 1500000"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Domicile State</label>
              <select 
                name="domicileState"
                value={formData.domicileState} 
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {error && <div className="text-rose-500 text-xs font-bold bg-rose-50 p-3 rounded-lg text-center">{error}</div>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 mt-4 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Continue'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
