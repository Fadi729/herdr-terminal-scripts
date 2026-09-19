import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { LaunchPlan } from "./launch.ts";

export type PluginContext = {
  workspaceCwd: string | null;
  workspaceId: string | null;
  focusedPaneId: string | null;
};

export function herdrBin(): string {
  return process.env.HERDR_BIN_PATH ?? "herdr";
}

export function catalogPath(): string {
  return join(process.env.HERDR_PLUGIN_CONFIG_DIR ?? ".", "scripts.json");
}

export function readPluginContext(): PluginContext {
  const raw = process.env.HERDR_PLUGIN_CONTEXT_JSON;
  if (!raw) {
    return {
      workspaceCwd: null,
      workspaceId: process.env.HERDR_WORKSPACE_ID ?? null,
      focusedPaneId: null,
    };
  }
  try {
    const parsed = JSON.parse(raw) as {
      workspace_cwd?: string | null;
      workspace_id?: string | null;
      focused_pane_id?: string | null;
    };
    return {
      workspaceCwd: parsed.workspace_cwd ?? null,
      workspaceId: parsed.workspace_id ?? process.env.HERDR_WORKSPACE_ID ?? null,
      focusedPaneId: parsed.focused_pane_id ?? null,
    };
  } catch {
    return {
      workspaceCwd: null,
      workspaceId: process.env.HERDR_WORKSPACE_ID ?? null,
      focusedPaneId: null,
    };
  }
}

export function notify(title: string, body: string): void {
  runHerdr(["notification", "show", title, "--body", body, "--sound", "none"]);
}

export function openPickerPane(): void {
  runHerdr([
    "plugin",
    "pane",
    "open",
    "--plugin",
    "terminal-scripts",
    "--entrypoint",
    "picker",
    "--focus",
  ]);
}

export function launchInNewTab(plan: LaunchPlan, workspaceId: string | null): void {
  const createArgs = ["tab", "create", "--cwd", plan.cwd, "--label", plan.title, "--focus"];
  if (workspaceId) {
    createArgs.push("--workspace", workspaceId);
  }
  const created = runHerdr(createArgs);
  const paneId = paneIdFromLaunch(created);
  if (!paneId) {
    throw new Error("Herdr did not return a pane id for the new tab");
  }
  runHerdr(["pane", "run", paneId, ...plan.argv]);
}

export function paneIdFromLaunch(payload: unknown): string | null {
  const result = unwrapResult(payload);
  if (!result) {
    return null;
  }
  const root = asRecord(result.root_pane);
  const pane = asRecord(result.pane) ?? root;
  const id = pane?.pane_id;
  return typeof id === "string" ? id : null;
}

function unwrapResult(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const result = record.result;
  if (typeof result === "object" && result !== null) {
    return result as Record<string, unknown>;
  }
  return record;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function runHerdr(args: string[]): unknown {
  const result = spawnSync(herdrBin(), args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail || `herdr ${args.join(" ")} failed`);
  }
  const text = (result.stdout ?? "").trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

