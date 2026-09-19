import assert from "node:assert/strict";
import { test } from "node:test";
import { planLaunch } from "../src/launch.ts";

const workspace = { cwd: "/Users/fadi/Projects/app", home: "/Users/fadi" };

test("a Script with no cwd launches in the workspace cwd and is titled with its Name", () => {
  const plan = planLaunch(
    { name: "Logs", kind: "herdr", run: ["plugin", "log", "list"] },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/Users/fadi/Projects/app");
  assert.equal(plan.title, "Logs");
  assert.deepEqual(plan.argv, ["/opt/herdr", "plugin", "log", "list"]);
});

test("a relative cwd resolves against the workspace cwd", () => {
  const plan = planLaunch(
    { name: "Dev server", kind: "shell", run: "pnpm dev", cwd: "apps/web" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/Users/fadi/Projects/app/apps/web");
  assert.deepEqual(plan.argv, ['/bin/zsh -lc "pnpm dev"']);
});

test("an absolute cwd is used as-is", () => {
  const plan = planLaunch(
    { name: "Dev server", kind: "shell", run: "pnpm dev", cwd: "/tmp/run" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/tmp/run");
});

test("exec Kind uses a path or argv as-is", () => {
  const pathPlan = planLaunch(
    { name: "Tool", kind: "exec", run: "./bin/tool" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(pathPlan.argv, ["./bin/tool"]);

  const argvPlan = planLaunch(
    { name: "Tool", kind: "exec", run: ["./bin/tool", "--watch"] },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(argvPlan.argv, ["./bin/tool", "--watch"]);
});
