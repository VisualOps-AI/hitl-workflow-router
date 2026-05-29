export const WORKFLOW_TABLE = "workflow_records";
export const AUDIT_TABLE = "audit_events";

export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ${WORKFLOW_TABLE} (
    request_id          TEXT PRIMARY KEY,
    agent_id            TEXT NOT NULL,
    action_type         TEXT NOT NULL,
    action_target       TEXT NOT NULL,
    action_parameters   TEXT,
    policy_decision     TEXT NOT NULL,
    policy_id           TEXT NOT NULL,
    policy_reason       TEXT,
    status              TEXT NOT NULL,
    metadata            TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id  TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    actor       TEXT,
    details     TEXT,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES ${WORKFLOW_TABLE}(request_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_status ON ${WORKFLOW_TABLE}(status)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_request ON ${AUDIT_TABLE}(request_id)`,
] as const;
