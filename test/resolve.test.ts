import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePicker, resolveSlot } from "../src/resolve.ts";

const workspace = { cwd: "/Users/fadi/Projects/app", home: "/Users/fadi" };
const catalogPath = "/Users/fadi/.config/herdr/plugins/terminal-scripts/scripts.json";

test("a missing Catalog tells the Popup the expected path and Slots notify", () => {
  const missing = { status: "missing" as const, path: catalogPath };
  const picker = resolvePicker(missing, workspace);
  assert.equal(picker.status, "message");
  assert.match(picker.body, /scripts\.json/);
  assert.match(picker.body, /No Scripts yet/);

  const slot = resolveSlot(missing, workspace, 1, { herdrBin: "/opt/herdr" });
  assert.equal(slot.status, "notify");
  assert.equal(slot.title, "Terminal Scripts");
});

test("an invalid Catalog shows the parse error and Slots notify", () => {
  const invalid = {
    status: "invalid" as const,
    path: catalogPath,
    message: "Unexpected token",
  };
  const picker = resolvePicker(invalid, workspace);
  assert.equal(picker.status, "message");
  assert.match(picker.body, /Unexpected token/);

  const slot = resolveSlot(invalid, workspace, 3, { herdrBin: "/opt/herdr" });
  assert.equal(slot.status, "notify");
});

test("an empty Slot notifies instead of launching", () => {
  const slot = resolveSlot(
    { status: "ok", scripts: [] },
    workspace,
    1,
    { herdrBin: "/opt/herdr" },
  );
  assert.equal(slot.status, "notify");
  assert.match(slot.body, /slot 1/i);
});

test("a filled Slot returns a launch plan", () => {
  const slot = resolveSlot(
    {
      status: "ok",
      scripts: [{ name: "Logs", kind: "herdr", run: ["plugin", "log", "list"] }],
    },
    workspace,
    1,
    { herdrBin: "/opt/herdr" },
  );
  assert.equal(slot.status, "launch");
  assert.equal(slot.plan.title, "Logs");
});
