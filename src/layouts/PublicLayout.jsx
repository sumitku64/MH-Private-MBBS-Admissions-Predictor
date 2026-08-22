import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import AuthModal from '../components/AuthModal';
import NavigationDrawer from '../components/NavigationDrawer';
import ProfileMenu from '../components/ProfileMenu';

export default function PublicLayout() {
  const { profile } = useUser();
  const [showAuth, setShowAuth] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      
      <NavigationDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} forceMobileOnly={true} />

      
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 sticky top-0">
        <div className="flex items-center gap-4 flex-1">
          {/* Hamburger button on the left matching DashboardLayout */}
          <button 
            className="md:hidden w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors -ml-2 shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/" className="font-black text-lg tracking-[0.1em] text-blue-700 uppercase flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs">E</span>
            EDUNIAA
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500 ml-4">
            <Link to="/" className="hover:text-blue-600 transition-colors">Predictor</Link>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Domicile & Quota guide is under construction."); }} className="hover:text-blue-600 transition-colors">Domicile & Quota</a>
            <Link to="/roi" className="hover:text-blue-600 transition-colors">MBBS ROI</Link>
            <Link to="/aiq-cutoffs" className="hover:text-blue-600 transition-colors">AIQ Cutoffs</Link>
            <Link to="/ranking" className="hover:text-blue-600 transition-colors">AI College Ranking</Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {profile?.isRegistered ? (
             <ProfileMenu />
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-6 rounded-md transition-colors shadow-sm hidden md:block"
            >
              Login
            </button>
          )}

          {/* Login icon for mobile if not registered */}
          {!profile?.isRegistered && (
            <button 
              onClick={() => setShowAuth(true)}
              className="md:hidden w-11 h-11 flex items-center justify-center text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-full transition-colors -mr-2"
              aria-label="Login"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col min-w-0 w-full relative z-0">
        <Outlet />
      </main>
      
      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 shrink-0 relative z-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-black">E</span>
            <span className="font-black text-white tracking-[0.1em]">EDUNIAA</span>
          </div>
          <div className="text-sm font-medium flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-xs">© 2026 Eduniaa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
