import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApprovalService } from "../src/approvals/approval-service.js";
import { NotPendingApprovalError } from "../src/approvals/approval-types.js";
import { AuditLog } from "../src/audit/audit-log.js";
import { DuplicateRequestError, WorkflowRouter } from "../src/router/workflow-router.js";
import { SqliteStore } from "../src/storage/sqlite-store.js";
import type { AgentActionRequest, PolicyDecision } from "../src/types/workflow.js";

function buildRequest(
  decision: PolicyDecision,
  overrides: Partial<AgentActionRequest> = {},
): AgentActionRequest {
  return {
    requestId: `req-${decision}`,
    agentId: "agent-test",
    action: {
      type: "shell_command",
      target: "host-1",
      parameters: { command: "echo hi" },
    },
    policyDecision: {
      decision,
      policyId: "pol-test",
      reason: "test",
      evaluatedAt: "2026-05-29T17:00:00.000Z",
    },
    ...overrides,
  };
}

let store: SqliteStore;
let auditLog: AuditLog;
let router: WorkflowRouter;
let approvals: ApprovalService;

beforeEach(() => {
  store = new SqliteStore(":memory:");
  auditLog = new AuditLog(store);
  router = new WorkflowRouter(store, auditLog);
  approvals = new ApprovalService(store, auditLog);
});

afterEach(() => {
  store.close();
});

describe("decision routing", () => {
  it("routes an allow decision to allowed", () => {
    const result = router.route(buildRequest("allow"));
    expect(result.status).toBe("allowed");
    expect(store.getWorkflow(result.requestId)?.status).toBe("allowed");
  });

  it("routes a deny decision to denied", () => {
    const result = router.route(buildRequest("deny"));
    expect(result.status).toBe("denied");
    expect(store.getWorkflow(result.requestId)?.status).toBe("denied");
  });

  it("routes a sandbox decision to sandbox_queued", () => {
    const result = router.route(buildRequest("sandbox"));
    expect(result.status).toBe("sandbox_queued");
    expect(store.getWorkflow(result.requestId)?.status).toBe("sandbox_queued");
  });

  it("routes an approval_required decision to pending_approval", () => {
    const result = router.route(buildRequest("approval_required"));
    expect(result.status).toBe("pending_approval");
    expect(store.getWorkflow(result.requestId)?.status).toBe("pending_approval");
  });

  it("rejects duplicate request ids", () => {
    router.route(buildRequest("allow"));
    expect(() => router.route(buildRequest("allow"))).toThrow(DuplicateRequestError);
  });

  it("validates the request schema in submit", () => {
    expect(() => router.submit({ requestId: "bad" })).toThrow();
  });
});

describe("audit logging", () => {
  it("creates an audit event for every route", () => {
    const decisions: PolicyDecision[] = ["allow", "deny", "sandbox", "approval_required"];
    for (const decision of decisions) {
      const result = router.route(buildRequest(decision));
      const events = auditLog.list(result.requestId);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe("routed");
    }
  });
});

describe("approvals", () => {
  it("approving a pending request changes status to approved", () => {
    const { requestId } = router.route(buildRequest("approval_required"));
    const result = approvals.approve({ requestId, actor: "anthony" });

    expect(result.previousStatus).toBe("pending_approval");
    expect(result.status).toBe("approved");
    expect(store.getWorkflow(requestId)?.status).toBe("approved");

    const events = auditLog.list(requestId);
    expect(events.map((e) => e.eventType)).toEqual(["routed", "approved"]);
  });

  it("rejecting a pending request changes status to rejected", () => {
    const { requestId } = router.route(buildRequest("approval_required"));
    const result = approvals.reject({
      requestId,
      actor: "anthony",
      reason: "Not needed.",
    });

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("Not needed.");
    expect(store.getWorkflow(requestId)?.status).toBe("rejected");

    const events = auditLog.list(requestId);
    expect(events.map((e) => e.eventType)).toEqual(["routed", "rejected"]);
  });

  it("refuses to approve a non-pending request", () => {
    const { requestId } = router.route(buildRequest("allow"));
    expect(() => approvals.approve({ requestId, actor: "anthony" })).toThrow(
      NotPendingApprovalError,
    );
  });
});
