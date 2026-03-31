'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { PAGE_ROUTES } from '@/lib/routes';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'guide'| 'accounts' | 'roles' | 'analytics'>('guide');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError('');

    try {
      const data = await login(username, password);
      localStorage.setItem('finbot_token', data.access_token);
      localStorage.setItem('finbot_user', JSON.stringify(data.user));
      router.push(PAGE_ROUTES.CHAT);
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

      {/* User Manual Sidebar */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-20 w-80 animate-fade-in hidden lg:block">
        <div className="glass rounded-2xl p-6 border border-dark-600/50 shadow-2xl overflow-hidden relative max-h-[85vh] flex flex-col">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6 flex-shrink-0">
              <span className="text-2xl">📖</span>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest font-heading">User Manual</h2>
            </div>

            {/* Tabs */}
            <div className="flex bg-dark-900/50 p-1 rounded-xl mb-6 border border-dark-700 flex-shrink-0">
              <button 
                onClick={() => setActiveTab('guide')}
                className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all ${activeTab === 'guide' ? 'bg-blue-600 text-white shadow-lg' : 'text-dark-400 hover:text-dark-200'}`}
              >
                Guide
              </button>
              <button 
                onClick={() => setActiveTab('accounts')}
                className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all ${activeTab === 'accounts' ? 'bg-blue-600 text-white shadow-lg' : 'text-dark-400 hover:text-dark-200'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setActiveTab('roles')}
                className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all ${activeTab === 'roles' ? 'bg-blue-600 text-white shadow-lg' : 'text-dark-400 hover:text-dark-200'}`}
              >
                Roles
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg' : 'text-dark-400 hover:text-dark-200'}`}
              >
                Eval
              </button>
            </div>

            {/* Content Container (Scrollable) */}
            <div className="overflow-y-auto pr-1 flex-1 custom-scrollbar">
              
              {/* Tab Content: Guide */}
              {activeTab === 'guide' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 pb-2">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                      <p className="text-[11px] text-dark-200 leading-relaxed"><span className="font-bold text-white">Login & Setup</span>: Login as Admin and click the Gear ⚙️ icon in the chat to enter the Admin Panel.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                      <p className="text-[11px] text-dark-200 leading-relaxed"><span className="font-bold text-white">Bootstrap Ingestion</span>: Click <span className="text-blue-400 font-bold">"Re-Index All Documents"</span>. This processes all 20+ financial docs required for the project into the Vector DB.</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                      <p className="text-[11px] text-dark-200 leading-relaxed"><span className="font-bold text-white">Custom Docs</span>: Once re-indexed, you can manually <span className="text-green-400 underline decoration-green-500/30">Upload</span> new files or <span className="text-red-400 underline decoration-red-500/30">Delete</span> individual docs.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Accounts */}
              {activeTab === 'accounts' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 pb-2">
                  <div className="p-3 bg-dark-800/40 rounded-xl border border-dark-600/30">
                    <p className="text-[10px] text-dark-500 uppercase font-black mb-1.5">Admin Credentials</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-dark-400 font-medium">User:</span>
                        <code className="text-blue-400 font-mono bg-dark-900 px-1.5 rounded">finbot_admin</code>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-dark-400 font-medium">Pass:</span>
                        <code className="text-blue-400 font-mono bg-dark-900 px-1.5 rounded tracking-tighter">ChangeThisPassword123!</code>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                    <p className="text-[10px] text-blue-300 leading-relaxed italic">
                      Use this account to manage users, data, and run LangSmith evaluations.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab Content: Roles */}
              {activeTab === 'roles' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 pb-2">
                  <div className="space-y-2">
                    <p className="text-[11px] text-white font-bold px-1">Assigning Roles:</p>
                    <p className="text-[10px] text-dark-400 px-1 mb-2">In Admin &gt; Users, you can change a user's <span className="text-white">Primary Role</span> or grant <span className="text-blue-400">Extra Access</span> to secondary departments.</p>
                    <div className="space-y-1.5">
                      {[
                        { role: 'C-Level', access: 'All Finance, Eng, Mktg' },
                        { role: 'Finance', access: 'Finance + General' },
                        { role: 'Engineering', access: 'Eng + General' },
                        { role: 'Employee', access: 'General Only' },
                      ].map((r, i) => (
                        <div key={i} className="flex flex-col p-2 rounded-lg bg-dark-800/20 border border-dark-700/30">
                          <span className="text-[10px] font-bold text-white mb-0.5">{r.role}</span>
                          <span className="text-[9px] text-dark-400">{r.access}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: Analytics */}
              {activeTab === 'analytics' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 pb-2">
                  <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                    <p className="text-[10px] font-bold text-indigo-300 mb-1.5 uppercase">LangSmith Evaluation</p>
                    <p className="text-[11px] text-dark-200 leading-relaxed mb-3">
                      Go to <span className="font-bold underline decoration-indigo-400/30">Analytics & Evals</span> to verify system performance:
                    </p>
                    <ul className="space-y-2">
                      <li className="flex gap-2">
                        <span className="text-blue-400">⚡</span>
                        <p className="text-[10px] text-dark-400">Click <span className="text-white font-bold">"Run New Evaluation"</span> to send queries to LangSmith and get similarity scores.</p>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-400">📊</span>
                        <p className="text-[10px] text-dark-400">Compare RAG outputs against <span className="text-white font-bold">Ground Truth</span> answers to ensure accuracy.</p>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 text-dark-600 text-xs mt-10">
        Secure Access Portal. Powered by FinSolve Technologies.
      </p>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
