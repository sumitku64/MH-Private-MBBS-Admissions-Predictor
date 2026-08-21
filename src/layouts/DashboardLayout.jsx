import { Outlet, Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useState } from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';
import NavigationDrawer from '../components/NavigationDrawer';
import ProfileMenu from '../components/ProfileMenu';

export default function DashboardLayout() {
  const { profile } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      <NavigationDrawer isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10">
           <div className="flex items-center gap-4 flex-1">
             <button 
               className="md:hidden w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors -ml-2 shrink-0"
               onClick={() => setSidebarOpen(true)}
               aria-label="Open sidebar"
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
           
           <div className="flex items-center gap-2 md:gap-4 shrink-0">
             <button className="text-slate-400 hover:text-slate-600 relative hidden sm:block">
               <Bell className="w-5 h-5" />
               <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 border-2 border-white"></span>
             </button>
             <button className="text-slate-400 hover:text-slate-600 hidden sm:block">
               <HelpCircle className="w-5 h-5" />
             </button>
             <ProfileMenu />
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
