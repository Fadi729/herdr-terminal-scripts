import { stdin as stdinFd } from "node:process";
import { loadCatalog } from "./catalog.ts";
import {
  catalogPath,
  herdrBin,
  launchInNewPane,
  notify,
  openPickerPane,
  readPluginContext,
} from "./herdr.ts";
import { planLaunch } from "./launch.ts";
import type { Workspace } from "./match.ts";
import { filterVisible, renderPicker } from "./picker.ts";
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

function workspaceFromEnv(): Workspace & { paneId: string | null } {
  const context = readPluginContext();
  return {
    cwd: context.workspaceCwd ?? "",
    home: process.env.HOME ?? "",
    paneId: context.focusedPaneId,
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
    launchInNewPane(result.plan, workspace.paneId);
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

  if (view.status === "message") {
    await showMessage(view.title, view.body);
    return;
  }

  await pickAndLaunch(view.visible, workspace.paneId);
}

async function showMessage(title: string, body: string): Promise<void> {
  await withRawMode(() => {
    draw(renderPicker({ title, body, query: "", selected: 0 }));
    return waitForExitKey();
  });
}

async function pickAndLaunch(allVisible: VisibleScript[], paneId: string | null): Promise<void> {
  let query = "";
  let selected = 0;

  const chosen = await withRawMode(async () => {
    while (true) {
      const visible = filterVisible(allVisible, query);
      if (selected >= visible.length) {
        selected = Math.max(0, visible.length - 1);
      }
      draw(
        renderPicker({
          title: "Terminal Scripts",
          visible,
          query,
          selected,
        }),
      );
      const key = await readKey();
      if (key === "escape" || key === "ctrl-c") {
        return null;
      }
      if (key === "enter") {
        return visible[selected] ?? null;
      }
      if (key === "up") {
        selected = Math.max(0, selected - 1);
        continue;
      }
      if (key === "down") {
        selected = Math.min(visible.length - 1, selected + 1);
        continue;
      }
      if (/^[1-9]$/.test(key)) {
        return visible[Number(key) - 1] ?? null;
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
  });

  if (!chosen) {
    return;
  }
  const workspace = workspaceFromEnv();
  if (!workspace.cwd) {
    notify("Terminal Scripts", "No active workspace.");
    return;
  }
  try {
    launchInNewPane(planLaunch(chosen, workspace, { herdrBin: herdrBin() }), paneId);
  } catch (error) {
    notify("Terminal Scripts", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
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
    stdinFd.setRawMode(false);
    process.stdout.write("\u001b[?25h");
  }
}

function waitForExitKey(): Promise<void> {
  return new Promise((resolve) => {
    const onData = () => {
      stdinFd.off("data", onData);
      resolve();
    };
    stdinFd.on("data", onData);
  });
}

function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const onData = (chunk: string) => {
      stdinFd.off("data", onData);
      resolve(decodeKey(chunk));
    };
    stdinFd.on("data", onData);
  });
}

function decodeKey(chunk: string): string {
  if (chunk === "\u0003") {
    return "ctrl-c";
  }
  if (chunk === "\u001b" || chunk === "\u001b\u001b") {
    return "escape";
  }
  if (chunk === "\r" || chunk === "\n") {
    return "enter";
  }
  if (chunk === "\u007f" || chunk === "\b") {
    return "backspace";
  }
  if (chunk === "\u001b[A" || chunk === "\u0010") {
    return "up";
  }
  if (chunk === "\u001b[B" || chunk === "\u000e") {
    return "down";
  }
  return chunk;
}

await main();
