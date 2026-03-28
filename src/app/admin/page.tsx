'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  triggerIngestion,
  listDocuments,
  deleteDocument,
  listUsers,
  updateUserRole,
  updateUserExtraRoles,
  deleteUser,
  type User,
  type DocumentInfo,
} from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = ['employee', 'finance', 'engineering', 'marketing', 'c_level'] as const;
type RoleKey = typeof ROLES[number];

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  finance: 'Finance Team',
  engineering: 'Engineering',
  marketing: 'Marketing',
  c_level: 'C-Level / Admin',
};

const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  finance: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  engineering: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  marketing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  c_level: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

// Derived collections per role
const ROLE_COLLECTIONS: Record<string, string[]> = {
  employee: ['general'],
  finance: ['finance', 'general'],
  engineering: ['engineering', 'general'],
  marketing: ['marketing', 'general'],
  c_level: ['finance', 'engineering', 'marketing', 'general'],
};

/** Union of collections from a primary role + extra roles */
function resolveCollections(role: string, extra: string[]): string[] {
  const all = new Set<string>(ROLE_COLLECTIONS[role] ?? ['general']);
  extra.forEach((r) => (ROLE_COLLECTIONS[r] ?? []).forEach((c) => all.add(c)));
  return Array.from(all).sort();
}

const PAGE_SIZE = 8;

// ─── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ total, page, pageSize, onChange }: { total: number; page: number; pageSize: number; onChange: (p: number) => void }) {
  const n = Math.max(1, Math.ceil(total / pageSize));
  if (n <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} className="px-3 py-1 text-xs rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 disabled:opacity-30 transition-colors">←</button>
      {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
        <button key={p} onClick={() => onChange(p)} className={`px-3 py-1 text-xs rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'}`}>{p}</button>
      ))}
      <button disabled={page === n} onClick={() => onChange(page + 1)} className="px-3 py-1 text-xs rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 disabled:opacity-30 transition-colors">→</button>
    </div>
  );
}

