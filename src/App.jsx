import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Homepage from './pages/Homepage';
import CollegeDetail from './pages/CollegeDetail';
import Profile from './pages/Profile';
import RoundwiseAnalysis from './pages/RoundwiseAnalysis';
import FinancialPlanner from './pages/FinancialPlanner';
import CollegeRanking from './pages/CollegeRanking';

// Existing Tools (temporarily kept for migration)
import NeetPredictor from './tools/NeetPredictor';
import AICounsellor from './tools/AICounsellor';
import AdminPanel from './tools/AdminPanel';

function ProtectedRoute({ children }) {
  const { profile, authLoading } = useUser();
  if (authLoading) return <div className="p-8 flex justify-center text-slate-500">Loading...</div>;
  if (!profile.isRegistered) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes with Navbar */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Homepage />} />
        <Route path="/college/:id" element={<CollegeDetail />} />
        <Route path="/roi" element={<FinancialPlanner />} />
        <Route path="/aiq-cutoffs" element={<RoundwiseAnalysis />} />
        <Route path="/ranking" element={<CollegeRanking />} />
        {/* Keeping old tools accessible temporarily */}
        <Route path="/legacy/predictor" element={<NeetPredictor />} />
      </Route>

      {/* Protected Routes (Requires Login) */}
      <Route element={<ProtectedRoute><PublicLayout /></ProtectedRoute>}>
        <Route path="/profile" element={<Profile />} />
        <Route path="/analysis" element={<RoundwiseAnalysis />} />
      </Route>

      {/* Admin Route (No specific layout for now) */}
      <Route path="/admin" element={<AdminPanel />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <AppRoutes />
        <AICounsellor />
      </BrowserRouter>
    </UserProvider>
  );
}
