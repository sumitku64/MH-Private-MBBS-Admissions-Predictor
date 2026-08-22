import GoogleAuthButton from './GoogleAuthButton';

export default function AuthModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative p-8 text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h2 className="text-xl font-black text-slate-900 mb-2">Sign In</h2>
        <p className="text-sm text-slate-500 mb-6">Use your Google account to access your personalized admission dashboard.</p>
        <GoogleAuthButton onAuthSuccess={onClose} />
      </div>
    </div>
  );
}
