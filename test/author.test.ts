import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  indexOfScript,
  loadCatalog,
  removeScriptAt,
  replaceScriptAt,
  saveCatalog,
  scriptFromAdd,
  scriptFromEdit,
} from "../src/catalog.ts";

test("saveCatalog writes a file that loadCatalog can read", () => {
  const path = join(mkdtempSync(join(tmpdir(), "catalog-")), "scripts.json");
  saveCatalog(path, [
    { name: "Echo", kind: "shell", run: "echo hi" },
    { name: "Dev", kind: "shell", run: "pnpm dev", when: [{ path: "/tmp/app" }] },
  ]);
  const result = loadCatalog(path);
  assert.deepEqual(result, {
    status: "ok",
    path,
    scripts: [
      { name: "Echo", kind: "shell", run: "echo hi" },
      { name: "Dev", kind: "shell", run: "pnpm dev", when: [{ path: "/tmp/app" }] },
    ],
  });
});

test("adding from the Popup creates a Global or Scoped shell Script", () => {
  const global = scriptFromAdd({
    name: " Echo hello ",
    run: " echo hi ",
    scope: "global",
    clonePath: "/Users/fadi/Projects/app",
    cwd: "",
  });
  assert.deepEqual(global, { name: "Echo hello", kind: "shell", run: "echo hi" });

  const scoped = scriptFromAdd({
    name: "Dev",
    run: "pnpm dev",
    scope: "workspace",
    clonePath: "/Users/fadi/Projects/app",
    cwd: "",
  });
  assert.deepEqual(scoped, {
    name: "Dev",
    kind: "shell",
    run: "pnpm dev",
    when: [{ path: "/Users/fadi/Projects/app" }],
  });
});

test("an optional cwd is stored on the Script and omitted when blank", () => {
  const withCwd = scriptFromAdd({
    name: "Web",
    run: "pnpm dev",
    scope: "workspace",
    clonePath: "/Users/fadi/Projects/app",
    cwd: " apps/web ",
  });
  assert.equal(withCwd.cwd, "apps/web");

  const cleared = scriptFromEdit(
    { name: "Web", kind: "shell", run: "pnpm dev", cwd: "apps/web" },
    {
      name: "Web",
      run: "pnpm dev",
      scope: "global",
      clonePath: "/Users/fadi/Projects/app",
      cwd: "  ",
    },
  );
  assert.equal(cleared.cwd, undefined);
});

test("editing from the Popup updates Name, Command, and Scope and keeps Kind and cwd", () => {
  const existing = {
    name: "Dev",
    kind: "shell" as const,
    run: "pnpm dev",
    when: [{ path: "/Users/fadi/Projects/app" }],
    cwd: "apps/web",
  };
  const renamed = scriptFromEdit(existing, {
    name: " Web ",
    run: " pnpm start ",
    scope: "global",
    clonePath: "/Users/fadi/Projects/app",
    cwd: "apps/web",
  });
  assert.deepEqual(renamed, {
    name: "Web",
    kind: "shell",
    run: "pnpm start",
    cwd: "apps/web",
  });

  const scoped = scriptFromEdit(
    { name: "Logs", kind: "herdr", run: ["plugin", "log", "list"] },
    {
      name: "Logs",
      run: "plugin log list",
      scope: "workspace",
      clonePath: "/Users/fadi/Projects/app",
      cwd: "",
    },
  );
  assert.deepEqual(scoped, {
    name: "Logs",
    kind: "herdr",
    run: ["plugin", "log", "list"],
    when: [{ path: "/Users/fadi/Projects/app" }],
  });
});

test("replace and remove target a Catalog index so duplicate Names stay distinct", () => {
  const scripts = [
    { name: "Dev", kind: "shell" as const, run: "pnpm dev" },
    { name: "Dev", kind: "shell" as const, run: "pnpm start" },
    { name: "Logs", kind: "shell" as const, run: "tail -f log" },
  ];
  assert.deepEqual(removeScriptAt(scripts, 1), [scripts[0], scripts[2]]);
  assert.deepEqual(replaceScriptAt(scripts, 1, { name: "Start", kind: "shell", run: "pnpm start" }), [
    scripts[0],
    { name: "Start", kind: "shell", run: "pnpm start" },
    scripts[2],
  ]);
  assert.deepEqual(removeScriptAt(scripts, 9), scripts);
});

test("indexOfScript prefers the original Catalog index and falls back to a match", () => {
  const scripts = [
    { name: "Dev", kind: "shell" as const, run: "pnpm dev" },
    { name: "Dev", kind: "shell" as const, run: "pnpm start" },
  ];
  assert.equal(indexOfScript(scripts, scripts[1]!, 1), 1);
  assert.equal(indexOfScript(scripts, scripts[1]!, 0), 1);
  assert.equal(indexOfScript(scripts, { name: "Gone", kind: "shell", run: "x" }, 0), -1);
});
