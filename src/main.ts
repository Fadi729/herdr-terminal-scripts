import { stdin as stdinFd } from "node:process";
import {
  indexOfScript,
  loadCatalog,
  removeScriptAt,
  replaceScriptAt,
  saveCatalog,
  scriptFromAdd,
  scriptFromEdit,
  type Script,
} from "./catalog.ts";
import {
  catalogPath,
  herdrBin,
  launchInNewTab,
  notify,
  openPickerPane,
  readPluginContext,
} from "./herdr.ts";
import { consumeKey, flushPending } from "./keys.ts";
import { planLaunch, type LaunchPlan } from "./launch.ts";
import { clonePathForWorkspace, type Workspace } from "./match.ts";
import { filterVisible, renderAddForm, renderConfirmDelete, renderPicker } from "./picker.ts";
import { resolvePicker, resolveSlot } from "./resolve.ts";
import {
  createSession,
  handleSessionKey,
  type Session,
  type SessionEffect,
} from "./session.ts";

export type PluginWorkspace = Workspace & { workspaceId: string | null };

async function main(): Promise<void> {
  const entry = process.env.HERDR_PLUGIN_ENTRYPOINT_ID;
  const action = process.env.HERDR_PLUGIN_ACTION_ID ?? "";

  if (entry === "picker") {
    await runPicker();
    return;
  }
  if (action === "picker") {
    openPickerPane();
    return;
  }
  const slotMatch = /^run-([1-9])$/.exec(action);
  if (slotMatch) {
    process.exitCode = runSlot(Number(slotMatch[1]));
    return;
  }
  await runPicker();
}

function workspaceFromEnv(): PluginWorkspace {
  const context = readPluginContext();
  return {
    cwd: context.workspaceCwd ?? "",
    home: process.env.HOME ?? "",
    workspaceId: context.workspaceId,
  };
}

function runSlot(slot: number): number {
  const workspace = workspaceFromEnv();
  if (!workspace.cwd) {
    report("No active workspace.");
    return 1;
  }
  const catalog = loadCatalog(catalogPath());
  const result = resolveSlot(catalog, workspace, slot, { herdrBin: herdrBin() });
  if (result.status === "notify") {
    report(result.body);
    return 0;
  }
  return launchPlan(result.plan, workspace.workspaceId);
}

async function runPicker(): Promise<void> {
  const workspace = workspaceFromEnv();
  const catalog = loadCatalog(catalogPath());
  const view = resolvePicker(catalog, workspace);

  if (!stdinFd.isTTY) {
    if (view.status === "message") {
      process.stdout.write(`${view.body}\n`);
      return;
    }
    process.stdout.write(
      renderPicker({ title: view.title, visible: view.visible, query: "", selected: 0 }),
    );
    return;
  }

  const outcome = await withRawMode(() => interactivePicker(workspace));
  if (outcome.type === "launch") {
    process.exit(launchPlan(planLaunch(outcome.script, workspace, { herdrBin: herdrBin() }), workspace.workspaceId));
  }
  process.exit(0);
}

async function interactivePicker(
  workspace: PluginWorkspace,
): Promise<{ type: "quit" } | { type: "launch"; script: Script }> {
  const clonePath = workspace.cwd ? clonePathForWorkspace(workspace.cwd) : "";
  let session = loadSession(workspace);

  while (true) {
    if (session === null) {
      const catalog = loadCatalog(catalogPath());
      const view = resolvePicker(catalog, workspace);
      draw(renderPicker({ title: view.title, body: view.status === "message" ? view.body : "", query: "", selected: 0 }));
      const key = await readKey();
      if (key === "escape" || key === "ctrl-c") {
        return { type: "quit" };
      }
      continue;
    }

    drawSession(session, clonePath);
    const key = await readKey();
    const next = handleSessionKey(session, key, { clonePath: clonePath || workspace.cwd });
    session = next.session;
    const result = applyEffect(next.effect, workspace);
    if (result.type === "quit" || result.type === "launch") {
      return result;
    }
    if (result.type === "reload") {
      session = loadSession(workspace) ?? session;
    }
  }
}

