# Roadmap

The current release is a deterministic routing + audit core. Planned work, roughly
in priority order:

## Near term
- **Execution callbacks.** Accept `executed` / `failed` status reports from an
  external execution engine and validate them through the status machine.
- **Approval expiry.** Auto-expire `pending_approval` records after a configurable
  TTL and emit an `expired` audit event.
- **Request signing.** Verify a signature on the inbound `policyDecision` so the
  router can trust that the decision came from the Agent Policy Engine.

## Mid term
- **HTTP service mode.** Expose the same core over a small REST/JSON API alongside
  the CLI, for use as a sidecar.
- **Notifier hooks.** Push `pending_approval` events to Slack / email / webhook so
  humans are paged instead of polling `pending`.
- **Pluggable storage.** Abstract `SqliteStore` behind an interface to allow
  Postgres for multi-instance deployments.

## Long term
- **Policy feedback loop.** Feed approval/rejection outcomes back to the Agent
  Policy Engine as training/evaluation signal.
- **Witness integration.** Stream the audit log to Witness for tamper-evident,
  externally verifiable records.
- **Multi-approver workflows.** Quorum / N-of-M approvals and role-based routing.

## Explicit non-goals
- Executing tool calls or shell commands.
- Making policy decisions (that is the Agent Policy Engine's job).
- Acting as a general-purpose workflow/orchestration engine.
