import type { CatalogResult } from "./catalog.ts";
import { planLaunch, type LaunchPlan } from "./launch.ts";
import type { Workspace } from "./match.ts";
import { listVisible, scriptInSlot, type VisibleScript } from "./visible.ts";

export type PickerView =
  | { status: "list"; title: string; visible: VisibleScript[]; path: string }
  | { status: "message"; title: string; body: string; path: string };

export type SlotResult =
  | { status: "launch"; plan: LaunchPlan }
  | { status: "notify"; title: string; body: string };

const TITLE = "Terminal Scripts";

export function resolvePicker(catalog: CatalogResult, workspace: Workspace): PickerView {
  if (catalog.status === "invalid") {
    return {
      status: "message",
      title: TITLE,
      body: `Catalog is invalid.\n${catalog.path}\n${catalog.message}`,
      path: catalog.path,
    };
  }
  const scripts = catalog.status === "ok" ? catalog.scripts : [];
  const visible = listVisible(scripts, workspace);
  return { status: "list", title: TITLE, visible, path: catalog.path };
}

export function resolveSlot(
  catalog: CatalogResult,
  workspace: Workspace,
  slot: number,
  options: { herdrBin: string },
): SlotResult {
  if (catalog.status === "missing") {
    return {
      status: "notify",
      title: TITLE,
      body: `No Scripts yet. Create ${catalog.path}`,
    };
  }
  if (catalog.status === "invalid") {
    return {
      status: "notify",
      title: TITLE,
      body: `Catalog is invalid: ${catalog.message}`,
    };
  }
  const visible = listVisible(catalog.scripts, workspace);
  const script = scriptInSlot(visible, slot);
  if (!script) {
    return {
      status: "notify",
      title: TITLE,
      body: `No Script in slot ${slot} for this workspace.`,
    };
  }
  return { status: "launch", plan: planLaunch(script, workspace, options) };
}
