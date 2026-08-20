import { Outlet, Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useState } from 'react';
import { Search, Bell, HelpCircle, User, BarChart2, TrendingUp, LogOut, ListOrdered } from 'lucide-react';

export default function DashboardLayout() {
  const { profile, logout } = useUser();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-[#f4f7fd] border-r border-slate-200
        flex flex-col transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link to="/" className="font-black text-lg tracking-[0.1em] text-blue-700 uppercase flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs">E</span>
            EDUNIAA
          </Link>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          <Link 
            to="/profile" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              isActive('/profile') 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            onClick={() => setSidebarOpen(false)}
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
            onClick={() => setSidebarOpen(false)}
          >
            <TrendingUp className="w-5 h-5" />
            Round-wise Analysis
          </Link>
          <Link 
            to="/ranking" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              isActive('/ranking') 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            <ListOrdered className="w-5 h-5" />
            AI College Ranking
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200 shadow-sm">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-black shrink-0">
               {profile.userName?.charAt(0).toUpperCase() || 'U'}
             </div>
             <div className="min-w-0 flex-1">
               <div className="text-sm font-bold text-slate-900 truncate">{profile.userName || 'Guest User'}</div>
               <div className="text-xs text-slate-500 truncate">Candidate ID: {profile.userId || '4920'}</div>
             </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
           <div className="flex items-center gap-4 flex-1">
             <button 
               className="md:hidden text-slate-500 hover:text-slate-700"
               onClick={() => setSidebarOpen(true)}
             >
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
               </svg>
             </button>
             
             {/* Search Bar matching Figma */}
             <div className="hidden md:flex flex-1 max-w-2xl relative">
               <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search for medical colleges, cutoffs, or ranks..." 
                 className="w-full bg-slate-50 border border-slate-200 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
               />
             </div>
           </div>
           
           <div className="flex items-center gap-4 shrink-0">
             <button className="text-slate-400 hover:text-slate-600 relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 border-2 border-white"></span>
             </button>
             <button className="text-slate-400 hover:text-slate-600">
               <HelpCircle className="w-5 h-5" />
             </button>
           </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
