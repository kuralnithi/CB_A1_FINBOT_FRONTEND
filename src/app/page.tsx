'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError('');

    try {
      const data = await login(username, password);
      localStorage.setItem('finbot_token', data.access_token);
      localStorage.setItem('finbot_user', JSON.stringify(data.user));
      router.push('/chat');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-10 animate-fade-in">
        <div className="text-5xl mb-4">🤖</div>
        <h1 className="text-4xl font-bold gradient-text mb-2">FinBot</h1>
        <p className="text-dark-400 text-lg">Intelligent Financial Assistant by FinSolve Technologies</p>
        <p className="text-dark-500 text-sm mt-2">Advanced RAG with Role-Based Access Control</p>
      </div>

      {/* Error */}
      {error && (
        <div className="relative z-10 w-full max-w-md mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center animate-slide-up">
          {error}
        </div>
      )}

      {/* Login Form */}
      <div className="relative z-10 w-full max-w-md glass rounded-2xl p-8 animate-slide-up">
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5 ml-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="Enter your username"
              className="w-full bg-dark-800/50 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Enter your password"
              className="w-full bg-dark-800/50 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-dark-700 disabled:to-dark-700 disabled:text-dark-500 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Authenticating...
              </>
            ) : "Secure Login"}
          </button>
        </form>
      </div>

      {/* Demo Credentials Right Sidebar */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-20 w-64 animate-fade-in hidden lg:block">
        <div className="glass rounded-2xl p-6 border border-dark-600/50 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="flex flex-col items-center gap-2 mb-6">
              <span className="text-3xl mb-1">🔑</span>
              <p className="text-sm font-bold text-dark-100 uppercase tracking-widest text-center">Access Control</p>
            </div>

            <div className="space-y-4 w-full">
              <div className="p-4 bg-dark-800/40 rounded-xl border border-dark-600/30 text-center flex flex-col items-center">
                <p className="text-[10px] text-dark-400 uppercase font-bold mb-2 tracking-tighter">Username</p>
                <code className="text-blue-400 text-xs font-mono bg-dark-900/50 px-2 py-1 rounded">finbot_admin</code>
              </div>

              <div className="p-4 bg-dark-800/40 rounded-xl border border-dark-600/30 text-center flex flex-col items-center">
                <p className="text-[10px] text-dark-400 uppercase font-bold mb-2 tracking-tighter">Password</p>
                <code className="text-blue-400 text-xs font-mono break-all bg-dark-900/50 px-2 py-1 rounded leading-relaxed">ChangeThisPassword123!</code>
              </div>

              <div className="mt-4 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-center">
                <p className="text-[10px] text-blue-300 leading-tight">
                  <span className="font-bold uppercase block mb-1">Developer Note</span>
                  Use these credentials to access the C-Level administrative dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-dark-600 text-xs mt-10">
        Secure Access Portal. Please contact your administrator if you need an account.
      </p>
    </div>
  );
}
