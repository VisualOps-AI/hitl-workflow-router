#!/usr/bin/env node
import { readFileSync } from "node:fs";
import chalk from "chalk";
import { Command } from "commander";
import { ZodError } from "zod";
import { createRouterContext, type RouterContext } from "./index.js";
import type {
  ApprovalResult,
  AuditEvent,
  RouteResult,
  WorkflowRecord,
} from "./types/workflow.js";

const STATUS_COLORS: Record<string, (text: string) => string> = {
  received: chalk.gray,
  allowed: chalk.green,
  denied: chalk.red,
  pending_approval: chalk.yellow,
  approved: chalk.green,
  rejected: chalk.red,
  sandbox_queued: chalk.cyan,
  executed: chalk.green,
  failed: chalk.red,
};

const colorStatus = (status: string): string =>
  (STATUS_COLORS[status] ?? chalk.white)(status);

const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

function renderRecord(record: WorkflowRecord): string {
  return [
    `${chalk.bold(record.requestId)}  ${colorStatus(record.status)}`,
    `  agent:    ${record.agentId}`,
    `  action:   ${record.actionType} -> ${record.actionTarget}`,
    `  decision: ${record.policyDecision} (${record.policyId})`,
    record.policyReason ? `  reason:   ${record.policyReason}` : null,
    `  updated:  ${record.updatedAt}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderRecords(records: WorkflowRecord[]): string {
  if (records.length === 0) {
    return chalk.gray("No workflow records.");
  }
  return records.map(renderRecord).join("\n\n");
}

function renderAudit(events: AuditEvent[]): string {
  if (events.length === 0) {
    return chalk.gray("No audit events.");
  }
  return events
    .map(
      (event) =>
        `${chalk.gray(event.createdAt)}  ${chalk.bold(event.eventType)}` +
        `${event.actor ? ` by ${event.actor}` : ""}` +
        `${event.details ? `\n  ${event.details}` : ""}`,
    )
    .join("\n");
}

function renderRouteResult(result: RouteResult): string {
  return `${chalk.bold(result.requestId)}  ${colorStatus(result.status)}\n  ${result.message}`;
}

function renderApprovalResult(result: ApprovalResult): string {
  const reason = result.reason ? `\n  reason: ${result.reason}` : "";
  return (
    `${chalk.bold(result.requestId)}  ${colorStatus(result.previousStatus)} -> ` +
    `${colorStatus(result.status)}\n  by ${result.actor}${reason}`
  );
}

function withContext<T>(fn: (ctx: RouterContext) => T): T {
  const ctx = createRouterContext();
  try {
    return fn(ctx);
  } finally {
    ctx.store.close();
  }
}

function fail(message: string): never {
  console.error(chalk.red(`Error: ${message}`));
  process.exit(1);
}

function run<T>(action: () => T, render: (value: T) => void): void {
  try {
    render(action());
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(chalk.red("Error: request failed schema validation"));
      printJson(error.issues);
      process.exit(1);
    }
    fail(error instanceof Error ? error.message : String(error));
  }
}

const program = new Command();

program
  .name("hitl-router")
  .description(
    "Human-in-the-Loop Workflow Router — routes policy-decided AI agent actions and records an audit trail.",
  )
  .version("1.0.0");

program
  .command("submit")
  .description("Route a policy-decided agent action request from a JSON file")
  .requiredOption("--request <path>", "path to the request JSON file")
  .option("--pretty", "human-readable output", false)
  .action((options: { request: string; pretty: boolean }) => {
    run(
      () => {
        const input = JSON.parse(readFileSync(options.request, "utf-8"));
        return withContext((ctx) => ctx.router.submit(input));
      },
      (result) =>
        options.pretty
          ? console.log(renderRouteResult(result))
          : printJson(result),
    );
  });

program
  .command("list")
  .description("List all workflow records")
  .option("--pretty", "human-readable output", false)
  .action((options: { pretty: boolean }) => {
    run(
      () => withContext((ctx) => ctx.store.listWorkflows()),
      (records) =>
        options.pretty ? console.log(renderRecords(records)) : printJson(records),
    );
  });

program
  .command("pending")
  .description("List workflow records awaiting human approval")
  .option("--pretty", "human-readable output", false)
  .action((options: { pretty: boolean }) => {
    run(
      () =>
        withContext((ctx) => ctx.store.listWorkflowsByStatus("pending_approval")),
      (records) =>
        options.pretty ? console.log(renderRecords(records)) : printJson(records),
    );
  });

program
  .command("approve")
  .description("Approve a pending request")
  .argument("<requestId>", "the request to approve")
  .requiredOption("--by <actor>", "who is approving")
  .option("--pretty", "human-readable output", false)
  .action((requestId: string, options: { by: string; pretty: boolean }) => {
    run(
      () =>
        withContext((ctx) =>
          ctx.approvals.approve({ requestId, actor: options.by }),
        ),
      (result) =>
        options.pretty
          ? console.log(renderApprovalResult(result))
          : printJson(result),
    );
  });

program
  .command("reject")
  .description("Reject a pending request")
  .argument("<requestId>", "the request to reject")
  .requiredOption("--by <actor>", "who is rejecting")
  .requiredOption("--reason <reason>", "why the request is rejected")
  .option("--pretty", "human-readable output", false)
  .action(
    (
      requestId: string,
      options: { by: string; reason: string; pretty: boolean },
    ) => {
      run(
        () =>
          withContext((ctx) =>
            ctx.approvals.reject({
              requestId,
              actor: options.by,
              reason: options.reason,
            }),
          ),
        (result) =>
          options.pretty
            ? console.log(renderApprovalResult(result))
            : printJson(result),
      );
    },
  );

program
  .command("audit")
  .description("Show the audit trail for a request")
  .argument("<requestId>", "the request to inspect")
  .option("--pretty", "human-readable output", false)
  .action((requestId: string, options: { pretty: boolean }) => {
    run(
      () => withContext((ctx) => ctx.auditLog.list(requestId)),
      (events) =>
        options.pretty ? console.log(renderAudit(events)) : printJson(events),
    );
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
