import assert from "node:assert/strict";
import { test } from "node:test";
import { paneIdFromLaunch } from "../src/herdr.ts";

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
