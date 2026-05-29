import { AuditLog } from "./audit/audit-log.js";
import { ApprovalService } from "./approvals/approval-service.js";
import { WorkflowRouter } from "./router/workflow-router.js";
import { SqliteStore } from "./storage/sqlite-store.js";

export const DEFAULT_DATABASE_PATH = "./data/hitl-router.db";

export interface RouterContext {
  store: SqliteStore;
  auditLog: AuditLog;
  router: WorkflowRouter;
  approvals: ApprovalService;
}

export function createRouterContext(
  databasePath: string = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
): RouterContext {
  const store = new SqliteStore(databasePath);
  const auditLog = new AuditLog(store);
  const router = new WorkflowRouter(store, auditLog);
  const approvals = new ApprovalService(store, auditLog);
  return { store, auditLog, router, approvals };
}

export { AuditLog } from "./audit/audit-log.js";
export { ApprovalService } from "./approvals/approval-service.js";
export {
  NotPendingApprovalError,
  WorkflowNotFoundError,
} from "./approvals/approval-types.js";
export type { ApproveInput, RejectInput } from "./approvals/approval-types.js";
export {
  DECISION_STATUS_MAP,
  routeDecision,
} from "./router/decision-router.js";
export {
  ALLOWED_TRANSITIONS,
  InvalidTransitionError,
  assertTransition,
  canTransition,
} from "./router/status-machine.js";
export {
  DuplicateRequestError,
  WorkflowRouter,
} from "./router/workflow-router.js";
export { SqliteStore } from "./storage/sqlite-store.js";
export * from "./types/workflow.js";
