import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { User, TrendingUp, ListOrdered } from 'lucide-react';

export default function NavigationDrawer({ isOpen, onClose, forceMobileOnly = false }) {
  const { profile } = useUser();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className={`${forceMobileOnly ? '' : 'md:hidden'} fixed inset-0 bg-black/50 z-40 transition-opacity`} 
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed ${forceMobileOnly ? '' : 'md:static'} inset-y-0 left-0 z-50
        w-64 bg-[#f4f7fd] border-r border-slate-200
        flex flex-col transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full ' + (forceMobileOnly ? '' : 'md:translate-x-0')}
      `}>
        <div className="h-16 shrink-0 flex items-center px-6 border-b border-slate-200">
          <Link to="/" onClick={onClose} className="font-black text-lg tracking-[0.1em] text-blue-700 uppercase flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs">E</span>
            EDUNIAA
          </Link>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {/* Dashboard Tools (Requires Auth) */}
          {profile?.isRegistered && (
            <>
              <div className="px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Dashboard</div>
              <Link 
                to="/profile" 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/profile') 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                onClick={onClose}
              >
                <User className="w-5 h-5" />
                Personal Profile
              </Link>
              <Link 
                to="/analysis" 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/analysis') 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                onClick={onClose}
              >
                <TrendingUp className="w-5 h-5" />
                Round-wise Analysis
              </Link>
            </>
          )}

          {/* Public links always shown on Mobile Drawer */}
          <div className={`${forceMobileOnly ? 'pt-2 mt-2' : 'md:hidden pt-4 mt-4'} border-t border-slate-200 space-y-1`}>
            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">Main Site</div>
            <Link to="/" onClick={onClose} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">Predictor</Link>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Domicile & Quota guide is under construction."); onClose(); }} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">Domicile & Quota</a>
            <Link to="/roi" onClick={onClose} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">MBBS ROI</Link>
            <Link to="/aiq-cutoffs" onClick={onClose} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">AIQ Cutoffs</Link>
            <Link to="/ranking" onClick={onClose} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">AI College Ranking</Link>
          </div>
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-200">
          {profile?.isRegistered ? (
             <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                  {profile.userName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900 truncate">{profile.userName || 'Guest User'}</div>
                  <div className="text-xs text-slate-500 truncate">{profile.google_email}</div>
                </div>
             </div>
          ) : (
             <div className="px-2 text-center text-xs text-slate-500 font-medium py-2">
               Sign in to access personalized dashboard tools.
             </div>
          )}
        </div>
      </aside>
    </>
  );
}
