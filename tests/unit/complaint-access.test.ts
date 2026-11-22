import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the permission policy without the Vite alias loader.
const roles = [
  "CLUB_MANAGER",
  "GROOM",
  "HEAD_TRAINER",
  "VETERINARIAN",
  "HORSE_OWNER",
];
const source = readFileSync(
  new URL("../../src/shared/lib/permissions.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const policyModule = { exports: {} as Record<string, (...args: any[]) => any> };
runInNewContext(`(function(require, module, exports) { ${compiled} })`, {})(
  () => ({ ROLES: roles }),
  policyModule,
  policyModule.exports,
);
const { screenAccess, defaultPermissions, sidebarNavFor } =
  policyModule.exports;

test("staff can open complaints and find the same route in their sidebar", () => {
  for (const role of roles.filter((r) => r !== "HORSE_OWNER")) {
    const permissions = defaultPermissions(role);
    assert.equal(
      screenAccess(role, permissions, "/complaints").allowed,
      true,
      role,
    );
    assert.equal(
      screenAccess(role, permissions, "/complaints/report-id").allowed,
      true,
      role,
    );
    assert.equal(
      sidebarNavFor(role, permissions)
        .flatMap((g: any) => g.items)
        .filter((i: any) => i.href === "/complaints").length,
      1,
      role,
    );
  }
});

test("horse owners cannot gain complaint access by enabling every permission", () => {
  const permissions = Object.fromEntries(
    Object.keys(defaultPermissions("HORSE_OWNER")).map((key) => [key, true]),
  );
  assert.equal(
    screenAccess("HORSE_OWNER", permissions, "/complaints").allowed,
    false,
  );
  assert.equal(
    screenAccess("HORSE_OWNER", permissions, "/complaints/report-id").allowed,
    false,
  );
  assert.equal(
    sidebarNavFor("HORSE_OWNER", permissions)
      .flatMap((g: any) => g.items)
      .some((i: any) => i.href === "/complaints"),
    false,
  );
});

test("complaint access does not extend financial report access to staff", () => {
  for (const role of ["GROOM", "HEAD_TRAINER", "VETERINARIAN"]) {
    assert.equal(
      screenAccess(role, defaultPermissions(role), "/financial-reports")
        .allowed,
      false,
      role,
    );
    assert.equal(
      screenAccess(role, defaultPermissions(role), "/costs").allowed,
      false,
      role,
    );
  }
});
