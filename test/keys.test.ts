import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeKey, flushPending } from "../src/keys.ts";

test("arrow keys are not treated as Escape when the sequence arrives in chunks", () => {
  const first = consumeKey("\u001b");
  assert.equal(first.key, null);
  assert.equal(first.pending, true);

  const second = consumeKey(first.rest + "[A");
  assert.equal(second.key, "up");
  assert.equal(second.rest, "");
});

test("a lone Escape flushes as escape after the sequence times out", () => {
  const pending = consumeKey("\u001b");
  assert.equal(pending.pending, true);
  const flushed = flushPending(pending.rest);
  assert.equal(flushed.key, "escape");
});

test("complete CSI arrows decode in one chunk", () => {
  assert.equal(consumeKey("\u001b[B").key, "down");
  assert.equal(consumeKey("\u001b[C").key, "right");
  assert.equal(consumeKey("\u001b[D").key, "left");
});

test("Ctrl+E, Ctrl+D, and Delete are not filter characters", () => {
  assert.equal(consumeKey("\u0005").key, "ctrl-e");
  assert.equal(consumeKey("\u0004").key, "ctrl-d");
  assert.equal(consumeKey("\u001b[3~").key, "delete");
  const pending = consumeKey("\u001b[3");
  assert.equal(pending.key, null);
  assert.equal(pending.pending, true);
});
