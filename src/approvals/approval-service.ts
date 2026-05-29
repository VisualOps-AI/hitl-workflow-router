import type { AuditLog } from "../audit/audit-log.js";
import { assertTransition } from "../router/status-machine.js";
import type { SqliteStore } from "../storage/sqlite-store.js";
import type { ApprovalResult, WorkflowStatus } from "../types/workflow.js";
import {
  NotPendingApprovalError,
  WorkflowNotFoundError,
  type ApproveInput,
  type RejectInput,
} from "./approval-types.js";

export class ApprovalService {
  constructor(
    private readonly store: SqliteStore,
    private readonly auditLog: AuditLog,
  ) {}

  approve(input: ApproveInput): ApprovalResult {
    return this.resolve({
      requestId: input.requestId,
      actor: input.actor,
      target: "approved",
      eventType: "approved",
      details: `approved by ${input.actor}`,
    });
  }

  reject(input: RejectInput): ApprovalResult {
    return this.resolve({
      requestId: input.requestId,
      actor: input.actor,
      target: "rejected",
      eventType: "rejected",
      details: `rejected by ${input.actor}: ${input.reason}`,
      reason: input.reason,
    });
  }

  private resolve(params: {
    requestId: string;
    actor: string;
    target: WorkflowStatus;
    eventType: string;
    details: string;
    reason?: string;
  }): ApprovalResult {
    const record = this.store.getWorkflow(params.requestId);
    if (!record) {
      throw new WorkflowNotFoundError(params.requestId);
    }
    if (record.status !== "pending_approval") {
      throw new NotPendingApprovalError(params.requestId, record.status);
    }

    assertTransition(record.status, params.target);

    const updatedAt = new Date().toISOString();
    this.store.updateWorkflowStatus(params.requestId, params.target, updatedAt);
    this.auditLog.record({
      requestId: params.requestId,
      eventType: params.eventType,
      actor: params.actor,
      details: params.details,
      at: updatedAt,
    });

    return {
      requestId: params.requestId,
      previousStatus: record.status,
      status: params.target,
      actor: params.actor,
      reason: params.reason,
      updatedAt,
    };
  }
}
