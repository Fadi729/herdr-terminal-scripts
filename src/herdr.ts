import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { LaunchPlan } from "./launch.ts";

export type PluginContext = {
  workspaceCwd: string | null;
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
    return { workspaceCwd: null, focusedPaneId: null };
  }
  try {
    const parsed = JSON.parse(raw) as {
      workspace_cwd?: string | null;
      focused_pane_id?: string | null;
    };
    return {
      workspaceCwd: parsed.workspace_cwd ?? null,
      focusedPaneId: parsed.focused_pane_id ?? null,
    };
  } catch {
    return { workspaceCwd: null, focusedPaneId: null };
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

export function launchInNewPane(plan: LaunchPlan, focusedPaneId: string | null): void {
  const splitArgs = ["pane", "split", "--direction", "down", "--cwd", plan.cwd, "--focus"];
  if (focusedPaneId) {
    splitArgs.push("--pane", focusedPaneId);
  }
  const split = runHerdr(splitArgs);
  const paneId = paneIdFrom(split);
  if (!paneId) {
    throw new Error("Herdr did not return a pane id for the split");
  }
  runHerdr(["pane", "rename", paneId, plan.title]);
  runHerdr(["pane", "run", paneId, ...plan.argv]);
}

function runHerdr(args: string[]): unknown {
  const result = spawnSync(herdrBin(), args, {
    encoding: "utf8",
    env: process.env,
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

function paneIdFrom(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const result = "result" in payload ? (payload as { result?: unknown }).result : payload;
  if (typeof result !== "object" || result === null) {
    return null;
  }
  const pane = "pane" in result ? (result as { pane?: unknown }).pane : result;
  if (typeof pane !== "object" || pane === null) {
    return null;
  }
  const id = "pane_id" in pane ? (pane as { pane_id?: unknown }).pane_id : undefined;
  return typeof id === "string" ? id : null;
}
