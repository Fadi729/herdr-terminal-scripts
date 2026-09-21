import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { launchInNewTab, paneIdFromLaunch } from "../src/herdr.ts";

test("a new tab launch reads the root pane id", () => {
  const id = paneIdFromLaunch({
    id: "cli:tab:create",
    result: {
      type: "tab_create",
      tab: { tab_id: "w1:t2", label: "Test command" },
      root_pane: { pane_id: "w1:t2:p1" },
    },
  });
  assert.equal(id, "w1:t2:p1");
});

test("launchInNewTab creates a tab then runs the cd-then-command line in that pane", () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-fake-"));
  const bin = join(dir, "herdr");
  const log = join(dir, "argv.jsonl");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + "\\n");
if (process.argv[2] === "tab" && process.argv[3] === "create") {
  process.stdout.write(
    JSON.stringify({ result: { root_pane: { pane_id: "w1:t2:p1" } } }) + "\\n",
  );
}
`,
  );
  chmodSync(bin, 0o755);

  const previous = process.env.HERDR_BIN_PATH;
  process.env.HERDR_BIN_PATH = bin;
  try {
    launchInNewTab(
      {
        cwd: "/tmp/turbo/apps/web",
        title: "Web hello",
        argv: ["cd '/tmp/turbo/apps/web' && '/bin/bash' '-lc' 'npm run hello'"],
      },
      "w1",
    );
  } finally {
    if (previous === undefined) {
      delete process.env.HERDR_BIN_PATH;
    } else {
      process.env.HERDR_BIN_PATH = previous;
    }
  }

  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as string[]);
  assert.deepEqual(calls[0], [
    "tab",
    "create",
    "--cwd",
    "/tmp/turbo/apps/web",
    "--label",
    "Web hello",
    "--focus",
    "--workspace",
    "w1",
  ]);
  assert.deepEqual(calls[1], [
    "pane",
    "run",
    "w1:t2:p1",
    "cd '/tmp/turbo/apps/web' && '/bin/bash' '-lc' 'npm run hello'",
  ]);
  assert.match(calls[1]?.[3] ?? "", /^cd .* && /);
});
