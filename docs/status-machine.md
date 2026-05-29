# Status Machine

Every workflow record holds exactly one status. The router assigns an **initial
status** from the policy decision; subsequent transitions are constrained by the
status machine in `src/router/status-machine.ts`.

## Decision → initial status

| `policyDecision.decision` | Initial `status` |
| --- | --- |
| `allow` | `allowed` |
| `deny` | `denied` |
| `sandbox` | `sandbox_queued` |
| `approval_required` | `pending_approval` |

`received` is reserved as a pre-routing state for future intake flows; the current
router assigns a terminal-or-pending status directly.

## Transition graph

```
received ─┬─► allowed ────────► executed
          ├─► denied            └────────► failed
          ├─► sandbox_queued ─► executed / failed
          └─► pending_approval ─┬─► approved ─► executed / failed
                                └─► rejected
```

| From | Allowed transitions |
| --- | --- |
| `received` | `allowed`, `denied`, `sandbox_queued`, `pending_approval` |
| `allowed` | `executed`, `failed` |
| `pending_approval` | `approved`, `rejected` |
| `approved` | `executed`, `failed` |
| `sandbox_queued` | `executed`, `failed` |
| `denied` | — (terminal) |
| `rejected` | — (terminal) |
| `executed` | — (terminal) |
| `failed` | — (terminal) |

## Enforcement

- `canTransition(from, to)` returns a boolean.
- `assertTransition(from, to)` throws `InvalidTransitionError` on an illegal move.
- `ApprovalService` only acts on `pending_approval` records; approving or rejecting
  anything else throws `NotPendingApprovalError`.

The `executed` / `failed` states are part of the contract but are **not** driven by
this repo — an external execution engine would report them back. See
[roadmap.md](./roadmap.md).
