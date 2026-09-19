import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadCatalog } from "../src/catalog.ts";

test("missing Catalog file is empty with the expected path", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"));
  const path = join(dir, "scripts.json");
  const result = loadCatalog(path);
  assert.deepEqual(result, { status: "missing", path });
});

test("invalid JSON is an invalid Catalog", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"));
  const path = join(dir, "scripts.json");
  writeFileSync(path, "{ not json");
  const result = loadCatalog(path);
  assert.equal(result.status, "invalid");
  assert.equal(result.path, path);
  assert.match(result.message, /JSON/i);
});

test("a valid Catalog loads Global and Scoped Scripts", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"));
  const path = join(dir, "scripts.json");
  writeFileSync(
    path,
    JSON.stringify({
      scripts: [
        {
          name: "Logs",
          kind: "herdr",
          run: ["plugin", "log", "list"],
        },
        {
          name: "Dev server",
          kind: "shell",
          run: "pnpm dev",
          when: [{ path: "~/Projects/app" }],
          cwd: "apps/web",
        },
      ],
    }),
  );
  const result = loadCatalog(path);
  assert.deepEqual(result, {
    status: "ok",
    scripts: [
      {
        name: "Logs",
        kind: "herdr",
        run: ["plugin", "log", "list"],
      },
      {
        name: "Dev server",
        kind: "shell",
        run: "pnpm dev",
        when: [{ path: "~/Projects/app" }],
        cwd: "apps/web",
      },
    ],
  });
});

test("a Catalog with a bad Script is invalid", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"));
  const path = join(dir, "scripts.json");
  writeFileSync(
    path,
    JSON.stringify({
      scripts: [{ name: "Dev", kind: "shell", run: ["pnpm", "dev"] }],
    }),
  );
  const result = loadCatalog(path);
  assert.equal(result.status, "invalid");
  assert.match(result.message, /shell run must be a non-empty string/);
});
