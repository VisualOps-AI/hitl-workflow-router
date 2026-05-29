import type { WorkflowStatus } from "../types/workflow.js";

export interface ApproveInput {
  requestId: string;
  actor: string;
}

export interface RejectInput {
  requestId: string;
  actor: string;
  reason: string;
}

export class WorkflowNotFoundError extends Error {
  constructor(readonly requestId: string) {
    super(`No workflow record found for requestId "${requestId}"`);
    this.name = "WorkflowNotFoundError";
  }
}

export class NotPendingApprovalError extends Error {
  constructor(
    readonly requestId: string,
    readonly currentStatus: WorkflowStatus,
  ) {
    super(
      `Request "${requestId}" is "${currentStatus}", not "pending_approval"; cannot act on it.`,
    );
    this.name = "NotPendingApprovalError";
  }
}
