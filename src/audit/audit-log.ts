import type { SqliteStore } from "../storage/sqlite-store.js";
import type { AuditEvent } from "../types/workflow.js";

export interface RecordAuditInput {
  requestId: string;
  eventType: string;
  actor?: string | null;
  details?: string | null;
  at?: string;
}

export class AuditLog {
  constructor(private readonly store: SqliteStore) {}

  record(input: RecordAuditInput): number {
    return this.store.insertAudit({
      requestId: input.requestId,
      eventType: input.eventType,
      actor: input.actor ?? null,
      details: input.details ?? null,
      createdAt: input.at ?? new Date().toISOString(),
    });
  }

  list(requestId: string): AuditEvent[] {
    return this.store.listAudit(requestId);
  }
}
