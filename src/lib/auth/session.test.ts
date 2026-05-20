import { describe, expect, it } from "vitest";
import { hasPermission, permissionsForRole } from "./session";

describe("RBAC permissions", () => {
  it("allows admin to manage users and clear demo data", () => {
    expect(permissionsForRole("admin")).toContain("manage_users");
    expect(permissionsForRole("admin")).toContain("clear_demo_data");
  });

  it("allows editor to operate and review jobs without settings access", () => {
    expect(hasPermission({ role: "editor" }, "operate_jobs")).toBe(true);
    expect(hasPermission({ role: "editor" }, "review_jobs")).toBe(true);
    expect(hasPermission({ role: "editor" }, "manage_settings")).toBe(false);
  });

  it("keeps viewer read-only", () => {
    expect(hasPermission({ role: "viewer" }, "read")).toBe(true);
    expect(hasPermission({ role: "viewer" }, "operate_jobs")).toBe(false);
  });
});
