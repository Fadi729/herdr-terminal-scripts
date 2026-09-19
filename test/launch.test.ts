import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  assert.deepEqual(plan.argv, ["'/opt/herdr' 'plugin' 'log' 'list'"]);
});

test("a relative cwd resolves against the workspace cwd", () => {
  const plan = planLaunch(
    { name: "Dev server", kind: "shell", run: "pnpm dev", cwd: "apps/web" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/Users/fadi/Projects/app/apps/web");
  assert.deepEqual(plan.argv, ["'/bin/zsh' '-lc' 'pnpm dev'"]);
});

test("an absolute cwd is used as-is", () => {
  const plan = planLaunch(
    { name: "Dev server", kind: "shell", run: "pnpm dev", cwd: "/tmp/run" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/tmp/run");
});

test("exec and herdr Kinds are POSIX-quoted as one pane command line", () => {
  const pathPlan = planLaunch(
    { name: "Tool", kind: "exec", run: "./bin/tool" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(pathPlan.argv, ["'./bin/tool'"]);

  const argvPlan = planLaunch(
    { name: "Tool", kind: "exec", run: ["./my tool", "--watch"] },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(argvPlan.argv, ["'./my tool' '--watch'"]);
});

test("a shell Script keeps $ and quotes literal when the pane types the line", () => {
  const run = "echo 'cost is $HOME'";
  const plan = planLaunch(
    { name: "Cost", kind: "shell", run },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(plan.argv, ["'/bin/zsh' '-lc' 'echo '\\''cost is $HOME'\\'''"]);
  const typed = execFileSync("/bin/zsh", ["-f", "-c", plan.argv[0] ?? ""], {
    encoding: "utf8",
    env: { ...process.env, HOME: "/Users/fadi" },
  }).trim();
  assert.equal(typed, "cost is $HOME");
});
