import { z } from "zod";

export const policyDecisionSchema = z.enum([
  "allow",
  "deny",
  "sandbox",
  "approval_required",
]);

export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

export const workflowStatusSchema = z.enum([
  "received",
  "allowed",
  "denied",
  "pending_approval",
  "approved",
  "rejected",
  "sandbox_queued",
  "executed",
  "failed",
]);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const agentActionSchema = z.object({
  type: z.string().min(1),
  target: z.string().min(1),
  parameters: z.record(z.unknown()).optional(),
});

export const policyDecisionBlockSchema = z.object({
  decision: policyDecisionSchema,
  policyId: z.string().min(1),
  reason: z.string().optional(),
  evaluatedAt: z.string().datetime({ offset: true }),
});

export const agentActionRequestSchema = z.object({
  requestId: z.string().min(1),
  agentId: z.string().min(1),
  action: agentActionSchema,
  policyDecision: policyDecisionBlockSchema,
  metadata: z.record(z.unknown()).optional(),
  submittedAt: z.string().datetime({ offset: true }).optional(),
});

export type AgentActionRequest = z.infer<typeof agentActionRequestSchema>;

export interface WorkflowRecord {
  requestId: string;
  agentId: string;
  actionType: string;
  actionTarget: string;
  actionParameters: string | null;
  policyDecision: PolicyDecision;
  policyId: string;
  policyReason: string | null;
  status: WorkflowStatus;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: number;
  requestId: string;
  eventType: string;
  actor: string | null;
  details: string | null;
  createdAt: string;
}

export interface RouteResult {
  requestId: string;
  status: WorkflowStatus;
  policyDecision: PolicyDecision;
  routedAt: string;
  message: string;
}

export interface ApprovalResult {
  requestId: string;
  previousStatus: WorkflowStatus;
  status: WorkflowStatus;
  actor: string;
  reason?: string;
  updatedAt: string;
}
