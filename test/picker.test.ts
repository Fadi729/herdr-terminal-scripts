import assert from "node:assert/strict";
import { test } from "node:test";
import { filterVisible, renderPicker } from "../src/picker.ts";

test("the Popup filter matches Name and disambiguator", () => {
  const visible = [
    { name: "Dev server", kind: "shell" as const, run: "pnpm dev", disambiguator: "/Users/fadi/app" },
    { name: "Logs", kind: "herdr" as const, run: ["plugin", "log", "list"] },
  ];
  assert.deepEqual(
    filterVisible(visible, "dev").map((script) => script.name),
    ["Dev server"],
  );
  assert.deepEqual(
    filterVisible(visible, "fadi").map((script) => script.name),
    ["Dev server"],
  );
});

test("the Popup list marks the selection and Slot numbers", () => {
  const text = renderPicker({
    title: "Terminal Scripts",
    visible: [
      { name: "Dev server", kind: "shell", run: "pnpm dev", disambiguator: "/tmp/app" },
      { name: "Logs", kind: "herdr", run: ["plugin", "log", "list"] },
    ],
    query: "",
    selected: 1,
  });
  assert.match(text, /^Terminal Scripts/m);
  assert.match(text, /> 2  Logs/);
  assert.match(text, /  1  Dev server  \(\/tmp\/app\)/);
});
