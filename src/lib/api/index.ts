/**
 * API barrel export — re-exports everything for backward compatibility.
 *
 * Existing imports like `import { login, streamChat } from '@/lib/api'`
 * continue to work without any changes to consuming files.
 */
export { login } from './auth';
export { sendMessage, streamChat } from './chat';
export {
  triggerIngestion,
  getIngestionStatus,
  listDocuments,
  deleteDocument,
  uploadDocument,
} from './documents';
export {
  listUsers,
  createUser,
  updateUserRole,
  updateUserExtraRoles,
  deleteUser,
} from './users';
export {
  addToLangsmithDataset,
  bulkAddToLangsmithDataset,
  runLangsmithEvaluation,
  getEvalStatus,
  listEvalRuns,
  deleteEvalRun,
  deleteQueryLog,
  listRecentQueries,
  recommendGroundTruth,
} from './evaluation';

// Re-export types for backward compat (consumers import from '@/lib/api')
export type {
  User,
  TokenResponse,
  ChatResponse,
  SourceCitation,
  GuardrailWarning,
  DocumentInfo,
  QueryLogInfo,
  EvalRunInfo,
  StreamChunk,
  IngestionStatus,
  EvalStatus,
} from '@/lib/types';
