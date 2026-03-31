'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  triggerIngestion,
  getIngestionStatus,
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
  getEvalStatus,
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

const ROLES = ['employee', 'finance', 'engineering', 'marketing', 'c_level'] as const;
const ROLE_LABELS: Record<string, string> = { employee: 'Employee', finance: 'Finance', engineering: 'Engineering', marketing: 'Marketing', c_level: 'Admin' };
const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  finance: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  engineering: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  marketing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  c_level: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};
const ROLE_COLLECTIONS: Record<string, string[]> = {
  employee: ['general'],
  finance: ['finance', 'general'],
  engineering: ['engineering', 'general'],
  marketing: ['marketing', 'general'],
  c_level: ['finance', 'engineering', 'marketing', 'general'],
};

function resolveCollections(role: string, extra: string[]): string[] {
  const all = new Set<string>(ROLE_COLLECTIONS[role] ?? ['general']);
  extra.forEach((r) => (ROLE_COLLECTIONS[r] ?? []).forEach((c) => all.add(c)));
  return Array.from(all).sort();
}

const PAGE_SIZE = 8;

function Pagination({ total, page, pageSize, onChange }: { total: number; page: number; pageSize: number; onChange: (p: number) => void }) {
  const n = Math.max(1, Math.ceil(total / pageSize));
  if (n <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button disabled={page === 1} onClick={() => onChange(page - 1)} className="px-3 py-1 text-xs rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 disabled:opacity-30">←</button>
      {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
        <button key={p} onClick={() => onChange(p)} className={`px-3 py-1 text-xs rounded-lg ${p === page ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'}`}>{p}</button>
      ))}
      <button disabled={page === n} onClick={() => onChange(page + 1)} className="px-3 py-1 text-xs rounded-lg bg-dark-800 text-dark-400 hover:bg-dark-700 disabled:opacity-30">→</button>
    </div>
  );
}

