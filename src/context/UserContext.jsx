import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';

const UserContext = createContext(null);

const STORAGE_KEY = 'eduniaa_profile';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStored(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function clearStored() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function UserProvider({ children }) {
  const stored = loadStored();

  const [profile, setProfile] = useState({
    userName:         stored?.userName         ?? '',
    phone:            stored?.phone            ?? '',
    pin:              stored?.pin              ?? '',
    userScore:        stored?.userScore        ?? null,
    category:         stored?.category         ?? 'open',
    gender:           stored?.gender           ?? 'any',
    annualBudget:     stored?.annualBudget     ?? 1500000,
    domicileState:    stored?.domicileState    ?? 'MH',
    education:        stored?.education        ?? { class10State: 'MH', class12State: 'MH', class12Year: '2024', qualification: '12th Science' },
    dob:              stored?.dob              ?? '',
    allIndiaRank:     stored?.allIndiaRank     ?? '',
    categoryRank:     stored?.categoryRank     ?? '',
    preferredRegions: stored?.preferredRegions ?? [],
    needsHostel:      stored?.needsHostel      ?? false,
    fatherName:       stored?.fatherName       ?? '',
    altPhone:         stored?.altPhone         ?? '',
    preferredInstituteType: stored?.preferredInstituteType ?? [],
    reservationSubcategory: stored?.reservationSubcategory ?? [],
    isRegistered:     stored?.isRegistered     ?? false,
  });

  const [shortlist,   setShortlist]   = useState(stored?.shortlist   ?? []);
  const [chatHistory, setChatHistory] = useState(stored?.chatHistory ?? []);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError,   setAuthError]   = useState('');

  // Persist profile + shortlist to localStorage on every change
  useEffect(() => {
    if (profile.isRegistered) {
      saveStored({ ...profile, shortlist, chatHistory });
    }
  }, [profile, shortlist, chatHistory]);

  // ── Register (new user) ────────────────────────────────────────────────────
  async function register({ name, phone, userScore, category, gender, budget, domicileState, education }) {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, phone, neet_score: userScore ?? null, category: category ?? 'open', gender: gender ?? 'any',
          annualBudget: budget, domicileState, education
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? 'Registration failed.');
        setAuthLoading(false);
        return { ok: false, error: data.error };
      }
      const p = {
        userName: data.student.name,
        phone:    data.student.phone,
        pin:      data.pin,
        userScore: data.student.neet_score,
        category:  data.student.category ?? 'open',
        gender:    data.student.gender   ?? 'any',
        annualBudget: data.student.annual_budget ?? 1500000,
        domicileState: data.student.domicile_state ?? 'MH',
        education: data.student.educational_details ?? { class10State: 'MH', class12State: 'MH', class12Year: '2024', qualification: '12th Science' },
        dob:          data.student.dob ?? '',
        allIndiaRank: data.student.allIndiaRank ?? '',
        categoryRank: data.student.categoryRank ?? '',
        preferredRegions: data.student.preferredRegions ?? [],
        needsHostel:  data.student.needsHostel ?? false,
        isRegistered: true,
      };
      setProfile(p);
      setShortlist([]);
      setChatHistory([]);
      saveStored({ ...p, shortlist: [], chatHistory: [] });
      setAuthLoading(false);
      return { ok: true, pin: data.pin };
    } catch (e) {
      setAuthError('Network error. Try again.');
      setAuthLoading(false);
      return { ok: false, error: 'Network error.' };
    }
  }

  // ── Login (returning user) ─────────────────────────────────────────────────
  async function login({ phone, pin }) {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? 'Login failed.');
        setAuthLoading(false);
        return { ok: false, error: data.error };
      }
      const p = {
        userName:     data.student.name,
        phone:        data.student.phone,
        pin:          String(pin),
        userScore:    data.student.neet_score,
        category:     data.student.category ?? 'open',
        gender:       data.student.gender   ?? 'any',
        annualBudget: data.student.annual_budget ?? 1500000,
        domicileState: data.student.domicile_state ?? 'MH',
        education: data.student.educational_details ?? { class10State: 'MH', class12State: 'MH', class12Year: '2024', qualification: '12th Science' },
        dob:          data.student.dob ?? '',
        allIndiaRank: data.student.allIndiaRank ?? '',
        categoryRank: data.student.categoryRank ?? '',
        preferredRegions: data.student.preferredRegions ?? [],
        needsHostel:  data.student.needsHostel ?? false,
        fatherName:   data.student.fatherName ?? '',
        altPhone:     data.student.altPhone ?? '',
        preferredInstituteType: data.student.preferredInstituteType ?? [],
        reservationSubcategory: data.student.reservationSubcategory ?? [],
        isRegistered: true,
      };
      setProfile(p);
      setShortlist(data.shortlist ?? []);
      setChatHistory(data.chat ?? []);
      saveStored({ ...p, shortlist: data.shortlist ?? [], chatHistory: data.chat ?? [] });
      setAuthLoading(false);
      return { ok: true };
    } catch (e) {
      setAuthError('Network error. Try again.');
      setAuthLoading(false);
      return { ok: false, error: 'Network error.' };
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function logout() {
    setProfile({ userName: '', phone: '', pin: '', userScore: null, category: 'open', gender: 'any', isRegistered: false });
    setShortlist([]);
    setChatHistory([]);
    clearStored();
  }

  // ── Save shortlist to DB ───────────────────────────────────────────────────
  const saveShortlist = useCallback(async (colleges) => {
    setShortlist(colleges);
    if (!profile.isRegistered || !profile.phone || !profile.pin) return;
    try {
      await fetch(`${API_BASE}/api/student/shortlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile.phone, pin: profile.pin, colleges }),
      });
    } catch {}
  }, [profile]);

  // ── Save chat messages to DB ───────────────────────────────────────────────
  const saveChatMessages = useCallback(async (messages) => {
    setChatHistory(messages);
    if (!profile.isRegistered || !profile.phone || !profile.pin || messages.length === 0) return;
    try {
      await fetch(`${API_BASE}/api/student/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile.phone, pin: profile.pin, messages }),
      });
    } catch {}
  }, [profile]);

  // ── Update Profile ───────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (newProfileData) => {
    setProfile(prev => ({ ...prev, ...newProfileData }));
    
    // Attempt to sync to cloud DB if user is registered
    if (!profile.isRegistered || !profile.phone || !profile.pin) return { ok: true };

    try {
      const res = await fetch(`${API_BASE}/api/student/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: profile.phone, 
          pin: profile.pin, 
          profile: newProfileData 
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to sync profile to DB:', data.error);
        return { ok: false, error: data.error };
      }
      return { ok: true };
    } catch (err) {
      console.error('Network error syncing profile:', err);
      return { ok: false, error: 'Network error' };
    }
  }, [profile]);

  return (
    <UserContext.Provider value={{
      profile, shortlist, chatHistory,
      authLoading, authError, setAuthError,
      register, login, logout,
      saveShortlist, saveChatMessages, updateProfile
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
