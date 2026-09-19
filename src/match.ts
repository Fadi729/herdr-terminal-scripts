import { existsSync, lstatSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";
import type { Matcher, Script } from "./catalog.ts";

export type Workspace = {
  cwd: string;
  home?: string;
};

export function expandMatcherPath(matcherPath: string, home: string): string {
  if (matcherPath === "~") {
    return home;
  }
  if (matcherPath.startsWith("~/") || matcherPath.startsWith("~\\")) {
    return join(home, matcherPath.slice(2));
  }
  return matcherPath;
}

export function matcherMatches(matchers: Matcher[], workspace: Workspace): boolean {
  const home = workspace.home ?? homedir();
  return matchers.some((matcher) => pathMatches(matcher.path, workspace.cwd, home));
}

export function pathMatches(matcherPath: string, workspaceCwd: string, home: string): boolean {
  const expanded = expandMatcherPath(matcherPath, home);
  if (!existsSync(expanded) || !lstatSync(expanded).isDirectory()) {
    return false;
  }
  if (!existsSync(workspaceCwd)) {
    return false;
  }

  const matcher = realpathSync(expanded);
  const cwd = realpathSync(workspaceCwd);
  if (cwd === matcher || cwd.startsWith(matcher + sep)) {
    return true;
  }

  const matcherGit = gitCommonDir(matcher);
  const cwdGit = gitCommonDir(cwd);
  return matcherGit !== null && cwdGit !== null && matcherGit === cwdGit;
}

function gitCommonDir(dir: string): string | null {
  try {
    const output = execFileSync("git", ["-C", dir, "rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) {
      return null;
    }
    const absolute = resolve(dir, output);
    return existsSync(absolute) ? realpathSync(absolute) : absolute;
  } catch {
    return null;
  }
}
