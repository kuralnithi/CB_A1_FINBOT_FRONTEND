'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  triggerIngestion,
  getIngestionStatus,
  listDocuments,
  deleteDocument,
  listUsers,
  createUser,
  updateUserRole,
  updateUserExtraRoles,
  deleteUser,
  uploadDocument,
  listRecentQueries,
  addToLangsmithDataset,
  bulkAddToLangsmithDataset,
  runLangsmithEvaluation,
  getEvalStatus,
  recommendGroundTruth,
  listEvalRuns,
  deleteEvalRun,
} from '@/lib/api';
import { Toaster, toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { Pagination } from '@/components/Pagination';
import { ProgressBar } from '@/components/ProgressBar';
import { FileUploader } from '@/components/FileUploader';
import { AccessSelector } from '@/components/AccessSelector';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { usePolling } from '@/hooks/usePolling';
import {
  ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  PAGE_SIZE,
  RESULTS_PAGE_SIZE,
  POLL_INTERVAL_MS,
} from '@/lib/constants';
import { PAGE_ROUTES } from '@/lib/routes';
import type {
  DocumentInfo,
  QueryLogInfo,
  EvalRunInfo,
  User as UserType,
} from '@/lib/types';

export default function AdminPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth({ requiredRole: 'c_level' });
  
  // Data state
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [queries, setQueries] = useState<QueryLogInfo[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRunInfo[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'documents' | 'users' | 'eval'>('documents');
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [pending, setPending] = useState<Record<string, any>>({});
  
  // Status state
  const [ingesting, setIngesting] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState<any>(null);
  const [evalStatus, setEvalStatus] = useState<any>(null);
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  
  // Modal state
  const [showAddUser, setShowAddUser] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', display_name: '', role: 'employee' });
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalTarget, setEvalTarget] = useState<QueryLogInfo | null>(null);
  const [evalGroundTruth, setEvalGroundTruth] = useState('');
  const [isRecommending, setIsRecommending] = useState(false);
  const [isSubmittingToLS, setIsSubmittingToLS] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [isBulkRecommending, setIsBulkRecommending] = useState(false);
  const [bulkGroundTruths, setBulkGroundTruths] = useState<Record<number, string>>({});
  const [selectedQueries, setSelectedQueries] = useState<number[]>([]);
  const [hideExported, setHideExported] = useState(true);
  const [showRunEvalModal, setShowRunEvalModal] = useState(false);

  // Data Loading
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [docs, uList, qLogs, eRuns] = await Promise.all([
        listDocuments(token),
        listUsers(token),
        listRecentQueries(token),
        listEvalRuns(token),
      ]);
      setDocuments(docs);
      setUsers(uList);
      setQueries(qLogs);
      setEvalRuns(eRuns);
      const p: any = {};
      uList.forEach((u: any) => (p[u.username] = { 
        role: u.role, 
        extra: (u.extra_roles ?? []).filter(Boolean) 
      }));
      setPending(p);
    } catch (e) {
      console.error('Failed to load admin data:', e);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadData();
  }, [token, loadData]);

  // Pagination Hooks
  const {
    page: docPage,
    setPage: setDocPage,
    pagedItems: pagedDocs,
  } = usePagination(documents, PAGE_SIZE);

  const {
    page: userPage,
    setPage: setUserPage,
    pagedItems: pagedUsers,
  } = usePagination(users, PAGE_SIZE);

  const filteredQueries = hideExported ? queries.filter((q) => !q.is_exported) : queries;
  const {
    page: queryPage,
    setPage: setQueryPage,
    pagedItems: pagedQueries,
  } = usePagination(filteredQueries, PAGE_SIZE);

  const {
    page: evalPage,
    setPage: setEvalPage,
    pagedItems: pagedEvalRuns,
  } = usePagination(evalRuns, PAGE_SIZE);

  const activeEvalRun = evalRuns.find((r) => r.id === expandedRun);
  const expandedResults = activeEvalRun?.per_example_results
    ? JSON.parse(activeEvalRun.per_example_results)
    : [];
  const {
    page: resultsPage,
    setPage: setResultsPage,
    pagedItems: pagedResults,
  } = usePagination(expandedResults, RESULTS_PAGE_SIZE);

  // Polling Hooks
  usePolling(() => getIngestionStatus(token), {
    enabled: ingesting && !!token,
    intervalMs: POLL_INTERVAL_MS,
    onSuccess: (s) => setIngestionStatus(s),
    onComplete: (s) => {
      setIngesting(false);
      setIngestionStatus(s);
      if (s.status === 'completed') {
        toast.success('Re-indexing complete');
        loadData();
      } else if (s.status === 'error') {
        toast.error(s.message || 'Ingestion failed');
      }
    },
  });

  usePolling(() => getEvalStatus(token), {
    enabled: isEvalRunning && !!token,
    intervalMs: POLL_INTERVAL_MS,
    onSuccess: (s) => setEvalStatus(s),
    onComplete: (s) => {
      setIsEvalRunning(false);
      setEvalStatus(s);
      if (s.status === 'completed') {
        toast.success('Eval cycle complete');
        loadData();
      } else if (s.status === 'error') {
        toast.error(s.message || 'Evaluation failed');
      }
    },
  });

  // Handlers
  const toggleQuerySelection = (id: number) =>
    setSelectedQueries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleAllQueries = () => {
    const ids = pagedQueries.map((q) => q.id);
    const allSelected = ids.every((id) => selectedQueries.includes(id));
    setSelectedQueries((prev) =>
      allSelected
        ? prev.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev, ...ids]))
    );
  };

  const handleSaveUser = async (u: string) => {
    const pen = pending[u];
    try {
      const orig = users.find((x) => x.username === u);
      if (!orig) return;
      if (pen.role !== orig.role) await updateUserRole(u, pen.role, token);
      const penExtra = [...pen.extra].sort();
      const origExtra = [...(orig.extra_roles ?? [])].filter(Boolean).sort();
      if (JSON.stringify(penExtra) !== JSON.stringify(origExtra)) {
         await updateUserExtraRoles(u, pen.extra, token);
      }
      toast.success('User updated');
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteUserClick = async (u: string) => {
    if (u === user?.username) return toast.error('Cannot delete yourself');
    if (!confirm(`Delete user ${u}?`)) return;
    try {
      await deleteUser(u, token);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleIngestClick = async () => {
    setIngesting(true);
    setIngestionStatus({ status: 'processing', progress: 0, message: 'Starting...' });
    try {
      await triggerIngestion(token);
    } catch (e: any) {
      setIngesting(false);
      toast.error(e.message);
    }
  };

  const handleDeleteDocClick = async (f: string) => {
    if (confirm(`Delete ${f}?`)) {
      try {
        await deleteDocument(f, token);
        loadData();
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  };

  const handleUploadClick = async (f: File, c: string) => {
    setIsUploadingDoc(true);
    const id = toast.loading('Uploading...');
    try {
      await uploadDocument(f, c, token);
      loadData();
      toast.success('Done', { id });
    } catch (e: any) {
      toast.error(e.message, { id });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleRunEvalClick = async () => {
    setShowRunEvalModal(false);
    setIsEvalRunning(true);
    setEvalStatus({ status: 'processing', progress: 0, message: 'Starting...' });
    try {
      await runLangsmithEvaluation(token);
    } catch (e: any) {
      setIsEvalRunning(false);
      toast.error(e.message);
    }
  };

  if (isLoading || !user) return null;

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      <div className="min-h-screen">
        <header className="glass border-b border-dark-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          </div>
          <button 
             onClick={() => router.push(PAGE_ROUTES.CHAT)} 
             className="px-3 py-1.5 text-xs rounded-lg bg-dark-700 text-dark-300 hover:bg-dark-600 transition-colors"
          >
            ← Back to Chat
          </button>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { l: 'Docs', v: documents.length },
              { l: 'Chunks', v: documents.reduce((s, d) => s + d.chunk_count, 0) },
              { l: 'Users', v: users.length },
              { l: 'Queries', v: queries.length },
            ].map((s) => (
              <div key={s.l} className="glass rounded-xl p-5 border border-white/5">
                <div className="text-dark-400 text-sm">{s.l}</div>
                <div className="text-3xl font-bold text-white mt-1">{s.v}</div>
              </div>
            ))}
          </div>

          {/* Re-Index Section */}
          <div className="glass rounded-xl p-6 mb-8 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Re-Index Documents</h2>
                <p className="text-dark-400 text-sm mt-1">Re-parse knowledge base into Qdrant</p>
              </div>
              <button 
                onClick={handleIngestClick} 
                disabled={ingesting} 
                className="px-6 py-3 bg-blue-600 rounded-xl text-white font-medium disabled:opacity-50 flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                {ingesting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {ingesting ? 'Indexing...' : '🔄 Re-Index Knowledge Base'}
              </button>
            </div>
            {ingestionStatus && ingesting && (
              <div className="mt-6">
                <ProgressBar 
                  message={ingestionStatus.message} 
                  progress={ingestionStatus.progress} 
                />
              </div>
            )}
          </div>

          {/* Tabs Navigation */}
          <div className="flex gap-2 mb-6">
            {(['documents', 'users', 'eval'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                }`}
              >
                {tab === 'documents' ? '📄 Docs' : tab === 'users' ? '👥 Users' : '📊 Analytics'}
              </button>
            ))}
          </div>

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <FileUploader onUpload={handleUploadClick} isUploading={isUploadingDoc} />
              <div className="glass rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left px-5 py-3 text-dark-400">Document</th>
                      <th className="text-left px-5 py-3 text-dark-400">Collection</th>
                      <th className="text-center px-5 py-3 text-dark-400">Chunks</th>
                      <th className="text-right px-5 py-3 text-dark-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDocs.map((d) => (
                      <tr key={d.filename} className="border-b border-dark-700/50 hover:bg-dark-800/30">
                        <td className="px-5 py-3 text-dark-200">{d.filename}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {d.collection}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-dark-300">{d.chunk_count}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleDeleteDocClick(d.filename)} className="text-red-400 hover:underline">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={documents.length} page={docPage} pageSize={PAGE_SIZE} onChange={setDocPage} />
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="glass rounded-xl overflow-hidden border border-white/5">
              <div className="px-6 py-4 flex justify-between border-b border-dark-700">
                <h2 className="text-lg font-semibold text-white">Users</h2>
                <button onClick={() => setShowAddUser(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  + Add User
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left px-5 py-3 text-dark-400">User</th>
                    <th className="text-left px-5 py-3 text-dark-400">Role</th>
                    <th className="text-left px-5 py-3 text-dark-400">Extra Access</th>
                    <th className="text-right px-5 py-3 text-dark-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((u) => {
                    const p = pending[u.username] || { role: u.role, extra: u.extra_roles ?? [] };
                    const changed = p.role !== u.role || JSON.stringify([...p.extra].sort()) !== JSON.stringify([...(u.extra_roles ?? [])].filter(Boolean).sort());
                    return (
                      <tr key={u.username} className="border-b border-dark-700/50">
                        <td className="px-5 py-4">
                          <div className="text-white">{u.display_name}</div>
                          <div className="text-dark-500 text-xs">@{u.username}</div>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={p.role}
                            onChange={(e) => setPending({ ...pending, [u.username]: { ...p, role: e.target.value } })}
                            className="bg-dark-800 border border-dark-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <AccessSelector
                            primaryRole={p.role}
                            selected={p.extra}
                            onChange={(ex: string[]) => setPending({ ...pending, [u.username]: { ...p, extra: ex } })}
                          />
                        </td>
                        <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                          {changed && (
                            <button onClick={() => handleSaveUser(u.username)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                              Save
                            </button>
                          )}
                          <button onClick={() => handleDeleteUserClick(u.username)} className="text-red-400 hover:text-red-300 transition-colors">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination total={users.length} page={userPage} pageSize={PAGE_SIZE} onChange={setUserPage} />
            </div>
          )}

          {/* Analytics / Eval Tab */}
          {activeTab === 'eval' && (
            <div className="space-y-6">
              <div className="glass rounded-xl p-6 border border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">LangSmith Analytics</h2>
                  <p className="text-dark-400 text-sm">Review logs & run evaluations</p>
                </div>
                <div className="flex gap-2">
                  {selectedQueries.length > 0 && (
                    <button
                      onClick={() => setShowBulkModal(true)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                    >
                      🚀 Bulk Promote ({selectedQueries.length})
                    </button>
                  )}
                  <button
                    onClick={() => setShowRunEvalModal(true)}
                    disabled={isEvalRunning}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2 hover:bg-purple-700 transition-colors"
                  >
                    {isEvalRunning ? 'Evaluating...' : '▶ Run Eval'}
                  </button>
                </div>
              </div>

              {evalStatus && isEvalRunning && (
                <ProgressBar 
                  message={evalStatus.message} 
                  progress={evalStatus.progress} 
                  color="bg-purple-600" 
                  detail={evalStatus.total ? `${evalStatus.current || 0}/${evalStatus.total}` : ''} 
                />
              )}

              <div className="glass rounded-xl overflow-hidden border border-white/5">
                <div className="px-5 py-3 border-b border-dark-700 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white">Query Logs</h3>
                  <button
                    onClick={() => setHideExported(!hideExported)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-dark-700 text-dark-400 hover:bg-dark-800 transition-colors"
                  >
                    {hideExported ? '👁️ New Only' : '👁️ All'}
                  </button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-dark-800/20 text-dark-400 uppercase font-medium border-b border-dark-700">
                      <th className="w-10 px-5 py-3 text-left">
                        <input type="checkbox" onChange={toggleAllQueries} />
                      </th>
                      <th className="text-left px-5 py-3">Date</th>
                      <th className="text-left px-5 py-3">Query & Answer</th>
                      <th className="text-right px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedQueries.map((q) => (
                      <tr
                        key={q.id}
                        className={`border-b border-dark-700/50 hover:bg-dark-800/20 ${
                          selectedQueries.includes(q.id) ? 'bg-blue-600/5' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selectedQueries.includes(q.id)}
                            onChange={() => toggleQuerySelection(q.id)}
                          />
                        </td>
                        <td className="px-5 py-4 text-dark-400">
                          {new Date(q.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-white font-medium mb-1 truncate max-w-lg" title={q.query}>
                            Q: {q.query}
                          </div>
                          <div className="text-dark-500 truncate max-w-lg" title={q.answer}>
                            A: {q.answer}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {q.is_exported ? (
                            <span className="text-green-400">✅ Pushed</span>
                          ) : (
                            <button
                              onClick={() => {
                                setEvalTarget(q);
                                setEvalGroundTruth('');
                                setShowEvalModal(true);
                              }}
                              className="text-blue-400 hover:underline"
                            >
                              + Golden
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={filteredQueries.length} page={queryPage} pageSize={PAGE_SIZE} onChange={setQueryPage} />
              </div>

              {/* Eval History Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white px-2">History</h2>
                {pagedEvalRuns.map((run) => {
                  const pct = run.avg_exact_match ? Math.round(run.avg_exact_match * 100) : 0;
                  const expanded = expandedRun === run.id;
                  return (
                    <div key={run.id} className="glass rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => {
                          setExpandedRun(expanded ? null : run.id);
                          setResultsPage(1);
                        }}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center font-bold text-purple-400 border border-purple-500/20">
                            {pct}%
                          </div>
                          <div className="text-left">
                            <div className="text-white font-bold">{run.experiment_name}</div>
                            <div className="text-dark-500 text-[10px] mt-0.5">
                              {new Date(run.created_at).toLocaleString()} · {run.total_examples} examples
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {run.results_url && (
                            <a
                              href={run.results_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-purple-400 text-[10px] border border-purple-500/20 px-2 py-1 rounded-lg hover:bg-purple-500/10 transition-colors"
                            >
                              ↗ LangSmith
                            </a>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this evaluation run?')) {
                                deleteEvalRun(run.id, token).then(() => loadData());
                              }
                            }}
                            className="text-red-500 text-xs hover:text-red-400"
                          >
                            🗑️
                          </button>
                        </div>
                      </button>

                      {expanded && expandedResults.length > 0 && (
                        <div className="p-4 bg-dark-900/40 border-t border-white/5">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-dark-500 uppercase">
                                <th className="text-left pb-2">Query</th>
                                <th className="text-left pb-2">Truth</th>
                                <th className="text-center pb-2">Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedResults.map((e: any, i: number) => (
                                <tr
                                  key={i}
                                  onClick={() => setSelectedResult(e)}
                                  className="border-t border-white/5 cursor-pointer hover:bg-white/5 transition-all"
                                >
                                  <td className="py-2 pr-4 text-white max-w-[200px] truncate" title={e.query}>
                                    {e.query}
                                  </td>
                                  <td className="py-2 pr-4 text-dark-500 max-w-[200px] truncate" title={e.ground_truth}>
                                    {e.ground_truth}
                                  </td>
                                  <td className="py-2 text-center text-blue-400 font-mono">
                                    {Math.round((e.score || 0) * 100)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <Pagination
                            total={expandedResults.length}
                            page={resultsPage}
                            pageSize={RESULTS_PAGE_SIZE}
                            onChange={setResultsPage}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <Pagination total={evalRuns.length} page={evalPage} pageSize={PAGE_SIZE} onChange={setEvalPage} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals Section */}
      
      {/* Add User Modal */}
      <Modal open={showAddUser} onClose={() => setShowAddUser(false)}>
        <h3 className="text-xl font-bold text-white mb-6">Add New User</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsAddingUser(true);
            try {
              await createUser(newUser, token);
              setShowAddUser(false);
              loadData();
              toast.success('User created');
            } catch (e: any) {
              toast.error(e.message);
            } finally {
              setIsAddingUser(false);
            }
          }}
          className="space-y-4"
        >
          {['username', 'display_name', 'password'].map((k) => (
            <div key={k}>
              <label className="block text-[10px] font-bold text-dark-400 uppercase mb-1">{k.replace('_', ' ')}</label>
              <input
                required
                type={k === 'password' ? 'password' : 'text'}
                value={(newUser as any)[k]}
                onChange={(e) => setNewUser({ ...newUser, [k]: e.target.value })}
                className="w-full bg-dark-800 border border-dark-700 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors"
                autoComplete="off"
              />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-bold text-dark-400 uppercase mb-1">Primary Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="w-full bg-dark-800 border border-dark-700 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className="flex-1 py-2 text-white border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAddingUser}
              className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isAddingUser ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Promote to Dataset (Single) Modal */}
      <Modal open={showEvalModal} onClose={() => setShowEvalModal(false)} maxWidth="max-w-lg">
        <h3 className="text-xl font-bold text-white mb-4">Promote to Golden Dataset</h3>
        {evalTarget && (
          <div className="space-y-4">
            <div className="bg-dark-900 border border-white/5 p-4 rounded-xl">
              <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Query</div>
              <div className="text-white text-sm italic">"{evalTarget.query}"</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-dark-400 uppercase">Golden Truth</label>
                <button
                  onClick={async () => {
                    setIsRecommending(true);
                    try {
                      const r = await recommendGroundTruth(evalTarget.query, evalTarget.answer, token);
                      setEvalGroundTruth(r);
                    } catch (e) {
                       toast.error('Failed to get recommendation');
                    } finally {
                      setIsRecommending(false);
                    }
                  }}
                  className="text-[10px] text-blue-400 flex items-center gap-1 hover:text-blue-300"
                >
                  {isRecommending ? '✨ Thinking...' : '✨ AI Recommend'}
                </button>
              </div>
              <textarea
                value={evalGroundTruth}
                onChange={(e) => setEvalGroundTruth(e.target.value)}
                placeholder="What should the correct answer be?"
                className="w-full h-32 bg-dark-800 border border-white/10 text-white p-3 rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowEvalModal(false)}
                className="flex-1 py-3 text-white border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!evalGroundTruth || isSubmittingToLS}
                onClick={async () => {
                  setIsSubmittingToLS(true);
                  try {
                    await addToLangsmithDataset(evalTarget.id, evalTarget.query, evalTarget.answer, evalGroundTruth, token);
                    toast.success('Pushed to LangSmith');
                    setShowEvalModal(false);
                    setQueries((prev) => prev.map((q) => (q.id === evalTarget.id ? { ...q, is_exported: true } : q)));
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setIsSubmittingToLS(false);
                  }
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSubmittingToLS ? 'Pushing...' : 'Push to Dataset'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Promote Modal */}
      <Modal open={showBulkModal} onClose={() => setShowBulkModal(false)} maxWidth="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Bulk Promote ({selectedQueries.length})</h3>
          <button
            disabled={isBulkRecommending}
            onClick={async () => {
              setIsBulkRecommending(true);
              const toastId = toast.loading('Generating bulk recommendations...');
              try {
                const newTruths = { ...bulkGroundTruths };
                const promises = selectedQueries.map(async (id) => {
                  if (newTruths[id]) return; // Skip if already manually filled/previously generated
                  const q = queries.find((x) => x.id === id);
                  if (!q) return;
                  const r = await recommendGroundTruth(q.query, q.answer, token);
                  newTruths[id] = r;
                });
                await Promise.all(promises);
                setBulkGroundTruths(newTruths);
                toast.success('Generated recommendations!', { id: toastId });
              } catch (e: any) {
                toast.error('Failed to generate some recommendations', { id: toastId });
              } finally {
                setIsBulkRecommending(false);
              }
            }}
            className="px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-500/20 disabled:opacity-50 transition-all"
          >
            {isBulkRecommending ? '✨ Generating...' : '✨ Auto-Fill Empty'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[60vh] custom-scrollbar">
          {selectedQueries.map((id) => {
            const q = queries.find((x) => x.id === id);
            if (!q) return null;
            return (
              <div key={id} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-blue-400 uppercase">Q: {q.query}</div>
                <textarea
                  placeholder="Review or edit ground truth (default: Bot Answer)..."
                  value={bulkGroundTruths[id] || ''}
                  onChange={(e) => setBulkGroundTruths({ ...bulkGroundTruths, [id]: e.target.value })}
                  className="w-full h-20 bg-dark-900 border border-white/5 text-white p-2 rounded-lg text-xs focus:outline-none focus:border-blue-500/30"
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-6 border-t border-white/5 mt-6">
          <button
            onClick={() => setShowBulkModal(false)}
            className="flex-1 py-3 text-white border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isBulkSubmitting}
            onClick={async () => {
              setIsBulkSubmitting(true);
              try {
                const items = selectedQueries.map((id) => {
                  const q = queries.find((x) => x.id === id)!;
                  return {
                    id,
                    query: q.query,
                    answer: q.answer,
                    ground_truth: bulkGroundTruths[id] || q.answer,
                  };
                });
                await bulkAddToLangsmithDataset(items, token);
                toast.success('Bulk promote successful');
                setShowBulkModal(false);
                setSelectedQueries([]);
                loadData();
              } catch (e: any) {
                toast.error(e.message);
              } finally {
                setIsBulkSubmitting(false);
              }
            }}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isBulkSubmitting ? 'Promoting...' : '🚀 Launch Bulk Promotion'}
          </button>
        </div>
      </Modal>

      {/* Run Validation Confirmation Modal */}
      <Modal open={showRunEvalModal} onClose={() => setShowRunEvalModal(false)} maxWidth="max-w-sm">
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">Run Production Eval?</h3>
          <p className="text-dark-400 text-sm mb-6">
            This will execute the evaluation suite against the golden dataset. This may take a few minutes.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRunEvalModal(false)}
              className="flex-1 py-2 text-white border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRunEvalClick}
              className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors"
            >
              Launch Suite
            </button>
          </div>
        </div>
      </Modal>

      {/* Result Analysis Detail View Modal */}
      <Modal open={!!selectedResult} onClose={() => setSelectedResult(null)} maxWidth="max-w-5xl">
        {selectedResult && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Result Analysis</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      (selectedResult.score || 0) >= 0.8 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {Math.round((selectedResult.score || 0) * 100)}% Match
                  </span>
                  <span className="text-dark-500 text-[10px] uppercase font-mono">Similarity Index</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh] space-y-8 pr-2 custom-scrollbar">
              <section>
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 font-mono px-1">
                  User Query
                </div>
                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-lg text-white font-medium italic leading-relaxed">
                  "{selectedResult.query}"
                </div>
              </section>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 font-mono px-1">
                    Golden Truth
                  </div>
                  <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-sm text-emerald-100/90 leading-relaxed min-h-[200px]">
                    {selectedResult.ground_truth}
                  </div>
                </section>
                <section>
                  <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3 font-mono px-1">
                    Bot Answer (RAG)
                  </div>
                  <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/10 text-sm text-purple-100/90 leading-relaxed min-h-[200px]">
                    {selectedResult.actual_answer || 'No answer recorded'}
                  </div>
                </section>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5 mt-6 flex justify-end">
              <button
                onClick={() => setSelectedResult(null)}
                className="px-8 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10"
              >
                Close Analysis
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
