'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sendMessage, type ChatResponse, type User } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  response?: ChatResponse;
  timestamp: Date;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('finbot_token');
    const storedUser = localStorage.getItem('finbot_user');
    if (!storedToken || !storedUser) {
      router.push('/');
      return;
    }
    setToken(storedToken);
    setUser(JSON.parse(storedUser));
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await sendMessage(query, sessionId, token);
      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'bot',
        content: response.answer,
        response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'bot',
        content: `Error: ${err.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('finbot_token');
    localStorage.removeItem('finbot_user');
    router.push('/');
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      employee: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      finance: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      engineering: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      marketing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      c_level: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
    return colors[role] || colors.employee;
  };

  if (!user) return null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-dark-700 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <h1 className="text-xl font-bold gradient-text">FinBot</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
              {user.role.toUpperCase()}
            </span>
            <span className="text-dark-400 text-sm">{user.display_name}</span>
          </div>
          {user.role === 'c_level' && (
            <button
              onClick={() => router.push('/admin')}
              className="px-3 py-1.5 text-xs rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-300 transition-colors"
            >
              Admin Panel
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 animate-fade-in">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-bold text-dark-200 mb-2">Welcome, {user.display_name}!</h2>
              <p className="text-dark-400 mb-6">
                Ask questions about FinSolve documents. Your role: <strong className="text-white">{user.role}</strong>
              </p>
              {/* <div className="flex flex-wrap justify-center gap-2">
                  {['general', 'finance', 'engineering', 'marketing'].map(col => {
                    const hasAccess = user.role === 'c_level' || col === 'general' || col === user.role;
                    return (
                      <span
                        key={col}
                        className={`px-3 py-1 rounded-full text-xs border ${hasAccess
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30 line-through'
                          }`}
                      >
                        {hasAccess ? '🔓' : '🔒'} {col}
                      </span>
                    );
                  })}
                </div> */}
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-3xl ${msg.type === 'user' ? 'order-1' : ''}`}>
                {/* Message bubble */}
                <div className={`rounded-2xl px-5 py-3 ${msg.type === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-md'
                  : 'glass rounded-tl-md'
                  }`}>
                  {msg.type === 'bot' ? (
                    <div className="message-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>

                {/* Bot response metadata */}
                {msg.type === 'bot' && msg.response && (
                  <div className="mt-3 space-y-2">
                    {/* Route badge */}
                    {/* {msg.response.route_selected && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-dark-500">Route:</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          🧭 {msg.response.route_selected}
                        </span>
                      </div>
                    )} */}

                    {/* Sources */}
                    {msg.response.sources && msg.response.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs text-dark-500 mr-1">Sources:</span>
                        {msg.response.sources.map((source, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs rounded-lg bg-dark-800 text-dark-300 border border-dark-700"
                            title={`Relevance: ${(source.relevance_score * 100).toFixed(1)}%`}
                          >
                            📄 {source.document}{source.page_number ? ` p.${source.page_number}` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Guardrail warnings */}
                    {msg.response.guardrail_warnings && msg.response.guardrail_warnings.length > 0 && (
                      <div className="space-y-1.5">
                        {msg.response.guardrail_warnings.map((warning, i) => (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-xs border ${warning.severity === 'error'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : warning.severity === 'warning'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}
                          >
                            {warning.severity === 'error' ? '🛑' : warning.severity === 'warning' ? '⚠️' : 'ℹ️'}{' '}
                            <strong>{warning.type}:</strong> {warning.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* RBAC blocked */}
                    {msg.response.blocked && (
                      <div className="px-3 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                        🔒 <strong>Access Denied:</strong> {msg.response.blocked_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="glass rounded-2xl rounded-tl-md px-5 py-3">
                <div className="flex items-center gap-2 text-dark-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="glass border-t border-dark-700 px-4 py-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask something about FinSolve documents..."
              className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20"
            >
              Send
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-dark-500">
            <span>Collections: {user.role === 'c_level' ? 'All' : ['general', user.role !== 'employee' ? user.role : ''].filter(Boolean).join(', ')}</span>
            <span>•</span>
            <span>Session: {sessionId.slice(0, 8)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
