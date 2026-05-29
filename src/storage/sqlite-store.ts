import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  AUDIT_TABLE,
  SCHEMA_STATEMENTS,
  WORKFLOW_TABLE,
} from "./schema.js";
import type {
  AuditEvent,
  WorkflowRecord,
  WorkflowStatus,
} from "../types/workflow.js";

interface WorkflowRow {
  request_id: string;
  agent_id: string;
  action_type: string;
  action_target: string;
  action_parameters: string | null;
  policy_decision: string;
  policy_id: string;
  policy_reason: string | null;
  status: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: number;
  request_id: string;
  event_type: string;
  actor: string | null;
  details: string | null;
  created_at: string;
}

export interface NewAuditEvent {
  requestId: string;
  eventType: string;
  actor: string | null;
  details: string | null;
  createdAt: string;
}

const toWorkflowRecord = (row: WorkflowRow): WorkflowRecord => ({
  requestId: row.request_id,
  agentId: row.agent_id,
  actionType: row.action_type,
  actionTarget: row.action_target,
  actionParameters: row.action_parameters,
  policyDecision: row.policy_decision as WorkflowRecord["policyDecision"],
  policyId: row.policy_id,
  policyReason: row.policy_reason,
  status: row.status as WorkflowStatus,
  metadata: row.metadata,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toAuditEvent = (row: AuditRow): AuditEvent => ({
  id: row.id,
  requestId: row.request_id,
  eventType: row.event_type,
  actor: row.actor,
  details: row.details,
  createdAt: row.created_at,
});

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    for (const statement of SCHEMA_STATEMENTS) {
      this.db.exec(statement);
    }
  }

  insertWorkflow(record: WorkflowRecord): void {
    this.db
      .prepare(
        `INSERT INTO ${WORKFLOW_TABLE} (
          request_id, agent_id, action_type, action_target, action_parameters,
          policy_decision, policy_id, policy_reason, status, metadata,
          created_at, updated_at
        ) VALUES (
          @requestId, @agentId, @actionType, @actionTarget, @actionParameters,
          @policyDecision, @policyId, @policyReason, @status, @metadata,
          @createdAt, @updatedAt
        )`,
      )
      .run(record);
  }

  getWorkflow(requestId: string): WorkflowRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${WORKFLOW_TABLE} WHERE request_id = ?`)
      .get(requestId) as WorkflowRow | undefined;
    return row ? toWorkflowRecord(row) : undefined;
  }

  listWorkflows(): WorkflowRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM ${WORKFLOW_TABLE} ORDER BY created_at ASC, request_id ASC`)
      .all() as WorkflowRow[];
    return rows.map(toWorkflowRecord);
  }

  listWorkflowsByStatus(status: WorkflowStatus): WorkflowRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM ${WORKFLOW_TABLE} WHERE status = ? ORDER BY created_at ASC, request_id ASC`,
      )
      .all(status) as WorkflowRow[];
    return rows.map(toWorkflowRecord);
  }

  updateWorkflowStatus(
    requestId: string,
    status: WorkflowStatus,
    updatedAt: string,
  ): void {
    this.db
      .prepare(
        `UPDATE ${WORKFLOW_TABLE} SET status = ?, updated_at = ? WHERE request_id = ?`,
      )
      .run(status, updatedAt, requestId);
  }

  insertAudit(event: NewAuditEvent): number {
    const result = this.db
      .prepare(
        `INSERT INTO ${AUDIT_TABLE} (request_id, event_type, actor, details, created_at)
         VALUES (@requestId, @eventType, @actor, @details, @createdAt)`,
      )
      .run(event);
    return Number(result.lastInsertRowid);
  }

  listAudit(requestId: string): AuditEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM ${AUDIT_TABLE} WHERE request_id = ? ORDER BY id ASC`,
      )
      .all(requestId) as AuditRow[];
    return rows.map(toAuditEvent);
  }

  close(): void {
    this.db.close();
  }
}
