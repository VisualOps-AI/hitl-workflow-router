import type { AuditLog } from "../audit/audit-log.js";
import type { SqliteStore } from "../storage/sqlite-store.js";
import {
  agentActionRequestSchema,
  type AgentActionRequest,
  type RouteResult,
  type WorkflowRecord,
} from "../types/workflow.js";
import { routeDecision } from "./decision-router.js";

export class DuplicateRequestError extends Error {
  constructor(readonly requestId: string) {
    super(`Workflow record already exists for requestId "${requestId}"`);
    this.name = "DuplicateRequestError";
  }
}

const serialize = (value: unknown): string | null =>
  value === undefined ? null : JSON.stringify(value);

export class WorkflowRouter {
  constructor(
    private readonly store: SqliteStore,
    private readonly auditLog: AuditLog,
  ) {}

  parse(input: unknown): AgentActionRequest {
    return agentActionRequestSchema.parse(input);
  }

  route(request: AgentActionRequest): RouteResult {
    if (this.store.getWorkflow(request.requestId)) {
      throw new DuplicateRequestError(request.requestId);
    }

    const now = new Date().toISOString();
    const status = routeDecision(request.policyDecision.decision);

    const record: WorkflowRecord = {
      requestId: request.requestId,
      agentId: request.agentId,
      actionType: request.action.type,
      actionTarget: request.action.target,
      actionParameters: serialize(request.action.parameters),
      policyDecision: request.policyDecision.decision,
      policyId: request.policyDecision.policyId,
      policyReason: request.policyDecision.reason ?? null,
      status,
      metadata: serialize(request.metadata),
      createdAt: now,
      updatedAt: now,
    };

    this.store.insertWorkflow(record);
    this.auditLog.record({
      requestId: record.requestId,
      eventType: "routed",
      actor: request.agentId,
      details: `decision=${record.policyDecision} status=${status} policy=${record.policyId}`,
      at: now,
    });

    return {
      requestId: record.requestId,
      status,
      policyDecision: record.policyDecision,
      routedAt: now,
      message: `Request "${record.requestId}" routed to "${status}".`,
    };
  }

  submit(input: unknown): RouteResult {
    return this.route(this.parse(input));
  }
}
