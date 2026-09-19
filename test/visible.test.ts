import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";
import type { Script } from "../src/catalog.ts";
import { clonePathForWorkspace } from "../src/match.ts";
import { listVisible, scriptInSlot } from "../src/visible.ts";

const home = "/Users/fadi";
const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), ".tmp");

function git(dir: string, args: string[]) {
  execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=Test", ...args], {
    cwd: dir,
    stdio: ["ignore", "ignore", "pipe"],
  });
}

function script(partial: Partial<Script> & Pick<Script, "name" | "kind" | "run">): Script {
  return partial;
}

function scratchDir(prefix: string): string {
  mkdirSync(fixtureRoot, { recursive: true });
  return mkdtempSync(join(fixtureRoot, prefix));
}

function initClone(root: string): { clone: string; worktree: string; otherClone: string } {
  const clone = join(root, "app");
  const worktree = join(root, "app-auth");
  const otherClone = join(root, "app-copy");
  mkdirSync(clone);
  git(clone, ["init", "-b", "main"]);
  writeFileSync(join(clone, "README.md"), "app\n");
  git(clone, ["add", "README.md"]);
  git(clone, ["commit", "-m", "init"]);
  git(clone, ["worktree", "add", "-b", "auth", worktree]);
  mkdirSync(join(clone, "apps"), { recursive: true });
  mkdirSync(otherClone);
  git(otherClone, ["init", "-b", "main"]);
  writeFileSync(join(otherClone, "README.md"), "copy\n");
  git(otherClone, ["add", "README.md"]);
  git(otherClone, ["commit", "-m", "init"]);
  return { clone, worktree, otherClone };
}

test("Global Scripts are Visible in every workspace", () => {
  const visible = listVisible(
    [script({ name: "Logs", kind: "herdr", run: ["plugin", "log", "list"] })],
    { cwd: "/tmp/anywhere", home },
  );
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.name, "Logs");
  assert.equal(visible[0]?.disambiguator, undefined);
});

test("a Scoped Script is Visible under its clone and hidden in a second clone", () => {
  const root = scratchDir("visible-");
  const { clone, worktree, otherClone } = initClone(root);
  const scoped = script({
    name: "Dev server",
    kind: "shell",
    run: "pnpm dev",
    when: [{ path: clone }],
  });

  const inClone = listVisible([scoped], { cwd: join(clone, "apps"), home });
  assert.equal(inClone.length, 1);

  const inWorktree = listVisible([scoped], { cwd: worktree, home });
  assert.equal(inWorktree.length, 1);

  const inOther = listVisible([scoped], { cwd: otherClone, home });
  assert.equal(inOther.length, 0);
});

test("~ in a Matcher expands against home", () => {
  const root = scratchDir("visible-");
  const clone = join(root, "Projects", "app");
  mkdirSync(clone, { recursive: true });
  const scoped = script({
    name: "Dev server",
    kind: "shell",
    run: "pnpm dev",
    when: [{ path: "~/Projects/app" }],
  });
  const visible = listVisible([scoped], { cwd: clone, home: root });
  assert.equal(visible.length, 1);
});

test("a Matcher whose path is missing is not Visible", () => {
  const scoped = script({
    name: "Dev server",
    kind: "shell",
    run: "pnpm dev",
    when: [{ path: "/no/such/clone" }],
  });
  const visible = listVisible([scoped], { cwd: "/tmp", home });
  assert.equal(visible.length, 0);
});

test("Visible order is Scoped Catalog order, then Global Catalog order", () => {
  const root = scratchDir("visible-");
  const clone = join(root, "app");
  mkdirSync(clone);
  const scripts = [
    script({ name: "Global A", kind: "shell", run: "echo a" }),
    script({ name: "Scoped B", kind: "shell", run: "echo b", when: [{ path: clone }] }),
    script({ name: "Global C", kind: "shell", run: "echo c" }),
    script({ name: "Scoped D", kind: "shell", run: "echo d", when: [{ path: clone }] }),
  ];
  const visible = listVisible(scripts, { cwd: clone, home });
  assert.deepEqual(
    visible.map((item) => item.name),
    ["Scoped B", "Scoped D", "Global A", "Global C"],
  );
  assert.deepEqual(
    visible.map((item) => item.catalogIndex),
    [1, 3, 0, 2],
  );
});

test("Slots 1 through 9 are the first nine Visible Scripts", () => {
  const scripts = Array.from({ length: 12 }, (_, i) =>
    script({ name: `S${i + 1}`, kind: "shell", run: `echo ${i + 1}` }),
  );
  const visible = listVisible(scripts, { cwd: "/tmp", home });
  assert.equal(scriptInSlot(visible, 1)?.name, "S1");
  assert.equal(scriptInSlot(visible, 9)?.name, "S9");
  assert.equal(scriptInSlot(visible, 10), undefined);
  assert.equal(scriptInSlot(visible, 0), undefined);
});

test("duplicate Names are disambiguated only when both are Visible", () => {
  const root = scratchDir("visible-");
  const { clone, otherClone } = initClone(root);
  const scripts = [
    script({
      name: "Dev server",
      kind: "shell",
      run: "pnpm dev",
      when: [{ path: clone }],
    }),
    script({
      name: "Dev server",
      kind: "shell",
      run: "pnpm start",
      when: [{ path: otherClone }],
    }),
    script({ name: "Dev server", kind: "shell", run: "echo global" }),
  ];

  const onlyScopedAndGlobal = listVisible(scripts, { cwd: clone, home });
  assert.equal(onlyScopedAndGlobal.length, 2);
  assert.equal(onlyScopedAndGlobal[0]?.disambiguator, clone);
  assert.equal(onlyScopedAndGlobal[1]?.disambiguator, "global");

  const justGlobalName = listVisible(
    [scripts[2]!, script({ name: "Logs", kind: "shell", run: "echo logs" })],
    { cwd: clone, home },
  );
  assert.equal(justGlobalName[0]?.disambiguator, undefined);
});

test("this-workspace Add uses the clone path, including from a worktree", () => {
  const root = scratchDir("clone-path-");
  const { clone, worktree } = initClone(root);
  assert.equal(clonePathForWorkspace(clone), clone);
  assert.equal(clonePathForWorkspace(join(clone, "apps")), clone);
  assert.equal(clonePathForWorkspace(worktree), clone);
});
