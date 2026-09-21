import { isAbsolute, join } from "node:path";
import type { Script } from "./catalog.ts";
import type { Workspace } from "./match.ts";

export type LaunchPlan = {
  cwd: string;
  title: string;
  argv: string[];
};

export function posixSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function planLaunch(
  script: Script,
  workspace: Workspace,
  options: { herdrBin: string; shell?: string },
): LaunchPlan {
  const cwd = resolveCwd(script.cwd, workspace.cwd);
  return {
    cwd,
    title: script.name,
    argv: [cdThen(cwd, commandLine(argvFor(script, options)))],
  };
}

export function cdThen(cwd: string, command: string): string {
  return `cd ${posixSingleQuote(cwd)} && ${command}`;
}

function resolveCwd(scriptCwd: string | undefined, workspaceCwd: string): string {
  if (!scriptCwd) {
    return workspaceCwd;
  }
  return isAbsolute(scriptCwd) ? scriptCwd : join(workspaceCwd, scriptCwd);
}

function argvFor(script: Script, options: { herdrBin: string; shell?: string }): string[] {
  if (script.kind === "herdr") {
    return [options.herdrBin, ...(script.run as string[])];
  }
  if (script.kind === "shell") {
    const shell = options.shell ?? process.env.SHELL ?? "/bin/sh";
    return [shell, "-lc", script.run as string];
  }
  if (Array.isArray(script.run)) {
    return script.run;
  }
  return [script.run];
}

function commandLine(parts: string[]): string {
  return parts.map(posixSingleQuote).join(" ");
}
