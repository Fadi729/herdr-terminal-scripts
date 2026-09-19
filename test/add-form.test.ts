import assert from "node:assert/strict";
import { test } from "node:test";
import { adjacentAddStep } from "../src/picker.ts";

test("arrow keys move between Name, Command, cwd, and Scope", () => {
  assert.equal(adjacentAddStep("name", 1), "run");
  assert.equal(adjacentAddStep("run", 1), "cwd");
  assert.equal(adjacentAddStep("cwd", 1), "scope");
  assert.equal(adjacentAddStep("scope", 1), "scope");
  assert.equal(adjacentAddStep("scope", -1), "cwd");
  assert.equal(adjacentAddStep("cwd", -1), "run");
  assert.equal(adjacentAddStep("run", -1), "name");
  assert.equal(adjacentAddStep("name", -1), "name");
});
