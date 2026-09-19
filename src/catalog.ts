import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Kind = "shell" | "exec" | "herdr";

export type Matcher = { path: string };

export type Script = {
  name: string;
  kind: Kind;
  run: string | string[];
  when?: Matcher[];
  cwd?: string;
};

export type CatalogResult =
  | { status: "ok"; path: string; scripts: Script[] }
  | { status: "missing"; path: string }
  | { status: "invalid"; path: string; message: string };

export function loadCatalog(path: string): CatalogResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return { status: "missing", path };
    }
    return {
      status: "invalid",
      path,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      status: "invalid",
      path,
      message: error instanceof Error ? error.message : "Invalid JSON",
    };
  }

  const scripts = parseScripts(parsed);
  if (typeof scripts === "string") {
    return { status: "invalid", path, message: scripts };
  }
  return { status: "ok", path, scripts };
}

export function saveCatalog(path: string, scripts: Script[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const body = {
    scripts: scripts.map((script) => {
      const record: Record<string, unknown> = {
        name: script.name,
        kind: script.kind,
        run: script.run,
      };
      if (script.when && script.when.length > 0) {
        record.when = script.when;
      }
      if (script.cwd) {
        record.cwd = script.cwd;
      }
      return record;
    }),
  };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
}

export function scriptFromAdd(input: {
  name: string;
  run: string;
  scope: "global" | "workspace";
  clonePath: string;
  cwd: string;
}): Script {
  const script: Script = {
    name: input.name.trim(),
    kind: "shell",
    run: input.run.trim(),
  };
  applyCwd(script, input.cwd);
  if (input.scope === "workspace") {
    script.when = [{ path: input.clonePath }];
  }
  return script;
}

export function scriptFromEdit(
  existing: Script,
  input: {
    name: string;
    run: string;
    scope: "global" | "workspace";
    clonePath: string;
    cwd: string;
  },
): Script {
  const script: Script = {
    name: input.name.trim(),
    kind: existing.kind,
    run: typeof existing.run === "string" ? input.run.trim() : existing.run,
  };
  applyCwd(script, input.cwd);
  if (input.scope === "workspace") {
    script.when = [{ path: input.clonePath }];
  }
  return script;
}

function applyCwd(script: Script, cwd: string): void {
  const trimmed = cwd.trim();
  if (trimmed) {
    script.cwd = trimmed;
  }
}

export function replaceScriptAt(scripts: Script[], index: number, next: Script): Script[] {
  if (index < 0 || index >= scripts.length) {
    return scripts;
  }
  return scripts.map((script, i) => (i === index ? next : script));
}

export function removeScriptAt(scripts: Script[], index: number): Script[] {
  if (index < 0 || index >= scripts.length) {
    return scripts;
  }
  return scripts.filter((_, i) => i !== index);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}

function parseScripts(parsed: unknown): Script[] | string {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "Catalog must be a JSON object with a scripts array";
  }
  if (!("scripts" in parsed) || !Array.isArray(parsed.scripts)) {
    return "Catalog must be a JSON object with a scripts array";
  }

  const scripts: Script[] = [];
  for (const [index, item] of parsed.scripts.entries()) {
    const script = parseScript(item, index);
    if (typeof script === "string") {
      return script;
    }
    scripts.push(script);
  }
  return scripts;
}

function parseScript(item: unknown, index: number): Script | string {
  const where = `scripts[${index}]`;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    return `${where} must be an object`;
  }
  const record = item as Record<string, unknown>;

  if (typeof record.name !== "string" || record.name.length === 0) {
    return `${where} needs a non-empty name`;
  }
  if (record.kind !== "shell" && record.kind !== "exec" && record.kind !== "herdr") {
    return `${where} kind must be shell, exec, or herdr`;
  }

  const run = parseRun(record.kind, record.run, where);
  if ("error" in run) {
    return run.error;
  }

  const script: Script = { name: record.name, kind: record.kind, run: run.value };

  if ("when" in record && record.when !== undefined) {
    const when = parseWhen(record.when, where);
    if (typeof when === "string") {
      return when;
    }
    if (when.length > 0) {
      script.when = when;
    }
  }

  if ("cwd" in record && record.cwd !== undefined) {
    if (typeof record.cwd !== "string" || record.cwd.length === 0) {
      return `${where} cwd must be a non-empty string`;
    }
    script.cwd = record.cwd;
  }

  return script;
}

function parseRun(
  kind: Kind,
  run: unknown,
  where: string,
): { value: string | string[] } | { error: string } {
  if (kind === "shell") {
    if (typeof run !== "string" || run.length === 0) {
      return { error: `${where} shell run must be a non-empty string` };
    }
    return { value: run };
  }
  if (kind === "herdr") {
    if (!isStringArray(run) || run.length === 0) {
      return { error: `${where} herdr run must be a non-empty argv array` };
    }
    return { value: run };
  }
  if (typeof run === "string" && run.length > 0) {
    return { value: run };
  }
  if (isStringArray(run) && run.length > 0) {
    return { value: run };
  }
  return { error: `${where} exec run must be a path string or a non-empty argv array` };
}

function parseWhen(when: unknown, where: string): Matcher[] | string {
  if (!Array.isArray(when)) {
    return `${where} when must be an array of { path } matchers`;
  }
  const matchers: Matcher[] = [];
  for (const [i, entry] of when.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return `${where}.when[${i}] must be { path }`;
    }
    const path = (entry as { path?: unknown }).path;
    if (typeof path !== "string" || path.length === 0) {
      return `${where}.when[${i}] needs a non-empty path`;
    }
    matchers.push({ path });
  }
  return matchers;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}
