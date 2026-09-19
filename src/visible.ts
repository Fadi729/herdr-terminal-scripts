import type { Script } from "./catalog.ts";
import { expandMatcherPath, matcherMatches, type Workspace } from "./match.ts";

export type VisibleScript = Script & {
  catalogIndex: number;
  disambiguator?: string;
};

export function listVisible(scripts: Script[], workspace: Workspace): VisibleScript[] {
  const scoped: VisibleScript[] = [];
  const global: VisibleScript[] = [];
  for (const [catalogIndex, script] of scripts.entries()) {
    const visible: VisibleScript = { ...script, catalogIndex };
    if (!script.when || script.when.length === 0) {
      global.push(visible);
      continue;
    }
    if (matcherMatches(script.when, workspace)) {
      scoped.push(visible);
    }
  }

  return withDisambiguators([...scoped, ...global], workspace);
}

export function scriptInSlot(visible: VisibleScript[], slot: number): VisibleScript | undefined {
  if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
    return undefined;
  }
  return visible[slot - 1];
}

function withDisambiguators(visible: VisibleScript[], workspace: Workspace): VisibleScript[] {
  const counts = new Map<string, number>();
  for (const script of visible) {
    counts.set(script.name, (counts.get(script.name) ?? 0) + 1);
  }

  return visible.map((script) => {
    if ((counts.get(script.name) ?? 0) < 2) {
      return script;
    }
    return { ...script, disambiguator: disambiguatorFor(script, workspace) };
  });
}

function disambiguatorFor(script: Script, workspace: Workspace): string {
  if (!script.when || script.when.length === 0) {
    return "global";
  }
  const home = workspace.home ?? "";
  return script.when.map((matcher) => expandMatcherPath(matcher.path, home)).join(", ");
}
