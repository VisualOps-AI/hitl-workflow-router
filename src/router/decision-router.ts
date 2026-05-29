import type { PolicyDecision, WorkflowStatus } from "../types/workflow.js";

export const DECISION_STATUS_MAP: Record<PolicyDecision, WorkflowStatus> = {
  allow: "allowed",
  deny: "denied",
  sandbox: "sandbox_queued",
  approval_required: "pending_approval",
};

export function routeDecision(decision: PolicyDecision): WorkflowStatus {
  return DECISION_STATUS_MAP[decision];
}
