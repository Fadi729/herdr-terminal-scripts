import assert from "node:assert/strict";
import { test } from "node:test";
import { filterVisible, renderAddForm, renderConfirmDelete, renderPicker } from "../src/picker.ts";

test("the Popup filter matches Name and disambiguator", () => {
  const visible = [
    {
      name: "Dev server",
      kind: "shell" as const,
      run: "pnpm dev",
      catalogIndex: 0,
      disambiguator: "/Users/fadi/app",
    },
    { name: "Logs", kind: "herdr" as const, run: ["plugin", "log", "list"], catalogIndex: 1 },
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
      {
        name: "Dev server",
        kind: "shell",
        run: "pnpm dev",
        catalogIndex: 0,
        disambiguator: "/tmp/app",
      },
      { name: "Logs", kind: "herdr", run: ["plugin", "log", "list"], catalogIndex: 1 },
    ],
    query: "",
    selected: 1,
  });
  assert.match(text, /^Terminal Scripts/m);
  assert.match(text, /> 2  Logs/);
  assert.match(text, /  1  Dev server  \(\/tmp\/app\)/);
  assert.match(text, /\+  Add Script/);
  assert.match(text, /Ctrl\+E edit · Ctrl\+D delete/);
});

test("an empty Popup still offers Add Script", () => {
  const text = renderPicker({
    title: "Terminal Scripts",
    visible: [],
    query: "",
    selected: 0,
  });
  assert.match(text, /> \+  Add Script/);
});

test("the edit form is the add form with the existing Script filled in", () => {
  const text = renderAddForm({
    intent: "edit",
    step: "name",
    name: "Dev",
    run: "pnpm dev",
    cwd: "apps/web",
    scope: "workspace",
    clonePath: "/Users/fadi/app",
  });
  assert.match(text, /^Edit Script/m);
  assert.match(text, /> Name: Dev/);
  assert.match(text, /Command: pnpm dev/);
  assert.match(text, /cwd \(optional\): apps\/web/);
  assert.match(text, /relative to the workspace \(e\.g\. apps\/web\)/);
  assert.match(text, /leave blank for the workspace root/);
  assert.match(text, /This workspace \(\/Users\/fadi\/app\)/);
});

test("delete asks for confirmation on the selected Script", () => {
  const text = renderConfirmDelete({
    name: "Dev server",
    disambiguator: "/tmp/app",
  });
  assert.match(text, /^Delete Script/m);
  assert.match(text, /Dev server  \(\/tmp\/app\)/);
  assert.match(text, /Enter to delete/);
  assert.match(text, /Esc to cancel/);
});
