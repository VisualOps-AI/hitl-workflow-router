# Architecture

The Human-in-the-Loop Workflow Router is a small, deterministic routing and audit
layer. It sits **after** a policy engine has made a decision and **before** any
real execution happens. It never executes tool calls itself.

## Layers

```
                ┌──────────────────────────────────────────────┐
                │                    CLI (cli.ts)                │
                │  submit · list · pending · approve · reject ·  │
                │                     audit                      │
                └───────────────┬────────────────────────────────┘
                                │  validated input
                ┌───────────────▼────────────────┐
                │        index.ts (factory)        │
                │   createRouterContext(dbPath)    │
                └───┬───────────┬───────────┬──────┘
                    │           │           │
        ┌───────────▼──┐  ┌─────▼──────┐  ┌─▼──────────────┐
        │WorkflowRouter│  │ ApprovalSvc │  │   AuditLog     │
        │ route/submit │  │approve/reject│ │ record/list    │
        └───────┬──────┘  └─────┬──────┘  └──────┬─────────┘
                │ decision-router │ status-machine │
                └─────────┬───────┴────────┬───────┘
                          │                │
                    ┌─────▼────────────────▼─────┐
                    │        SqliteStore          │
                    │ workflow_records · audit_events │
                    └─────────────────────────────┘
```

## Modules

| Module | Responsibility |
| --- | --- |
| `types/workflow.ts` | Zod schemas + TypeScript types. Single source of truth for the request contract and stored shapes. |
| `router/decision-router.ts` | Pure mapping: `PolicyDecision → initial WorkflowStatus`. |
| `router/status-machine.ts` | The allowed status-transition graph and `assertTransition`. |
| `router/workflow-router.ts` | Validates a request, derives its initial status, persists the record, writes the `routed` audit event. |
| `approvals/approval-service.ts` | Approves/rejects `pending_approval` records, enforcing transitions and writing audit events. |
| `audit/audit-log.ts` | Thin domain wrapper over the audit table. |
| `storage/schema.ts` | SQLite DDL. |
| `storage/sqlite-store.ts` | All raw SQL. The only module that talks to `better-sqlite3`. |
| `cli.ts` | Commander wiring and output rendering (JSON by default, `--pretty` for humans). |

## Design choices

- **Deterministic, synchronous core.** `better-sqlite3` is synchronous, so routing
  is a single in-process transaction with no async ordering surprises.
- **Dependency injection.** `WorkflowRouter`, `ApprovalService`, and `AuditLog` all
  take a `SqliteStore`. Tests pass a `:memory:` store; the CLI passes a file path.
- **Validation at the boundary.** Untrusted input is parsed by Zod in
  `WorkflowRouter.submit` / `parse` before anything touches the database.
- **Append-only audit.** Every route, approval, and rejection writes one immutable
  `audit_events` row. Records are never deleted.

## Data model

`workflow_records` — one row per request, keyed by `request_id`. Stores the
flattened action, the policy decision that produced it, the current status, and
`created_at` / `updated_at` timestamps.

`audit_events` — append-only log keyed to `request_id` with `event_type`
(`routed`, `approved`, `rejected`), the `actor`, and free-text `details`.