function loadSession(workspace: PluginWorkspace): Session | null {
  const catalog = loadCatalog(catalogPath());
  const view = resolvePicker(catalog, workspace);
  if (view.status === "message") {
    return null;
  }
  return createSession(view.visible, Boolean(workspace.cwd));
}

function drawSession(session: Session, clonePath: string): void {
  if (session.mode === "confirm-delete" && session.pendingDelete) {
    draw(
      renderConfirmDelete({
        name: session.pendingDelete.name,
        disambiguator: session.pendingDelete.extra || undefined,
      }),
    );
    return;
  }
  if (session.mode !== "list" && session.mode !== "confirm-delete") {
    draw(
      renderAddForm({
        intent: session.editingIndex === null ? "add" : "edit",
        step: session.mode,
        name: session.draft.name,
        run: session.draft.run,
        cwd: session.draft.cwd,
        scope: session.draft.scope,
        clonePath,
      }),
    );
    return;
  }
  const visible = filterVisible(session.visible, session.query);
  const selected = Math.min(session.selected, visible.length);
  draw(
    renderPicker({
      title: "Terminal Scripts",
      visible,
      query: session.query,
      selected,
    }),
  );
}

function applyEffect(
  effect: SessionEffect,
  workspace: PluginWorkspace,
): { type: "none" } | { type: "quit" } | { type: "launch"; script: Script } | { type: "reload" } {
  if (effect.type === "none") {
    return { type: "none" };
  }
  if (effect.type === "quit") {
    return { type: "quit" };
  }
  if (effect.type === "launch") {
    return { type: "launch", script: effect.script };
  }
  const path = catalogPath();
  const live = loadCatalog(path);
  if (live.status === "invalid") {
    report(`Catalog is invalid: ${live.message}`);
    return { type: "none" };
  }
  const existing = live.status === "ok" ? live.scripts : [];
  if (effect.type === "persist-add") {
    saveCatalog(path, [...existing, scriptFromAdd(effect.draft)]);
    return { type: "reload" };
  }
  if (effect.type === "persist-edit") {
    const index = indexOfScript(existing, effect.original, effect.index);
    if (index < 0) {
      report("Catalog changed. The Script was not saved.");
      return { type: "reload" };
    }
    saveCatalog(path, replaceScriptAt(existing, index, scriptFromEdit(existing[index] ?? scriptFromAdd(effect.draft), effect.draft)));
    return { type: "reload" };
  }
  const index = indexOfScript(existing, effect.original, effect.index);
  if (index < 0) {
    report("Catalog changed. The Script was not deleted.");
    return { type: "reload" };
  }
  saveCatalog(path, removeScriptAt(existing, index));
  return { type: "reload" };
}

function launchPlan(plan: LaunchPlan, workspaceId: string | null): number {
  try {
    launchInNewTab(plan, workspaceId);
    return 0;
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function report(body: string): void {
  try {
    notify("Terminal Scripts", body);
  } catch {
    process.stderr.write(`${body}\n`);
  }
}

function draw(text: string): void {
  process.stdout.write(`\u001b[?25l\u001b[2J\u001b[H${text}`);
}

async function withRawMode<T>(fn: () => Promise<T>): Promise<T> {
  stdinFd.setRawMode(true);
  stdinFd.resume();
  stdinFd.setEncoding("utf8");
  try {
    return await fn();
  } finally {
    stdinFd.pause();
    stdinFd.removeAllListeners("data");
    stdinFd.setRawMode(false);
    process.stdout.write("\u001b[?25h");
  }
}

function readKey(): Promise<string> {
  return new Promise((resolve) => {
    let buffer = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (key: string) => {
      stdinFd.off("data", onData);
      if (timer) {
        clearTimeout(timer);
      }
      resolve(key);
    };
    const pump = () => {
      const { key, rest, pending } = consumeKey(buffer);
      buffer = rest;
      if (key) {
        finish(key);
        return;
      }
      if (pending) {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          const flushed = flushPending(buffer);
          buffer = flushed.rest;
          if (flushed.key) {
            finish(flushed.key);
          }
        }, 40);
      }
    };
    const onData = (chunk: string) => {
      buffer += chunk;
      pump();
    };
    stdinFd.on("data", onData);
  });
}

try {
  await main();
} catch (error) {
  report(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
