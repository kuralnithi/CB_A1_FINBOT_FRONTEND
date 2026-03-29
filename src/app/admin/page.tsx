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
  uploadDocument,
  listRecentQueries,
  addToLangsmithDataset,
  bulkAddtoLangsmithDataset,
  runLangsmithEvaluation,
  recommendGroundTruth,
  listEvalRuns,
  deleteEvalRun,
  deleteQueryLog,
  type User,
  type DocumentInfo,
  type QueryLogInfo,
  type EvalRunInfo,
} from '@/lib/api';
import { Toaster, toast } from 'sonner';

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

// ─── File Uploader ─────────────────────────────────────────────────────────────
function FileUploader({
  onUpload,
  isUploading,
}: {
  onUpload: (file: File, collection: string) => void;
  isUploading: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [collection, setCollection] = useState('general');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile) {
      onUpload(selectedFile, collection);
      setSelectedFile(null);
    }
  };

  return (
    <div className="glass rounded-xl p-6 mb-8 border border-white/5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <span className="text-xl">📁</span> Upload New Document
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all text-center ${dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : selectedFile
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-dark-600 hover:border-dark-400 bg-dark-800/50'
            }`}
        >
          <input
            type="file"
            id="file-upload"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept=".pdf,.md,.docx,.csv"
          />
          <div className="flex flex-col items-center">
            {selectedFile ? (
              <>
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-2">✓</div>
                <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                <p className="text-xs text-dark-400 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                <button type="button" onClick={() => setSelectedFile(null)} className="mt-3 text-xs text-red-400 hover:underline">Change File</button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2">↑</div>
                <p className="text-sm text-dark-200">Drag & drop your file here or click to browse</p>
                <p className="text-xs text-dark-500 mt-1">Supports PDF, Markdown, DOCX, CSV</p>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase tracking-wide">Target Collection</label>
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="general">General (Public/All)</option>
              <option value="hr">General (HR Docs)</option>
              <option value="finance">Finance (Confidential)</option>
              <option value="engineering">Engineering (Internal)</option>
              <option value="marketing">Marketing (Strategic)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isUploading ? 'Uploading...' : 'Upload & Index'}
          </button>
        </div>
      </form>
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
  const [queries, setQueries] = useState<QueryLogInfo[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRunInfo[]>([]);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'documents' | 'users' | 'eval'>('documents');
  const [docPage, setDocPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [queryPage, setQueryPage] = useState(1);

  // Per-user pending edits  { username: { role, extraRoles, saving } }
  const [pending, setPending] = useState<Record<string, { role: string; extra: string[]; saving: boolean }>>({});

  // Add-user modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', display_name: '', role: 'employee' });

  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  // Eval Modal State
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalTarget, setEvalTarget] = useState<QueryLogInfo | null>(null);
  const [evalGroundTruth, setEvalGroundTruth] = useState('');
  const [isRecommending, setIsRecommending] = useState(false);
  const [isSubmittingToLS, setIsSubmittingToLS] = useState(false);

  // Bulk Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkGroundTruths, setBulkGroundTruths] = useState<Record<number, string>>({});

  // Multi-select state
  const [selectedQueries, setSelectedQueries] = useState<number[]>([]);
  const [hideExported, setHideExported] = useState(true);

  // Run Eval Modal State
  const [showRunEvalModal, setShowRunEvalModal] = useState(false);

  const toggleQuerySelection = (id: number) => {
    setSelectedQueries(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAllQueries = () => {
    const currentIds = pagedQueries.map(q => q.id);
    const allSelected = currentIds.every(id => selectedQueries.includes(id));
    if (allSelected) {
      setSelectedQueries(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedQueries(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const handleRecommendTruth = async () => {
    if (!evalTarget) return;
    setIsRecommending(true);
    try {
      const rec = await recommendGroundTruth(evalTarget.query, evalTarget.answer, token);
      setEvalGroundTruth(rec);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRecommending(false);
    }
  };

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
      const [docs, userList, queryLogs, evalRunList] = await Promise.all([
        listDocuments(t),
        listUsers(t),
        listRecentQueries(t),
        listEvalRuns(t),
      ]);
      setDocuments(docs);
      setUsers(userList);
      setQueries(queryLogs);
      setEvalRuns(evalRunList);
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
      toast.success('User updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
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
    const id = toast.loading('Re-indexing documents...');
    try { 
      const r = await triggerIngestion(token); 
      setIngestResult(r); 
      await loadData(token); 
      toast.success('Re-indexing complete', { id });
    }
    catch (err: any) { 
      setError(err.message || 'Ingestion failed'); 
      toast.error('Re-indexing failed', { id });
    }
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

  const handleUpload = async (file: File, collection: string) => {
    setIsUploadingDocument(true);
    setError('');
    const id = toast.loading(`Uploading ${file.name}...`);
    try {
      await uploadDocument(file, collection, token);
      await loadData(token);
      toast.success('Document uploaded and indexed!', { id });
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      toast.error('Upload failed', { id });
    } finally {
      setIsUploadingDocument(false);
    }
  };

  const handleRunEval = async () => {
    setShowRunEvalModal(false);
    const loadingId = toast.loading("Launching LangSmith evaluation suite...");
    try {
      const res = await runLangsmithEvaluation(token);
      
      const hasUrl = res.results_url && res.results_url.startsWith('http');
      
      toast.success(res.message, { 
        id: loadingId,
        action: hasUrl ? {
          label: 'View Results',
          onClick: () => window.open(res.results_url, '_blank')
        } : undefined,
        duration: 10000 // Keep it longer so the user can click it
      });
      
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger evaluation", { id: loadingId });
    }
  };

  const handleDeleteQuery = async (id: number) => {
    if (!confirm("Are you sure you want to delete this query log? This doesn't remove it from LangSmith if already pushed.")) return;
    try {
      const ok = await deleteQueryLog(id, token);
      if (ok) {
        setQueries(prev => prev.filter(q => q.id !== id));
        toast.success("Query log deleted.");
      }
    } catch (err) {
      toast.error("Failed to delete query");
    }
  };

  const handleDeleteRun = async (id: number) => {
    if (!confirm("Permanently delete this evaluation run from history?")) return;
    try {
      const ok = await deleteEvalRun(id, token);
      if (ok) {
        setEvalRuns(prev => prev.filter(r => r.id !== id));
        toast.success("Evaluation history cleared.");
      }
    } catch (err) {
      toast.error("Failed to remove evaluation history");
    }
  };

  if (!user) return null;

  const totalChunks = documents.reduce((s, d) => s + d.chunk_count, 0);
  const pagedDocs = documents.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE);
  const pagedUsers = users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
  
  const filteredQueries = hideExported ? queries.filter(q => !q.is_exported) : queries;
  const pagedQueries = filteredQueries.slice((queryPage - 1) * PAGE_SIZE, queryPage * PAGE_SIZE);

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            {[{ label: 'Documents', value: documents.length }, 
              { label: 'Total Chunks', value: totalChunks }, 
              { label: 'Users', value: users.length },
              { label: 'Queries Logged', value: queries.length }
             ].map((s) => (
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
            {(['documents', 'users', 'eval'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'}`}>
                {tab === 'documents' ? `📄 Documents (${documents.length})` : tab === 'users' ? `👥 Users (${users.length})` : `📊 Analytics & Evals (${queries.length})`}
              </button>
            ))}
          </div>

          {/* ── Documents Tab ── */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <FileUploader onUpload={handleUpload} isUploading={isUploadingDocument} />
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

          {/* ── Eval Tab ── */}
          {activeTab === 'eval' && (
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                 <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">LangSmith Evaluation</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-dark-400 text-sm">Selectively promote user queries to your golden dataset.</p>
                        <button 
                          onClick={() => setHideExported(!hideExported)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all flex items-center gap-1.5 ${hideExported ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-dark-800 text-dark-500 border-dark-700'}`}
                        >
                          {hideExported ? '👁️ Showing New Only' : '👁️ Showing All'}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       {selectedQueries.length > 0 && (
                          <button 
                             onClick={() => setShowBulkModal(true)} 
                             className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                          >
                             🚀 Bulk Promote ({selectedQueries.length})
                          </button>
                       )}
                       <button onClick={() => setShowRunEvalModal(true)} className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all flex items-center gap-2">
                          ▶ Run LangSmith Eval
                       </button>
                    </div>
                 </div>
              </div>

              <div className="glass rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700 bg-dark-800/20">
                      <th className="px-5 py-3 w-10">
                         <input 
                            type="checkbox" 
                            disabled={pagedQueries.length === 0}
                            checked={pagedQueries.length > 0 && pagedQueries.every(q => selectedQueries.includes(q.id))}
                            onChange={toggleAllQueries}
                            className="w-4 h-4 rounded-md border-dark-600 bg-dark-800 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                         />
                      </th>
                      <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">User</th>
                      <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase w-1/3">Query & Answer</th>
                      <th className="text-left px-5 py-3 text-dark-400 text-xs font-medium uppercase">Routing</th>
                      <th className="text-right px-5 py-3 text-dark-400 text-xs font-medium uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedQueries.length === 0 ? (
                       <tr><td colSpan={6} className="text-center py-12 text-dark-500">No matching queries found.</td></tr>
                    ) : pagedQueries.map((q) => (
                      <tr key={q.id} className={`border-b border-dark-700/50 hover:bg-dark-800/30 transition-colors ${selectedQueries.includes(q.id) ? 'bg-blue-600/5' : ''}`}>
                        <td className="px-5 py-4">
                           <input 
                              type="checkbox" 
                              checked={selectedQueries.includes(q.id)}
                              onChange={() => toggleQuerySelection(q.id)}
                              className="w-4 h-4 rounded-md border-dark-600 bg-dark-800 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                           />
                        </td>
                        <td className="px-5 py-4 text-dark-300 text-xs whitespace-nowrap">
                           {new Date(q.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                           <div className="text-white text-sm font-medium">@{q.username}</div>
                           <div className="text-dark-500 text-xs mt-0.5">{ROLE_LABELS[q.user_role] ?? q.user_role}</div>
                        </td>
                        <td className="px-5 py-4">
                           <div className="text-white text-sm font-medium mb-1">Q: {q.query}</div>
                           <div className="text-dark-400 text-xs line-clamp-2" title={q.answer}>A: {q.answer}</div>
                        </td>
                        <td className="px-5 py-4">
                           <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                              {q.routing_selected || 'general'}
                           </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                              {q.is_exported ? (
                                <span className="px-3 py-1.5 text-xs rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 font-medium flex items-center justify-center gap-1.5 w-fit">
                                  ✅ Pushed
                                </span>
                              ) : (
                                <button onClick={() => {
                                  setEvalTarget(q);
                                  setEvalGroundTruth('');
                                  setShowEvalModal(true);
                                }} className="px-3 py-1.5 text-xs rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors">
                                  + Add to Eval
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteQuery(q.id); }}
                                className="p-1.5 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title="Delete log"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={filteredQueries.length} page={queryPage} pageSize={PAGE_SIZE} onChange={setQueryPage} />
              </div>

            {/* ── Eval History Panel ── */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Evaluation History</h2>
                  <p className="text-dark-400 text-sm mt-0.5">{evalRuns.length} past runs stored in your database</p>
                </div>
              </div>

              {evalRuns.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-dark-500 text-sm">
                  No evaluation runs yet. Click <strong className="text-purple-400">▶ Run LangSmith Eval</strong> above to begin.
                </div>
              ) : (
                <div className="space-y-3">
                  {evalRuns.map(run => {
                    const score = run.avg_exact_match;
                    const pct = score !== null ? Math.round(score * 100) : null;
                    const colour = pct === null ? 'text-dark-500' : pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';
                    const bgColour = pct === null ? 'bg-dark-800 border-dark-700' : pct >= 70 ? 'bg-green-500/10 border-green-500/20' : pct >= 40 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';
                    const examples: any[] = run.per_example_results ? JSON.parse(run.per_example_results) : [];
                    const isExpanded = expandedRun === run.id;

                    return (
                      <div key={run.id} className="glass rounded-xl border border-white/5 overflow-hidden">
                        {/* Run Summary Row */}
                        <button
                          onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-black ${bgColour} border`}>
                              <span className={`${colour} text-lg leading-none`}>{pct !== null ? `${pct}%` : '—'}</span>
                              <span className="text-[8px] text-dark-500 mt-0.5 uppercase tracking-wider">similarity</span>
                            </div>
                            <div>
                              <div className="text-white font-semibold text-sm">{run.experiment_name}</div>
                              <div className="text-dark-400 text-xs mt-0.5">{new Date(run.created_at).toLocaleString()} · by @{run.triggered_by}</div>
                              <div className="text-dark-500 text-xs">{run.total_examples} examples · semantic-similarity evaluator</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {run.results_url && run.results_url.startsWith('http') && (
                              <a
                                href={run.results_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="px-3 py-1.5 text-xs rounded-lg bg-purple-600/10 text-purple-400 border border-purple-500/20 hover:bg-purple-600/20 transition-colors"
                              >
                                ↗ LangSmith
                              </a>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                              className="p-1.5 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-400/10 transition-all border border-transparent hover:border-red-400/20"
                              title="Delete evaluation run"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <svg className={`w-4 h-4 text-dark-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* Expanded Per-Example Results */}
                        {isExpanded && examples.length > 0 && (
                          <div className="border-t border-white/5">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-dark-800/30">
                                  <th className="text-left px-5 py-2 text-dark-400 font-medium uppercase tracking-wider">Query</th>
                                  <th className="text-left px-5 py-2 text-dark-400 font-medium uppercase tracking-wider">Ground Truth</th>
                                  <th className="text-left px-5 py-2 text-dark-400 font-medium uppercase tracking-wider">Bot Answer</th>
                                  <th className="text-center px-4 py-2 text-dark-400 font-medium uppercase tracking-wider w-20">Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {examples.map((ex, i) => (
                                  <tr key={i} className="border-t border-dark-700/30 hover:bg-dark-800/20">
                                    <td className="px-5 py-3 text-white max-w-[200px] truncate" title={ex.query}>{ex.query}</td>
                                    <td className="px-5 py-3 text-dark-400 max-w-[200px] truncate" title={ex.ground_truth}>{ex.ground_truth}</td>
                                    <td className="px-5 py-3 text-dark-300 max-w-[200px] truncate" title={ex.actual_answer}>{ex.actual_answer}</td>
                                    <td className="px-5 py-3 text-center">
                                      {(() => {
                                        const s = ex.score ?? 0;
                                        const p = Math.round(s * 100);
                                        const col = p >= 80 ? 'bg-green-500/20 text-green-400' : p >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
                                        return (
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col}`}>
                                            {p}% Sim
                                          </span>
                                        );
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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

      {/* ── Eval Modal (React Portal) ── */}
      {showEvalModal && evalTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 ring-1 ring-white/10"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEvalModal(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl p-7 shadow-2xl border border-white/10 glass overflow-hidden" style={{ background: 'rgba(13,17,36,0.98)' }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Promote to Dataset</h3>
                <p className="text-dark-400 text-xs mt-0.5">Define a Golden Truth for this query</p>
              </div>
              <button onClick={() => setShowEvalModal(false)} className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-dark-900/50 border border-white/5">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 font-mono">User Query</div>
                <div className="text-sm text-white font-medium italic">"{evalTarget.query}"</div>
              </div>

              <div className="p-4 rounded-xl bg-dark-900/10 border border-white/5">
                <div className="text-xs font-bold text-dark-500 uppercase tracking-widest mb-2 font-mono">Current Answer</div>
                <div className="text-xs text-dark-300 line-clamp-3 overflow-y-auto max-h-24">
                  {evalTarget.answer}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-dark-300 uppercase tracking-widest font-mono">Golden Truth Answer</label>
                  <button 
                    onClick={handleRecommendTruth}
                    disabled={isRecommending}
                    className="text-[10px] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/30 disabled:opacity-50"
                  >
                    {isRecommending ? (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : '✨ Recommend Truth'}
                  </button>
                </div>
                <textarea
                  value={evalGroundTruth}
                  onChange={(e) => setEvalGroundTruth(e.target.value)}
                  placeholder="Paste or type the perfect answer here..."
                  className="w-full min-h-[140px] px-4 py-3 rounded-xl bg-dark-800 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-dark-600 font-sans"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowEvalModal(false)} 
                  className="flex-1 py-3 rounded-xl font-medium text-sm text-white transition-all border border-white/10 hover:bg-white/5 active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  disabled={!evalGroundTruth || isSubmittingToLS}
                  onClick={async () => {
                    setIsSubmittingToLS(true);
                    try {
                      const res = await addToLangsmithDataset(evalTarget.id, evalTarget.query, evalTarget.answer, evalGroundTruth, token);
                      toast.success(res.message || 'Successfully added to LangSmith golden dataset.');
                      setShowEvalModal(false);
                      // Optimistically update local state — the item will disappear from the "New Only" view immediately
                      setQueries(prev => prev.map(q => q.id === evalTarget.id ? { ...q, is_exported: true } : q));
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to add to dataset');
                    } finally {
                      setIsSubmittingToLS(false);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSubmittingToLS && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {isSubmittingToLS ? 'Submitting...' : 'Upload to LangSmith'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Bulk Eval Modal (React Portal) ── */}
      {showBulkModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}
        >
          <div className="w-full max-w-4xl rounded-2xl p-7 shadow-2xl border border-white/10 glass max-h-[90vh] flex flex-col" style={{ background: 'rgba(13,17,36,0.99)' }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">Bulk Promotion</h3>
                <p className="text-dark-400 text-sm mt-0.5">Review and promote {selectedQueries.length} items to LangSmith</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              {selectedQueries.map((id) => {
                const q = queries.find(x => x.id === id);
                if (!q) return null;
                return (
                  <div key={id} className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Query</div>
                        <div className="text-sm text-white font-medium italic">"{q.query}"</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-dark-500 uppercase tracking-widest mb-1">Answer</div>
                        <div className="text-xs text-dark-400 line-clamp-2 italic">"{q.answer}"</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                         <label className="text-[10px] font-bold text-dark-300 uppercase tracking-widest">Ground Truth</label>
                         <button 
                            onClick={async () => {
                               const rec = await recommendGroundTruth(q.query, q.answer, token);
                               setBulkGroundTruths(prev => ({ ...prev, [id]: rec }));
                            }}
                            className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all"
                         >
                            ✨ Recommend
                         </button>
                      </div>
                      <textarea
                        value={bulkGroundTruths[id] || ""}
                        onChange={(e) => setBulkGroundTruths(prev => ({ ...prev, [id]: e.target.value }))}
                        placeholder="Type ground truth..."
                        className="w-full h-20 px-3 py-2 rounded-lg bg-dark-900/50 border border-white/5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 pt-6 mt-6 border-t border-white/5">
              <button 
                type="button" 
                onClick={() => setShowBulkModal(false)} 
                className="flex-1 py-3 rounded-xl font-medium text-sm text-white transition-all border border-white/10 hover:bg-white/5"
              >
                Cancel
              </button>
              <button 
                type="button" 
                disabled={isBulkSubmitting || selectedQueries.length === 0}
                onClick={async () => {
                  setIsBulkSubmitting(true);
                  try {
                    const items = selectedQueries.map(id => {
                      const q = queries.find(x => x.id === id)!;
                      return {
                        id,
                        query: q.query,
                        answer: q.answer,
                        ground_truth: bulkGroundTruths[id] || q.answer // Default to current answer if not set
                      };
                    });
                    const res = await bulkAddtoLangsmithDataset(items, token);
                    const successIds = res.results.filter((r: any) => r.status === 'success').map((r: any) => r.id);
                    toast.success(`Successfully promoted ${successIds.length} of ${items.length} items.`);
                    setShowBulkModal(false);
                    setSelectedQueries([]);
                    setBulkGroundTruths({});
                    // Optimistically update local state
                    setQueries(prev => prev.map(q => successIds.includes(q.id) ? { ...q, is_exported: true } : q));
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setIsBulkSubmitting(false);
                  }
                }}
                className="flex-2 py-3 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-sm text-white transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isBulkSubmitting && (
                   <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                   </svg>
                )}
                {isBulkSubmitting ? 'Promoting...' : `🚀 Launch Bulk Promotion (${selectedQueries.length})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Run Eval Confirmation Modal ── */}
      {showRunEvalModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 ring-1 ring-white/10"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRunEvalModal(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-7 shadow-2xl border border-white/10 glass overflow-hidden text-center" style={{ background: 'rgba(13,17,36,0.98)' }}>
            <div className="mx-auto w-12 h-12 bg-purple-500/10 text-purple-400 rounded-full flex items-center justify-center mb-4">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Run Validation Suite?</h3>
            <p className="text-dark-400 text-sm mb-6">This will execute a full evaluation against all examples currently inside your LangSmith golden dataset. It may take a minute to process.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRunEvalModal(false)}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white transition-all border border-white/10 hover:bg-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={handleRunEval}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 font-bold text-sm text-white transition-all shadow-lg shadow-purple-500/20"
              >
                Launch Eval
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
