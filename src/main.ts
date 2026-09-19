import { stdin as stdinFd } from "node:process";
import { loadCatalog, removeScriptAt, replaceScriptAt, saveCatalog, scriptFromAdd, scriptFromEdit, type Script } from "./catalog.ts";
import {
  catalogPath,
  herdrBin,
  launchInNewTab,
  notify,
  openPickerPane,
  readPluginContext,
} from "./herdr.ts";
import { consumeKey, flushPending } from "./keys.ts";
import { planLaunch } from "./launch.ts";
import { clonePathForWorkspace, type Workspace } from "./match.ts";
import { adjacentAddStep, filterVisible, renderAddForm, renderConfirmDelete, renderPicker, type AddStep } from "./picker.ts";
import { resolvePicker, resolveSlot } from "./resolve.ts";
import type { VisibleScript } from "./visible.ts";

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
    runSlot(Number(slotMatch[1]));
    return;
  }
  await runPicker();
}

function workspaceFromEnv(): Workspace & { paneId: string | null; workspaceId: string | null } {
  const context = readPluginContext();
  return {
    cwd: context.workspaceCwd ?? "",
    home: process.env.HOME ?? "",
    paneId: context.focusedPaneId,
    workspaceId: context.workspaceId,
  };
}

function runSlot(slot: number): void {
  const workspace = workspaceFromEnv();
  if (!workspace.cwd) {
    notify("Terminal Scripts", "No active workspace.");
    process.exitCode = 1;
    return;
  }
  const catalog = loadCatalog(catalogPath());
  const result = resolveSlot(catalog, workspace, slot, { herdrBin: herdrBin() });
  if (result.status === "notify") {
    notify(result.title, result.body);
    return;
  }
  try {
    launchInNewTab(result.plan, workspace.workspaceId);
  } catch (error) {
    notify("Terminal Scripts", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
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

  await withRawMode(() => interactivePicker(workspace));
  // Herdr keeps a popup open until this command exits. stdin stays
  // readable after raw mode ends, so returning from main is not enough.
  process.exit(process.exitCode ?? 0);
}

async function interactivePicker(
  workspace: Workspace & { paneId: string | null; workspaceId: string | null },
): Promise<void> {
  let catalog = loadCatalog(catalogPath());
  let query = "";
  let selected = 0;
  let mode: "list" | AddStep = "list";
  let draftName = "";
  let draftRun = "";
  let draftCwd = "";
  let draftScope: "workspace" | "global" = workspace.cwd ? "workspace" : "global";
  let editingIndex: number | null = null;
  let pendingDeleteIndex: number | null = null;
  let pendingDeleteName = "";
  let pendingDeleteExtra = "";

  const clonePath = workspace.cwd ? clonePathForWorkspace(workspace.cwd) : "";

  while (true) {
    const view = resolvePicker(catalog, workspace);
    if (view.status === "message") {
      draw(renderPicker({ title: view.title, body: view.body, query: "", selected: 0 }));
      const key = await readKey();
      if (key === "escape" || key === "ctrl-c") {
        return;
      }
      continue;
    }

    if (pendingDeleteIndex !== null) {
      draw(
        renderConfirmDelete({
          name: pendingDeleteName,
          disambiguator: pendingDeleteExtra || undefined,
        }),
      );
      const key = await readKey();
      if (key === "ctrl-c") {
        return;
      }
      if (key === "escape") {
        pendingDeleteIndex = null;
        continue;
      }
      if (key === "enter") {
        persistDelete(pendingDeleteIndex);
        catalog = loadCatalog(catalogPath());
        pendingDeleteIndex = null;
        selected = 0;
      }
      continue;
    }

    if (mode !== "list") {
      draw(
        renderAddForm({
          intent: editingIndex === null ? "add" : "edit",
          step: mode,
          name: draftName,
          run: draftRun,
          cwd: draftCwd,
          scope: draftScope,
          clonePath,
        }),
      );
      const key = await readKey();
      if (key === "ctrl-c") {
        return;
      }
      if (key === "escape") {
        mode = "list";
        editingIndex = null;
        continue;
      }
      if (key === "up") {
        mode = adjacentAddStep(mode, -1);
        continue;
      }
      if (key === "down") {
        mode = adjacentAddStep(mode, 1);
        continue;
      }
      if (mode === "scope" && (key === "left" || key === "right" || key === "g" || key === "w")) {
        if (key === "g") {
          draftScope = "global";
        } else if (key === "w") {
          draftScope = "workspace";
        } else {
          draftScope = draftScope === "global" ? "workspace" : "global";
        }
        continue;
      }
      if (key === "enter") {
        if (mode === "name" && draftName.trim()) {
          mode = "run";
          continue;
        }
        if (mode === "run" && draftRun.trim()) {
          mode = "cwd";
          continue;
        }
        if (mode === "cwd") {
          if (!workspace.cwd) {
            draftScope = "global";
            persistDraft();
            catalog = loadCatalog(catalogPath());
            mode = "list";
            query = "";
            selected = 0;
          } else {
            mode = "scope";
          }
          continue;
        }
        if (mode === "scope" && draftName.trim() && draftRun.trim()) {
          persistDraft();
          catalog = loadCatalog(catalogPath());
          mode = "list";
          query = "";
          selected = 0;
        }
        continue;
      }
      if (mode === "name") {
        draftName = editField(draftName, key);
      } else if (mode === "run") {
        draftRun = editField(draftRun, key);
      } else if (mode === "cwd") {
        draftCwd = editField(draftCwd, key);
      }
      continue;
    }

    const visible = filterVisible(view.visible, query);
    const addIndex = visible.length;
    if (selected > addIndex) {
      selected = addIndex;
    }
    draw(
      renderPicker({
        title: view.title,
        visible,
        query,
        selected,
      }),
    );
    const key = await readKey();
    if (key === "escape" || key === "ctrl-c") {
      return;
    }
    if (key === "+" ) {
      startAdd();
      continue;
    }
    if (key === "ctrl-e") {
      const chosen = visible[selected];
      if (chosen) {
        startEdit(chosen);
      }
      continue;
    }
    if (key === "ctrl-d" || key === "delete") {
      const chosen = visible[selected];
      if (chosen) {
        startDelete(chosen);
      }
      continue;
    }
    if (key === "enter") {
      if (selected === addIndex) {
        startAdd();
        continue;
      }
      const chosen = visible[selected];
      if (chosen) {
        launchChosen(chosen, workspace);
        return;
      }
      continue;
    }
    if (key === "up") {
      selected = Math.max(0, selected - 1);
      continue;
    }
    if (key === "down") {
      selected = Math.min(addIndex, selected + 1);
      continue;
    }
    if (/^[1-9]$/.test(key)) {
      const chosen = visible[Number(key) - 1];
      if (chosen) {
        launchChosen(chosen, workspace);
        return;
      }
      continue;
    }
    if (key === "backspace") {
      query = query.slice(0, -1);
      selected = 0;
      continue;
    }
    if (key.length === 1 && !key.startsWith("\u001b")) {
      query += key;
      selected = 0;
    }
  }

  function startAdd(): void {
    editingIndex = null;
    mode = "name";
    draftName = "";
    draftRun = "";
    draftCwd = "";
    draftScope = workspace.cwd ? "workspace" : "global";
  }

  function startEdit(chosen: VisibleScript): void {
    editingIndex = chosen.catalogIndex;
    mode = "name";
    draftName = chosen.name;
    draftRun = typeof chosen.run === "string" ? chosen.run : chosen.run.join(" ");
    draftCwd = chosen.cwd ?? "";
    draftScope = chosen.when && chosen.when.length > 0 ? "workspace" : "global";
  }

  function startDelete(chosen: VisibleScript): void {
    pendingDeleteIndex = chosen.catalogIndex;
    pendingDeleteName = chosen.name;
    pendingDeleteExtra = chosen.disambiguator ?? "";
  }

  function persistDraft(): void {
    const existing = catalog.status === "ok" ? catalog.scripts : [];
    const input = {
      name: draftName,
      run: draftRun,
      scope: draftScope,
      clonePath: clonePath || workspace.cwd,
      cwd: draftCwd,
    };
    const next =
      editingIndex === null
        ? [...existing, scriptFromAdd(input)]
        : replaceScriptAt(
            existing,
            editingIndex,
            scriptFromEdit(existing[editingIndex] ?? scriptFromAdd(input), input),
          );
    saveCatalog(catalogPath(), next);
    editingIndex = null;
  }

  function persistDelete(index: number): void {
    const existing = catalog.status === "ok" ? catalog.scripts : [];
    saveCatalog(catalogPath(), removeScriptAt(existing, index));
  }
}

function launchChosen(
  chosen: Script,
  workspace: Workspace & { paneId: string | null; workspaceId: string | null },
): void {
  if (!workspace.cwd) {
    notify("Terminal Scripts", "No active workspace.");
    process.exit(1);
  }
  try {
    launchInNewTab(planLaunch(chosen, workspace, { herdrBin: herdrBin() }), workspace.workspaceId);
    process.exit(0);
  } catch (error) {
    notify("Terminal Scripts", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function editField(value: string, key: string): string {
  if (key === "backspace") {
    return value.slice(0, -1);
  }
  if (key.length === 1 && !key.startsWith("\u001b")) {
    return value + key;
  }
  return value;
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

await main();
