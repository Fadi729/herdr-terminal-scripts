import assert from "node:assert/strict";
import { test } from "node:test";
import { createSession, handleSessionKey } from "../src/session.ts";
import type { VisibleScript } from "../src/visible.ts";

const ctx = { clonePath: "/Users/fadi/Projects/app" };

function scripts(): VisibleScript[] {
  return [
    { name: "Dev", kind: "shell", run: "pnpm dev", catalogIndex: 0 },
    { name: "Logs", kind: "shell", run: "tail -f log", catalogIndex: 1 },
  ];
}

test("a digit launches a Slot only when the filter is empty", () => {
  const empty = createSession(scripts(), true);
  const launch = handleSessionKey(empty, "2", ctx);
  assert.equal(launch.effect.type, "launch");
  if (launch.effect.type === "launch") {
    assert.equal(launch.effect.script.name, "Logs");
  }

  const filtered = handleSessionKey(empty, "d", ctx).session;
  const typed = handleSessionKey(filtered, "2", ctx);
  assert.equal(typed.effect.type, "none");
  assert.equal(typed.session.query, "d2");
});

test("an unbound key does not close the Popup", () => {
  const session = createSession(scripts(), true);
  const next = handleSessionKey(session, "unbound", ctx);
  assert.equal(next.effect.type, "none");
  assert.equal(next.session.mode, "list");
});

test("Enter on a Script launches it and + starts Add", () => {
  const session = createSession(scripts(), true);
  const launched = handleSessionKey(session, "enter", ctx);
  assert.equal(launched.effect.type, "launch");

  const add = handleSessionKey(session, "+", ctx);
  assert.equal(add.session.mode, "name");
  assert.equal(add.effect.type, "none");
});

test("Ctrl+E then Enter on Scope saves an edit of that Catalog row", () => {
  let session = createSession(scripts(), true);
  session = handleSessionKey(session, "ctrl-e", ctx).session;
  assert.equal(session.mode, "name");
  assert.equal(session.editingIndex, 0);

  session = handleSessionKey(session, "enter", ctx).session;
  session = handleSessionKey(session, "enter", ctx).session;
  session = handleSessionKey(session, "enter", ctx).session;
  const saved = handleSessionKey(session, "enter", ctx);
  assert.equal(saved.effect.type, "persist-edit");
  if (saved.effect.type === "persist-edit") {
    assert.equal(saved.effect.index, 0);
    assert.equal(saved.effect.original.name, "Dev");
    assert.equal(saved.effect.draft.run, "pnpm dev");
  }
});
