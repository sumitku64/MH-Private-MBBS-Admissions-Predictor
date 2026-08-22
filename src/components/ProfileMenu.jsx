import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { LogOut, User } from 'lucide-react';

export default function ProfileMenu() {
  const { profile, logout } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!profile?.isRegistered) return null;

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/');
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm">
          {profile.userName?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="hidden md:inline-block text-sm font-bold text-slate-700">{profile.userName}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-200 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <p className="text-sm font-bold text-slate-900 truncate">{profile.userName}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">
              {profile.google_email}
            </p>
          </div>
          
          <div className="p-1.5">
            <Link 
              to="/profile" 
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <User className="w-4 h-4" />
              Personal Profile
            </Link>
          </div>
          
          <div className="p-1.5 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
