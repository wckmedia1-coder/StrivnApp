import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp, user, loading: authLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) { setError('Username is required'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Only letters, numbers and underscores allowed'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    const { error } = await signUp(email, password, username);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };
if (authLoading) return null;

if (user) {
  window.location.href = "/";
  return null;
}
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0533] via-[#0d0d1a] to-[#0d1a2e] flex items-center justify-center p-4">

      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#a855f7]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#ec4899]/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-6xl font-black tracking-tight bg-gradient-to-r from-[#a855f7] via-[#ec4899] to-[#3b82f6] bg-clip-text text-transparent mb-3">
            Strivn
          </h1>
          <p className="text-slate-400 text-sm">Become the person your goals are building</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">

          {success ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-white mb-2">Account created!</h2>
              <p className="text-slate-400 text-sm">Check your email to confirm your account, then sign in.</p>
              <a href="/" className="inline-block mt-6 px-6 py-2 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#ec4899] text-white font-semibold text-sm">
                Back to Sign In
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-6">Create your account</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:border-transparent transition-all"
                    placeholder="Pick a unique username" required maxLength={20} />
                  <p className="text-xs text-slate-500 mt-1">Letters, numbers and underscores only</p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:border-transparent transition-all"
                    placeholder="your@email.com" required />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:border-transparent transition-all"
                    placeholder="••••••••" required minLength={6} />
                  <p className="text-xs text-slate-500 mt-1">Minimum 6 characters</p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#a855f7] to-[#ec4899] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {loading ? 'Creating account...' : 'Create Account 🚀'}
                </button>
              </form>

              <p className="text-center text-slate-500 text-xs mt-6">
                Already have an account?{' '}
                <a href="/login" className="text-[#a855f7] hover:text-[#ec4899] transition-colors font-medium">Sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
