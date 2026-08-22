import { useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useUser } from '../context/UserContext';
import { LogIn } from 'lucide-react';

export default function GoogleAuthButton({ onAuthSuccess }) {
  const { loginWithGoogle } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        // Send the access token to backend for verification
        const res = await loginWithGoogle(tokenResponse.access_token);
        if (!res.ok) throw new Error(res.error || 'Authentication failed');
        if (onAuthSuccess) onAuthSuccess();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError('Google Sign-In failed');
    }
  });

  return (
    <div className="flex flex-col items-center">
      <button 
        onClick={() => login()}
        disabled={loading}
        className="flex items-center justify-center gap-3 w-full bg-white border border-slate-300 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
        {loading ? 'Signing in...' : 'Sign in with Google'}
      </button>
      {error && <p className="text-red-500 text-xs font-medium mt-2">{error}</p>}
    </div>
  );
}
