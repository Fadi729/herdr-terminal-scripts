import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cdThen, planLaunch } from "../src/launch.ts";

const workspace = { cwd: "/Users/fadi/Projects/app", home: "/Users/fadi" };

test("a Script with no cwd launches in the workspace cwd and is titled with its Name", () => {
  const plan = planLaunch(
    { name: "Logs", kind: "herdr", run: ["plugin", "log", "list"] },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/Users/fadi/Projects/app");
  assert.equal(plan.title, "Logs");
  assert.deepEqual(plan.argv, ["cd '/Users/fadi/Projects/app' && '/opt/herdr' 'plugin' 'log' 'list'"]);
});

test("a relative cwd resolves against the workspace cwd and cds before the command", () => {
  const plan = planLaunch(
    { name: "Dev server", kind: "shell", run: "pnpm dev", cwd: "apps/web" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/Users/fadi/Projects/app/apps/web");
  assert.deepEqual(plan.argv, [
    "cd '/Users/fadi/Projects/app/apps/web' && '/bin/zsh' '-lc' 'pnpm dev'",
  ]);
});

test("an absolute cwd is used as-is", () => {
  const plan = planLaunch(
    { name: "Dev server", kind: "shell", run: "pnpm dev", cwd: "/tmp/run" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.equal(plan.cwd, "/tmp/run");
  assert.deepEqual(plan.argv, ["cd '/tmp/run' && '/bin/zsh' '-lc' 'pnpm dev'"]);
});

test("exec and herdr Kinds are POSIX-quoted as one pane command line after cd", () => {
  const pathPlan = planLaunch(
    { name: "Tool", kind: "exec", run: "./bin/tool" },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(pathPlan.argv, ["cd '/Users/fadi/Projects/app' && './bin/tool'"]);

  const argvPlan = planLaunch(
    { name: "Tool", kind: "exec", run: ["./my tool", "--watch"] },
    workspace,
    { herdrBin: "/opt/herdr", shell: "/bin/zsh" },
  );
  assert.deepEqual(argvPlan.argv, ["cd '/Users/fadi/Projects/app' && './my tool' '--watch'"]);
});

test("a shell Script keeps $ and quotes literal when the pane types the line", () => {
  const run = "echo 'cost is $HOME'";
  const dir = mkdtempSync(join(tmpdir(), "launch-quote-"));
  const plan = planLaunch(
    { name: "Cost", kind: "shell", run },
    { cwd: dir, home: "/Users/fadi" },
    { herdrBin: "/opt/herdr", shell: "/bin/bash" },
  );
  assert.deepEqual(plan.argv, [`cd ${quote(dir)} && '/bin/bash' '-lc' 'echo '\\''cost is $HOME'\\'''`]);
  const typed = execFileSync("/bin/bash", ["-c", plan.argv[0] ?? ""], {
    encoding: "utf8",
    env: { ...process.env, HOME: "/Users/fadi" },
  }).trim();
  assert.equal(typed, "cost is $HOME");
});

test("a package Script cds into cwd before the command, even when the command fails", () => {
  const root = mkdtempSync(join(tmpdir(), "launch-cwd-"));
  const web = join(root, "apps", "web");
  mkdirSync(web, { recursive: true });
  writeFileSync(join(web, "marker"), "from-web\n");
  writeFileSync(join(root, "marker"), "from-root\n");

  const plan = planLaunch(
    { name: "Web hello", kind: "shell", run: "cat marker; pwd; false", cwd: "apps/web" },
    { cwd: root, home: tmpdir() },
    { herdrBin: "/opt/herdr", shell: "/bin/bash" },
  );
  assert.equal(plan.argv[0], cdThen(web, "'/bin/bash' '-lc' 'cat marker; pwd; false'"));

  let status = 0;
  let output = "";
  try {
    output = execFileSync("/bin/bash", ["-c", plan.argv[0] ?? ""], { encoding: "utf8" });
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    status = failed.status ?? 1;
    output = failed.stdout ?? "";
  }
  assert.equal(status, 1);
  assert.match(output, /^from-web$/m);
  assert.match(output, new RegExp(`^${web.replaceAll("\\", "\\\\")}$`, "m"));
  assert.doesNotMatch(output, /from-root/);
});

function quote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
