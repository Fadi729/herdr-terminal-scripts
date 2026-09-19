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
  if (visible.length === 0) {
    lines.push("No matches.", "", `Filter: ${input.query}`, "", "Esc to close.");
    return `${lines.join("\n")}\n`;
  }

  visible.forEach((script, index) => {
    const slot = index < 9 ? String(index + 1) : " ";
    const marker = index === input.selected ? ">" : " ";
    const extra = script.disambiguator ? `  (${script.disambiguator})` : "";
    lines.push(`${marker} ${slot}  ${script.name}${extra}`);
  });
  lines.push("", `Filter: ${input.query}`, "Enter to run · 1-9 for a Slot · Esc to close.");
  return `${lines.join("\n")}\n`;
}