// ─── Extra Access Multi-selector ──────────────────────────────────────────────
function AccessSelector({
  primaryRole,
  selected,
  onChange,
}: {
  primaryRole: string;
  selected: string[];
  onChange: (roles: string[]) => void;
}) {
  const available = ROLES.filter((r) => r !== primaryRole);
  const toggle = (role: string) => {
    const next = selected.includes(role)
      ? selected.filter((r) => r !== role)
      : [...selected, role];
    onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((r) => {
        const on = selected.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => toggle(r)}
            className={`px-2 py-0.5 text-xs rounded-full border transition-all font-medium ${on
                ? ROLE_COLORS[r]
                : 'bg-dark-800 text-dark-500 border-dark-700 hover:border-dark-500'
              }`}
          >
            {on ? '✓ ' : ''}{ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'documents' | 'users'>('documents');
  const [docPage, setDocPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  // Per-user pending edits  { username: { role, extraRoles, saving } }
  const [pending, setPending] = useState<Record<string, { role: string; extra: string[]; saving: boolean }>>({});

  // Add-user modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', display_name: '', role: 'employee' });

  useEffect(() => {
    const t = localStorage.getItem('finbot_token');
    const u = localStorage.getItem('finbot_user');
    if (!t || !u) { router.push('/'); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== 'c_level') { router.push('/chat'); return; }
    setToken(t);
    setUser(parsed);
    loadData(t);
  }, [router]);

  const loadData = async (t: string) => {
    try {
      const [docs, userList] = await Promise.all([listDocuments(t), listUsers(t)]);
      setDocuments(docs);
      setUsers(userList);
      const seed: Record<string, { role: string; extra: string[]; saving: boolean }> = {};
      userList.forEach((u: any) => {
        seed[u.username] = { role: u.role, extra: u.extra_roles ?? [], saving: false };
      });
      setPending(seed);
    } catch (e) { console.error(e); }
  };

  const setPendingFor = (username: string, patch: Partial<{ role: string; extra: string[] }>) => {
    setPending((prev) => ({
      ...prev,
      [username]: { ...prev[username], ...patch },
    }));
  };

  const hasChanged = (username: string, original: any) => {
    const p = pending[username];
    if (!p) return false;
    const origExtra = original.extra_roles ?? [];
    return p.role !== original.role || JSON.stringify([...p.extra].sort()) !== JSON.stringify([...origExtra].sort());
  };

  const handleSave = async (username: string) => {
    const p = pending[username];
    if (!p) return;
    setPending((prev) => ({ ...prev, [username]: { ...prev[username], saving: true } }));
    try {
      const original = users.find((u) => u.username === username);
      const promises: Promise<any>[] = [];
      if (p.role !== original.role) promises.push(updateUserRole(username, p.role, token));
      const origExtra = original.extra_roles ?? [];
      if (JSON.stringify([...p.extra].sort()) !== JSON.stringify([...origExtra].sort())) {
        promises.push(updateUserExtraRoles(username, p.extra, token));
      }
      await Promise.all(promises);
      await loadData(token);
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setPending((prev) => ({ ...prev, [username]: { ...prev[username], saving: false } }));
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === user?.username) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteUser(username, token);
      await loadData(token);
    } catch (err: any) {
      setError(err.message || 'Delete user failed');
    }
  };

  const handleIngest = async () => {
    setIngesting(true); setError(''); setIngestResult(null);
    try { const r = await triggerIngestion(token); setIngestResult(r); await loadData(token); }
    catch (err: any) { setError(err.message || 'Ingestion failed'); }
    finally { setIngesting(false); }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete all chunks for "${filename}"?`)) return;
    try { await deleteDocument(filename, token); await loadData(token); }
    catch (err: any) { setError(err.message || 'Delete failed'); }
  };

  const openAddUser = () => {
    setShowAddUser(true); setShowPassword(false); setAddUserError('');
    setNewUser({ username: '', password: '', display_name: '', role: 'employee' });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); setAddUserError(''); setIsAddingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed'); }
      setShowAddUser(false); await loadData(token);
    } catch (err: any) { setAddUserError(err.message); }
    finally { setIsAddingUser(false); }
  };

  if (!user) return null;

  const totalChunks = documents.reduce((s, d) => s + d.chunk_count, 0);
  const pagedDocs = documents.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE);
  const pagedUsers = users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);

  return (
    <>
      <div className="min-h-screen">
        {/* Header */}
        <header className="glass border-b border-dark-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          </div>
          <button onClick={() => router.push('/chat')} className="px-3 py-1.5 text-xs rounded-lg bg-dark-700 hover:bg-dark-600 text-dark-300 transition-colors">
            ← Back to Chat
          </button>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[{ label: 'Documents', value: documents.length }, { label: 'Total Chunks', value: totalChunks }, { label: 'Users', value: users.length }].map((s) => (
              <div key={s.label} className="glass rounded-xl p-5">
                <div className="text-dark-400 text-sm">{s.label}</div>
                <div className="text-3xl font-bold text-white mt-1">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Ingestion card */}
          <div className="glass rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Document Ingestion</h2>
                <p className="text-dark-400 text-sm mt-1">Re-index all documents from the data directory into Qdrant</p>
              </div>
              <button onClick={handleIngest} disabled={ingesting} className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all disabled:opacity-50 flex items-center gap-2">
                {ingesting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {ingesting ? 'Indexing...' : '🔄 Re-Index All Documents'}
              </button>
            </div>
            {ingestResult && (
              <div className={`mt-4 p-4 rounded-lg border ${ingestResult.status === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <strong>{ingestResult.status}:</strong> {ingestResult.message}
                {ingestResult.documents_processed > 0 && <span className="ml-2">({ingestResult.documents_processed} docs, {ingestResult.chunks_created} chunks)</span>}
              </div>
            )}
            {error && <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {(['documents', 'users'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'}`}>
                {tab === 'documents' ? `📄 Documents (${documents.length})` : `👥 Users (${users.length})`}
              </button>
            ))}
          </div>

          {/* ── Documents Tab ── */}
          {activeTab === 'documents' && (
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    {['Document', 'Collection', 'Chunks', 'Status', 'Actions'].map((h, i) => (
                      <th key={h} className={`px-5 py-3 text-dark-400 text-xs font-medium uppercase ${i <= 1 ? 'text-left' : i === 4 ? 'text-right' : 'text-center'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedDocs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-dark-500">No documents indexed yet.</td></tr>
                  ) : pagedDocs.map((doc) => (
                    <tr key={doc.filename} className="border-b border-dark-700/50 hover:bg-dark-800/30">
                      <td className="px-5 py-3 text-dark-200 text-sm">{doc.filename}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{doc.collection}</span></td>
                      <td className="px-5 py-3 text-center text-dark-300 text-sm">{doc.chunk_count}</td>
                      <td className="px-5 py-3 text-center"><span className="px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">{doc.status}</span></td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleDelete(doc.filename)} className="px-3 py-1 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination total={documents.length} page={docPage} pageSize={PAGE_SIZE} onChange={setDocPage} />
            </div>
          )}

          {/* ── Users Tab ── */}
          {activeTab === 'users' && (
            <div className="glass rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-dark-700">
                <h2 className="text-lg font-semibold text-white">System Users</h2>
                <button onClick={openAddUser} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  + Add New User
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">User</th>
                    <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">Primary Role</th>
                    <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">Extra Access Grants</th>
                    <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">Effective Collections</th>
                    <th className="text-right px-5 py-3 text-dark-400 text-xs font-medium uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((u) => {
                    const p = pending[u.username] ?? { role: u.role, extra: u.extra_roles ?? [], saving: false };
                    const changed = hasChanged(u.username, u);
                    const collections = resolveCollections(p.role, p.extra);

                    return (
                      <tr key={u.username} className="border-b border-dark-700/50 hover:bg-dark-800/20 transition-colors">
                        {/* User info */}
                        <td className="px-5 py-4">
                          <div className="text-white text-sm font-medium">{u.display_name || u.username}</div>
                          <div className="text-dark-500 text-xs">@{u.username}</div>
                        </td>

                        {/* Primary role dropdown */}
                        <td className="px-5 py-4">
                          <select
                            value={p.role}
                            onChange={(e) => setPendingFor(u.username, { role: e.target.value })}
                            className="px-3 py-1.5 text-xs rounded-lg border transition-all focus:outline-none focus:ring-1 focus:ring-blue-500"
                            style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#e2e8f0' }}
                          >
                            {ROLES.map((r) => <option key={r} value={r} style={{ color: 'black' }}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        </td>

                        {/* Extra access grants — multi toggle */}
                        <td className="px-5 py-4 max-w-xs">
                          <AccessSelector
                            primaryRole={p.role}
                            selected={p.extra}
                            onChange={(next) => setPendingFor(u.username, { extra: next })}
                          />
                        </td>

                        {/* Effective collections */}
                        <td className="px-5 py-4">
                          <div className="flex gap-1 flex-wrap">
                            {collections.map((c) => (
                              <span key={c} className="px-2 py-0.5 text-xs rounded-full bg-dark-800 text-dark-400 border border-dark-700">{c}</span>
                            ))}
                          </div>
                        </td>

                        {/* Actions: Save & Delete */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {changed && (
                              <button
                                onClick={() => handleSave(u.username)}
                                disabled={p.saving}
                                className="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 font-medium"
                              >
                                {p.saving ? 'Saving…' : 'Save'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              disabled={u.username === user.username}
                              className={`p-1.5 rounded-lg border transition-all ${u.username === user.username
                                ? 'bg-dark-800 text-dark-700 border-dark-700 cursor-not-allowed opacity-30'
                                : 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white'
                                }`}
                              title={u.username === user.username ? "Cannot delete yourself" : "Delete User"}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination total={users.length} page={userPage} pageSize={PAGE_SIZE} onChange={setUserPage} />
            </div>
          )}
        </div>
      </div>

      {/* ── Add-User Modal (React Portal) ── */}
      {showAddUser && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddUser(false); }}
        >
          <div className="w-full max-w-md rounded-2xl p-7 shadow-2xl border border-white/10" style={{ background: 'rgba(13,17,36,0.97)' }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Add New User</h3>
                <p className="text-dark-400 text-xs mt-0.5">Provision a new system account</p>
              </div>
              <button onClick={() => setShowAddUser(false)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleAddUser} className="flex flex-col gap-4">
              {addUserError && <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{addUserError}</div>}

              {[
                { label: 'Username', key: 'username', type: 'text', placeholder: 'e.g. jdoe' },
                { label: 'Display Name', key: 'display_name', type: 'text', placeholder: 'e.g. John Doe' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">{label}</label>
                  <input
                    required type={type} value={(newUser as any)[key]}
                    onChange={(e) => setNewUser({ ...newUser, [key]: key === 'username' ? e.target.value.toLowerCase().replace(/\s/g, '') : e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-dark-500"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    required type={showPassword ? 'text' : 'password'} value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Secure password"
                    className="w-full pl-4 pr-12 py-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-dark-500"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
                    {showPassword
                      ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.543-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Primary Role</label>
                  <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {ROLES.map((r) => <option key={r} value={r} style={{ color: 'black' }}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Collections</label>
                  <div className="px-3 py-2.5 rounded-xl text-dark-400 text-xs leading-relaxed" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {(ROLE_COLLECTIONS[newUser.role] ?? []).join(', ')}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 mt-1" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white transition-colors" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>Cancel</button>
                <button type="submit" disabled={isAddingUser} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-medium text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isAddingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
