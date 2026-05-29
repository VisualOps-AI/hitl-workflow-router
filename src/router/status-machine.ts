import type { WorkflowStatus } from "../types/workflow.js";

export const ALLOWED_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  received: ["allowed", "denied", "sandbox_queued", "pending_approval"],
  allowed: ["executed", "failed"],
  denied: [],
  pending_approval: ["approved", "rejected"],
  approved: ["executed", "failed"],
  rejected: [],
  sandbox_queued: ["executed", "failed"],
  executed: [],
  failed: [],
};

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: WorkflowStatus,
    readonly to: WorkflowStatus,
  ) {
    super(`Invalid status transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: WorkflowStatus, to: WorkflowStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}