function AccessSelector({ primaryRole, selected, onChange }: { primaryRole: string; selected: string[]; onChange: (roles: string[]) => void; }) {
  const available = ROLES.filter((r) => r !== primaryRole);
  const toggle = (role: string) => {
    const next = selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role];
    onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((r) => {
        const on = selected.includes(r);
        return (
          <button key={r} type="button" onClick={() => toggle(r)} className={`px-2 py-0.5 text-xs rounded-full border font-medium ${on ? ROLE_COLORS[r] : 'bg-dark-800 text-dark-500 border-dark-700'}`}>
            {on ? '✓ ' : ''}{ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}

function FileUploader({ onUpload, isUploading }: { onUpload: (file: File, collection: string) => void; isUploading: boolean; }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [collection, setCollection] = useState('general');
  const handleDrag = (e: any) => { e.preventDefault(); setDragActive(e.type === 'dragenter' || e.type === 'dragover'); };
  const handleDrop = (e: any) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); };
  return (
    <div className="glass rounded-xl p-6 mb-8 border border-white/5">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">📁 Upload Document</h3>
      <form onSubmit={(e) => { e.preventDefault(); if (file) { onUpload(file, collection); setFile(null); } }} className="flex flex-col gap-4">
        <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive ? 'border-blue-500 bg-blue-500/10' : file ? 'border-green-500/50 bg-green-500/5' : 'border-dark-600 bg-dark-800/50'}`}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          {file ? <p className="text-sm text-white font-medium">{file.name}</p> : <p className="text-sm text-dark-200">Drag & drop or click to browse</p>}
        </div>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-dark-300 mb-1.5 uppercase">Target Collection</label>
            <select value={collection} onChange={(e) => setCollection(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white text-sm focus:outline-none">
              <option value="general">General</option>
              <option value="hr">HR</option>
              <option value="finance">Finance</option>
              <option value="engineering">Engineering</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          <button type="submit" disabled={!file || isUploading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50">
            {isUploading ? 'Uploading...' : 'Upload & Index'}
          </button>
        </div>
      </form>
    </div>
  );
}

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
  const [ingestionStatus, setIngestionStatus] = useState<any>(null);
  const [evalStatus, setEvalStatus] = useState<any>(null);
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'documents' | 'users' | 'eval'>('documents');
  const [docPage, setDocPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [queryPage, setQueryPage] = useState(1);
  const [evalPage, setEvalPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const [pending, setPending] = useState<Record<string, any>>({});
  const [showAddUser, setShowAddUser] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [newUser, setNewUser] = useState({ username: '', password: '', display_name: '', role: 'employee' });
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalTarget, setEvalTarget] = useState<QueryLogInfo | null>(null);
  const [evalGroundTruth, setEvalGroundTruth] = useState('');
  const [isRecommending, setIsRecommending] = useState(false);
  const [isSubmittingToLS, setIsSubmittingToLS] = useState(false);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkGroundTruths, setBulkGroundTruths] = useState<Record<number, string>>({});
  const [selectedQueries, setSelectedQueries] = useState<number[]>([]);
  const [hideExported, setHideExported] = useState(true);
  const [showRunEvalModal, setShowRunEvalModal] = useState(false);

  const toggleQuerySelection = (id: number) => setSelectedQueries(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAllQueries = () => {
    const ids = queries.filter(q => hideExported ? !q.is_exported : true).slice((queryPage - 1) * PAGE_SIZE, queryPage * PAGE_SIZE).map(q => q.id);
    const all = ids.every(id => selectedQueries.includes(id));
    setSelectedQueries(prev => all ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])));
  };

  useEffect(() => {
    const t = localStorage.getItem('finbot_token');
    const u = localStorage.getItem('finbot_user');
    if (!t || !u) { router.push('/'); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== 'c_level') { router.push('/chat'); return; }
    setToken(t); setUser(parsed); loadData(t);
  }, [router]);

  useEffect(() => {
    let int: any;
    if (ingesting && token) {
      int = setInterval(async () => {
        const s = await getIngestionStatus(token);
        setIngestionStatus(s);
        if (s.status === 'completed' || s.status === 'error') { setIngesting(false); if (s.status === 'completed') { toast.success('Re-indexing complete'); loadData(token); } }
      }, 2000);
    }
    return () => clearInterval(int);
  }, [ingesting, token]);

  useEffect(() => {
    let int: any;
    if (isEvalRunning && token) {
      int = setInterval(async () => {
        const s = await getEvalStatus(token);
        setEvalStatus(s);
        if (s.status === 'completed' || s.status === 'error') { setIsEvalRunning(false); if (s.status === 'completed') { toast.success('Eval cycle complete'); loadData(token); } }
      }, 2000);
    }
    return () => clearInterval(int);
  }, [isEvalRunning, token]);

  useEffect(() => { setResultsPage(1); }, [expandedRun]);

  const loadData = async (t: string) => {
    try {
      const [docs, uList, qLogs, eRuns] = await Promise.all([listDocuments(t), listUsers(t), listRecentQueries(t), listEvalRuns(t)]);
      setDocuments(docs); setUsers(uList); setQueries(qLogs); setEvalRuns(eRuns);
      const p: any = {}; uList.forEach((u: any) => p[u.username] = { role: u.role, extra: u.extra_roles ?? [] });
      setPending(p);
    } catch (e) { console.error(e); }
  };

  const handleSaveUser = async (u: string) => {
    const pen = pending[u];
    try {
      const orig = users.find(x => x.username === u);
      if (pen.role !== orig.role) await updateUserRole(u, pen.role, token);
      if (JSON.stringify(pen.extra.sort()) !== JSON.stringify((orig.extra_roles ?? []).sort())) await updateUserExtraRoles(u, pen.extra, token);
      toast.success('User updated'); loadData(token);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteUserClick = async (u: string) => {
    if (u === user?.username) return toast.error('Cannot delete yourself');
    if (!confirm(`Delete user ${u}?`)) return;
    try { await deleteUser(u, token); loadData(token); } catch (e: any) { toast.error(e.message); }
  };

  const handleIngestClick = async () => { setIngesting(true); try { await triggerIngestion(token); } catch (e: any) { setIngesting(false); toast.error(e.message); }};
  const handleDeleteDocClick = async (f: string) => { if (confirm(`Delete ${f}?`)) try { await deleteDocument(f, token); loadData(token); } catch (e: any) { toast.error(e.message); }};
  
  const handleUploadClick = async (f: File, c: string) => {
    setIsUploadingDoc(true); const id = toast.loading('Uploading...');
    try { await uploadDocument(f, c, token); loadData(token); toast.success('Done', { id }); }
    catch (e: any) { toast.error(e.message, { id }); } finally { setIsUploadingDoc(false); }
  };

  const handleRunEvalClick = async () => { setShowRunEvalModal(false); setIsEvalRunning(true); try { await runLangsmithEvaluation(token); } catch (e: any) { setIsEvalRunning(false); toast.error(e.message); }};

  if (!user) return null;

  const filteredQueries = hideExported ? queries.filter(q => !q.is_exported) : queries;
  const pagedDocs = documents.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE);
  const pagedUsers = users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
  const pagedQueries = filteredQueries.slice((queryPage - 1) * PAGE_SIZE, queryPage * PAGE_SIZE);
  const pagedEvalRuns = evalRuns.slice((evalPage - 1) * PAGE_SIZE, evalPage * PAGE_SIZE);

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      <div className="min-h-screen">
        <header className="glass border-b border-dark-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><span className="text-2xl">⚙️</span><h1 className="text-xl font-bold text-white">Admin Panel</h1></div>
          <button onClick={() => router.push('/chat')} className="px-3 py-1.5 text-xs rounded-lg bg-dark-700 text-dark-300">← Back</button>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[{ l: 'Docs', v: documents.length }, { l: 'Chunks', v: documents.reduce((s,d)=>s+d.chunk_count,0) }, { l: 'Users', v: users.length }, { l: 'Queries', v: queries.length }].map(s=>(
              <div key={s.l} className="glass rounded-xl p-5 border border-white/5"><div className="text-dark-400 text-sm">{s.l}</div><div className="text-3xl font-bold text-white mt-1">{s.v}</div></div>
            ))}
          </div>

          <div className="glass rounded-xl p-6 mb-8 border border-white/5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-lg font-semibold text-white">Re-Index Documents</h2><p className="text-dark-400 text-sm mt-1">Re-parse knowledge base into Qdrant</p></div>
              <button onClick={handleIngestClick} disabled={ingesting} className="px-6 py-3 bg-blue-600 rounded-xl text-white font-medium disabled:opacity-50 flex items-center gap-2">
                {ingesting && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                {ingesting ? 'Indexing...' : '🔄 Re-Index Knowledge Base'}
              </button>
            </div>
            {ingestionStatus && ingesting && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-[10px] text-blue-400 uppercase font-bold"><span>{ingestionStatus.message}</span><span>{ingestionStatus.progress}%</span></div>
                <div className="h-1.5 w-full bg-dark-800 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${ingestionStatus.progress}%` }} /></div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-6">
            {(['documents', 'users', 'eval'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'}`}>
                {tab === 'documents' ? '📄 Docs' : tab === 'users' ? '👥 Users' : '📊 Analytics'}
              </button>
            ))}
          </div>

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <FileUploader onUpload={handleUploadClick} isUploading={isUploadingDoc} />
              <div className="glass rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-dark-700"><th className="text-left px-5 py-3 text-dark-400">Document</th><th className="text-left px-5 py-3 text-dark-400">Collection</th><th className="text-center px-5 py-3 text-dark-400">Chunks</th><th className="text-right px-5 py-3 text-dark-400">Actions</th></tr></thead>
                  <tbody>{pagedDocs.map(d=>(
                    <tr key={d.filename} className="border-b border-dark-700/50 hover:bg-dark-800/30">
                      <td className="px-5 py-3 text-dark-200">{d.filename}</td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{d.collection}</span></td>
                      <td className="px-5 py-3 text-center text-dark-300">{d.chunk_count}</td>
                      <td className="px-5 py-3 text-right"><button onClick={()=>handleDeleteDocClick(d.filename)} className="text-red-400 hover:underline">Delete</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pagination total={documents.length} page={docPage} pageSize={PAGE_SIZE} onChange={setDocPage} />
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="glass rounded-xl overflow-hidden border border-white/5">
              <div className="px-6 py-4 flex justify-between border-b border-dark-700"><h2 className="text-lg font-semibold text-white">Users</h2><button onClick={()=>setShowAddUser(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">+ Add User</button></div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-dark-700"><th className="text-left px-5 py-3 text-dark-400">User</th><th className="text-left px-5 py-3 text-dark-400">Role</th><th className="text-left px-5 py-3 text-dark-400">Extra Access</th><th className="text-right px-5 py-3 text-dark-400">Actions</th></tr></thead>
                <tbody>{pagedUsers.map(u=>{
                  const p = pending[u.username] || { role: u.role, extra: u.extra_roles ?? [] };
                  const changed = p.role !== u.role || JSON.stringify(p.extra.sort()) !== JSON.stringify((u.extra_roles ?? []).sort());
                  return (
                    <tr key={u.username} className="border-b border-dark-700/50">
                      <td className="px-5 py-4"><div className="text-white">{u.display_name}</div><div className="text-dark-500 text-xs">@{u.username}</div></td>
                      <td className="px-5 py-4"><select value={p.role} onChange={e=>setPending({...pending, [u.username]:{...p, role:e.target.value}})} className="bg-dark-800 border border-dark-700 text-white rounded-lg px-2 py-1 text-xs">{ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></td>
                      <td className="px-5 py-4"><AccessSelector primaryRole={p.role} selected={p.extra} onChange={ex=>setPending({...pending, [u.username]:{...p, extra:ex}})} /></td>
                      <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                        {changed && <button onClick={()=>handleSaveUser(u.username)} className="px-3 py-1 bg-green-600 text-white rounded text-xs">Save</button>}
                        <button onClick={()=>handleDeleteUserClick(u.username)} className="text-red-400">🗑️</button>
                      </td>
                    </tr>
                )})}</tbody>
              </table>
              <Pagination total={users.length} page={userPage} pageSize={PAGE_SIZE} onChange={setUserPage} />
            </div>
          )}

          {activeTab === 'eval' && (
            <div className="space-y-6">
              <div className="glass rounded-xl p-6 border border-white/5 flex items-center justify-between">
                <div><h2 className="text-lg font-semibold text-white">LangSmith Analytics</h2><p className="text-dark-400 text-sm">Review logs & run evaluations</p></div>
                <div className="flex gap-2">
                  {selectedQueries.length > 0 && <button onClick={()=>setShowBulkModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">🚀 Bulk Promote ({selectedQueries.length})</button>}
                  <button onClick={()=>setShowRunEvalModal(true)} disabled={isEvalRunning} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                    {isEvalRunning ? 'Evaluating...' : '▶ Run Eval'}
                  </button>
                </div>
              </div>
              {evalStatus && isEvalRunning && (
                <div className="glass rounded-xl p-6 border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs text-purple-400 font-bold uppercase"><span>{evalStatus.message}</span><span>{evalStatus.current}/{evalStatus.total}</span></div>
                  <div className="h-1.5 w-full bg-dark-800 rounded-full overflow-hidden"><div className="h-full bg-purple-600 transition-all shadow-[0_0_8px_rgba(147,51,234,0.5)]" style={{ width: `${evalStatus.progress}%` }} /></div>
                </div>
              )}
              <div className="glass rounded-xl overflow-hidden border border-white/5">
                <div className="px-5 py-3 border-b border-dark-700 flex justify-between items-center"><h3 className="text-sm font-bold text-white">Query Logs</h3><button onClick={()=>setHideExported(!hideExported)} className="text-[10px] px-2 py-0.5 rounded-full border border-dark-700 text-dark-400">{hideExported ? '👁️ New Only' : '👁️ All'}</button></div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-dark-800/20 text-dark-400 uppercase font-medium border-b border-dark-700"><th className="w-10 px-5 py-3 text-left"><input type="checkbox" onChange={toggleAllQueries} /></th><th className="text-left px-5 py-3">Date</th><th className="text-left px-5 py-3">Query & Answer</th><th className="text-right px-5 py-3">Actions</th></tr></thead>
                  <tbody>{pagedQueries.map(q=>(
                    <tr key={q.id} className={`border-b border-dark-700/50 hover:bg-dark-800/20 ${selectedQueries.includes(q.id)?'bg-blue-600/5':''}`}>
                      <td className="px-5 py-4"><input type="checkbox" checked={selectedQueries.includes(q.id)} onChange={()=>toggleQuerySelection(q.id)} /></td>
                      <td className="px-5 py-4 text-dark-400">{new Date(q.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-4"><div className="text-white font-medium mb-1 truncate max-w-lg" title={q.query}>Q: {q.query}</div><div className="text-dark-500 truncate max-w-lg" title={q.answer}>A: {q.answer}</div></td>
                      <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                        {q.is_exported ? <span className="text-green-400">✅ Pushed</span> : <button onClick={()=>{setEvalTarget(q); setEvalGroundTruth(''); setShowEvalModal(true);}} className="text-blue-400 hover:underline">+ Golden</button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                <Pagination total={filteredQueries.length} page={queryPage} pageSize={PAGE_SIZE} onChange={setQueryPage} />
              </div>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white px-2">History</h2>
                {pagedEvalRuns.map(run => {
                  const pct = run.avg_exact_match ? Math.round(run.avg_exact_match * 100) : 0;
                  const expanded = expandedRun === run.id;
                  const ex = run.per_example_results ? JSON.parse(run.per_example_results) : [];
                  return (
                    <div key={run.id} className="glass rounded-xl border border-white/5 overflow-hidden">
                      <button onClick={()=>setExpandedRun(expanded?null:run.id)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center font-bold text-purple-400 border border-purple-500/20">{pct}%</div><div><div className="text-white font-bold">{run.experiment_name}</div><div className="text-dark-500 text-[10px] mt-0.5">{new Date(run.created_at).toLocaleString()} · {run.total_examples} examples</div></div></div>
                        <div className="flex items-center gap-3">
                          {run.results_url && <a href={run.results_url} target="_blank" className="text-purple-400 text-[10px] border border-purple-500/20 px-2 py-1 rounded-lg">↗ LangSmith</a>}
                          <button onClick={(e)=>{e.stopPropagation(); deleteEvalRun(run.id, token).then(()=>loadData(token));}} className="text-red-500 text-xs">🗑️</button>
                        </div>
                      </button>
                      {expanded && ex.length>0 && (
                        <div className="p-4 bg-dark-900/40 border-t border-white/5">
                          <table className="w-full text-[10px]">
                            <thead><tr className="text-dark-500 uppercase"><th className="text-left pb-2">Query</th><th className="text-left pb-2">Truth</th><th className="text-center pb-2">Score</th></tr></thead>
                            <tbody>{ex.slice((resultsPage - 1) * 5, resultsPage * 5).map((e:any,i:number)=>(
                              <tr key={i} onClick={() => setSelectedResult(e)} className="border-t border-white/5 cursor-pointer hover:bg-white/5 transition-all">
                                <td className="py-2 pr-4 text-white max-w-[200px] truncate" title={e.query}>{e.query}</td>
                                <td className="py-2 pr-4 text-dark-500 max-w-[200px] truncate" title={e.ground_truth}>{e.ground_truth}</td>
                                <td className="py-2 text-center text-blue-400 font-mono">{Math.round((e.score||0)*100)}%</td>
                              </tr>
                            ))}</tbody>
                          </table>
                          <Pagination total={ex.length} page={resultsPage} pageSize={5} onChange={setResultsPage} />
                        </div>
                      )}
                    </div>
                  )
                })}
                <Pagination total={evalRuns.length} page={evalPage} pageSize={PAGE_SIZE} onChange={setEvalPage} />
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddUser && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)'}} onClick={e=>e.target===e.currentTarget&&setShowAddUser(false)}>
          <div className="w-full max-w-md rounded-2xl p-7 border border-white/10 glass" style={{background:'#0d1124'}}>
            <h3 className="text-xl font-bold text-white mb-6">Add User</h3>
            <form onSubmit={async e=>{e.preventDefault(); setIsAddingUser(true); try{const r=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(newUser)}); if(!r.ok) throw new Error('Failed'); setShowAddUser(false); loadData(token);}catch(e:any){setAddUserError(e.message);}finally{setIsAddingUser(false);}}} className="space-y-4">
              {['username','display_name','password'].map(k=>(<div key={k}><label className="block text-[10px] font-bold text-dark-400 uppercase mb-1">{k}</label><input required type={k==='password'?'password':'text'} value={(newUser as any)[k]} onChange={e=>setNewUser({...newUser, [k]:e.target.value})} className="w-full bg-dark-800 border border-dark-700 text-white px-4 py-2 rounded-xl focus:outline-none"/></div>))}
              <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="w-full bg-dark-800 border border-dark-700 text-white px-4 py-2 rounded-xl">{ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
              <div className="flex gap-2 pt-4"><button type="button" onClick={()=>setShowAddUser(false)} className="flex-1 py-2 text-white border border-white/10 rounded-xl">Cancel</button><button type="submit" disabled={isAddingUser} className="flex-1 py-2 bg-blue-600 text-white rounded-xl">{isAddingUser?'Creating...':'Add'}</button></div>
            </form>
          </div>
        </div>, document.body
      )}

      {showEvalModal && evalTarget && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)'}} onClick={e=>e.target===e.currentTarget&&setShowEvalModal(false)}>
          <div className="w-full max-w-lg rounded-2xl p-7 border border-white/10 glass" style={{background:'#0d1124'}}>
            <h3 className="text-xl font-bold text-white mb-4">Promote to Dataset</h3>
            <div className="space-y-4">
              <div className="bg-dark-900 border border-white/5 p-4 rounded-xl"><div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Query</div><div className="text-white text-sm italic">"{evalTarget.query}"</div></div>
              <div className="space-y-2">
                <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-dark-400 uppercase">Golden Truth</label><button onClick={async()=>{setIsRecommending(true); try{const r=await recommendGroundTruth(evalTarget.query,evalTarget.answer,token); setEvalGroundTruth(r);}finally{setIsRecommending(false);}}} className="text-[10px] text-blue-400">✨ Recommend</button></div>
                <textarea value={evalGroundTruth} onChange={e=>setEvalGroundTruth(e.target.value)} className="w-full h-32 bg-dark-800 border border-white/10 text-white p-3 rounded-xl focus:outline-none" />
              </div>
              <div className="flex gap-2 pt-2"><button onClick={()=>setShowEvalModal(false)} className="flex-1 py-3 text-white border border-white/10 rounded-xl">Cancel</button><button disabled={!evalGroundTruth||isSubmittingToLS} onClick={async()=>{setIsSubmittingToLS(true); try{await addToLangsmithDataset(evalTarget.id,evalTarget.query,evalTarget.answer,evalGroundTruth,token); toast.success('Added'); setShowEvalModal(false); setQueries(prev=>prev.map(q=>q.id===evalTarget.id?{...q,is_exported:true}:q));}catch(e:any){toast.error(e.message);}finally{setIsSubmittingToLS(false);}}} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Push to LangSmith</button></div>
            </div>
          </div>
        </div>, document.body
      )}

      {showBulkModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)', backdropFilter:'blur(16px)'}} onClick={e=>e.target===e.currentTarget&&setShowBulkModal(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl p-7 border border-white/10 glass" style={{background:'#0d1124'}}>
            <h3 className="text-2xl font-bold text-white mb-6">Bulk Promote ({selectedQueries.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {selectedQueries.map(id => {const q=queries.find(x=>x.id===id); if(!q)return null; return (
                <div key={id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-blue-400 uppercase">Q: {q.query}</div>
                  <textarea placeholder="Ground truth..." value={bulkGroundTruths[id]||''} onChange={e=>setBulkGroundTruths({...bulkGroundTruths, [id]:e.target.value})} className="w-full h-20 bg-dark-900 border border-white/5 text-white p-2 rounded-lg text-xs focus:outline-none"/>
                </div>
              )})}
            </div>
            <div className="flex gap-3 pt-6 border-t border-white/5 mt-6"><button onClick={()=>setShowBulkModal(false)} className="flex-1 py-3 text-white border border-white/10 rounded-xl">Cancel</button><button disabled={isBulkSubmitting} onClick={async()=>{setIsBulkSubmitting(true); try{const items=selectedQueries.map(id=>{const q=queries.find(x=>x.id===id)!; return {id, query:q.query, answer:q.answer, ground_truth:bulkGroundTruths[id]||q.answer};}); await bulkAddtoLangsmithDataset(items,token); toast.success('Done'); setShowBulkModal(false); setSelectedQueries([]); loadData(token);}catch(e:any){toast.error(e.message);}finally{setIsBulkSubmitting(false);}}} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">🚀 Launch Bulk</button></div>
          </div>
        </div>, document.body
      )}

      {showRunEvalModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)'}} onClick={e=>e.target===e.currentTarget&&setShowRunEvalModal(false)}>
          <div className="w-full max-w-sm rounded-2xl p-7 border border-white/10 glass text-center" style={{background:'#0d1124'}}>
            <h3 className="text-xl font-bold text-white mb-2">Run Validation?</h3>
            <p className="text-dark-400 text-sm mb-6">Executes eval suite against golden dataset.</p>
            <div className="flex gap-2"><button onClick={()=>setShowRunEvalModal(false)} className="flex-1 py-2 text-white border border-white/10 rounded-xl">Cancel</button><button onClick={handleRunEvalClick} className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold">Launch</button></div>
          </div>
        </div>, document.body
      )}

      {selectedResult && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:p-8" style={{background:'rgba(0,0,0,0.9)', backdropFilter:'blur(16px)'}} onClick={e=>e.target===e.currentTarget&&setSelectedResult(null)}>
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 glass flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300" style={{background:'rgba(13,17,36,0.98)'}}>
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Result Analysis</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(selectedResult.score||0) >= 0.8 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {Math.round((selectedResult.score||0)*100)}% Match
                  </span>
                  <span className="text-dark-500 text-[10px] uppercase font-mono">Similarity Index</span>
                </div>
              </div>
              <button onClick={()=>setSelectedResult(null)} className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/5 transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh] p-8 space-y-8 custom-scrollbar">
              <section>
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 font-mono px-1">User Query</div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-lg text-white font-medium italic leading-relaxed">
                  "{selectedResult.query}"
                </div>
              </section>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 font-mono px-1">Golden Truth</div>
                  <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-sm text-emerald-100/90 leading-relaxed min-h-[200px]">
                    {selectedResult.ground_truth}
                  </div>
                </section>
                <section>
                  <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3 font-mono px-1">Bot Answer (RAG)</div>
                  <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 text-sm text-purple-100/90 leading-relaxed min-h-[200px]">
                    {selectedResult.actual_answer || 'No answer recorded'}
                  </div>
                </section>
              </div>
            </div>
            <div className="px-8 py-6 bg-dark-900/40 border-t border-white/5 flex justify-end">
              <button onClick={()=>setSelectedResult(null)} className="px-8 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10">Close Analysis</button>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
