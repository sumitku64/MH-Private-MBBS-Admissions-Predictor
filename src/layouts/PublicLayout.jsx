import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import AuthModal from '../components/AuthModal';

export default function PublicLayout() {
  const { profile } = useUser();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-50 sticky top-0">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-black text-lg tracking-[0.1em] text-blue-700 uppercase flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs">E</span>
            EDUNIAA
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link to="/" className="hover:text-blue-600 transition-colors">Predictor</Link>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Domicile & Quota guide is under construction."); }} className="hover:text-blue-600 transition-colors">Domicile & Quota</a>
            <Link to="/roi" className="hover:text-blue-600 transition-colors">MBBS ROI</Link>
            <Link to="/analysis" className="hover:text-blue-600 transition-colors">AIQ Cutoffs</Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {profile.isRegistered ? (
             <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
               <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
                 {profile.userName?.charAt(0).toUpperCase() || 'U'}
               </div>
               <span className="hidden md:inline-block text-sm font-bold text-slate-700">{profile.userName}</span>
             </Link>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-6 rounded-md transition-colors shadow-sm"
            >
              Login
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-slate-100 border-t border-slate-200 py-12 mt-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="font-black text-lg text-slate-400 uppercase mb-4 flex justify-center items-center gap-2">
            <span className="w-5 h-5 rounded bg-slate-300 text-white flex items-center justify-center text-[10px]">E</span>
            EDUNIAA
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-8">
            Transforming complex NEET admission data into actionable insights for the next generation of medical excellence.
          </p>
          <div className="pt-8 border-t border-slate-200 text-xs text-slate-400">
            © 2026 EDUNIAA Academic Consulting. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
