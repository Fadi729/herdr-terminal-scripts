import type { VisibleScript } from "./visible.ts";

export function filterVisible(visible: VisibleScript[], query: string): VisibleScript[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return visible;
  }
  return visible.filter((script) => {
    const hay = `${script.name} ${script.disambiguator ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function renderPicker(input: {
  title: string;
  body?: string;
  visible?: VisibleScript[];
  query: string;
  selected: number;
}): string {
  const lines = [input.title, ""];
  if (input.body) {
    lines.push(input.body, "", "Esc to close.");
    return `${lines.join("\n")}\n`;
  }

  const visible = input.visible ?? [];
  visible.forEach((script, index) => {
    const slot = index < 9 ? String(index + 1) : " ";
    const marker = index === input.selected ? ">" : " ";
    const extra = script.disambiguator ? `  (${script.disambiguator})` : "";
    lines.push(`${marker} ${slot}  ${script.name}${extra}`);
  });
  const addMarker = input.selected === visible.length ? ">" : " ";
  lines.push(`${addMarker} +  Add Script`);
  if (visible.length === 0) {
    lines.push("", input.query ? "No matches." : "No Scripts yet.");
  }
  lines.push(
    "",
    `Filter: ${input.query}`,
    "Enter to run · Ctrl+E edit · Ctrl+D delete · + to add · Esc to close.",
  );
  return `${lines.join("\n")}\n`;
}

export type AddStep = "name" | "run" | "cwd" | "scope";

const ADD_STEPS: AddStep[] = ["name", "run", "cwd", "scope"];

export function adjacentAddStep(step: AddStep, direction: -1 | 1): AddStep {
  const index = ADD_STEPS.indexOf(step);
  const next = Math.min(ADD_STEPS.length - 1, Math.max(0, index + direction));
  return ADD_STEPS[next] ?? step;
}

export function renderAddForm(input: {
  intent?: "add" | "edit";
  step: AddStep;
  name: string;
  run: string;
  cwd: string;
  scope: "workspace" | "global";
  clonePath: string;
}): string {
  const lines = [input.intent === "edit" ? "Edit Script" : "Add Script", ""];
  const nameMark = input.step === "name" ? ">" : " ";
  const runMark = input.step === "run" ? ">" : " ";
  const cwdMark = input.step === "cwd" ? ">" : " ";
  const scopeMark = input.step === "scope" ? ">" : " ";
  lines.push(`${nameMark} Name: ${input.name}`);
  lines.push(`${runMark} Command: ${input.run}`);
  lines.push(`${cwdMark} cwd (optional): ${input.cwd}`);
  lines.push("    relative to the workspace (e.g. apps/web); leave blank for the workspace root");
  const scopeLabel =
    input.scope === "workspace" ? `This workspace (${input.clonePath})` : "Everywhere (Global)";
  lines.push(`${scopeMark} Scope: ${scopeLabel}`);
  lines.push("");
  lines.push("↑/↓ move between fields · ←/→ toggle scope · Enter to save · Esc to cancel.");
  return `${lines.join("\n")}\n`;
}

export function renderConfirmDelete(input: { name: string; disambiguator?: string }): string {
  const extra = input.disambiguator ? `  (${input.disambiguator})` : "";
  return ["Delete Script", "", `  ${input.name}${extra}`, "", "Enter to delete · Esc to cancel."].join(
    "\n",
  ) + "\n";
}
