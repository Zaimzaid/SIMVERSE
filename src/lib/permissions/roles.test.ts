import { describe, expect, it } from "vitest";
import {
  can,
  isWorkspaceRole,
  permissionsForRole,
  PERMISSIONS,
} from "@/lib/permissions";

describe("permissions matrix", () => {
  it("OWNER has every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can("OWNER", permission)).toBe(true);
    }
    expect(permissionsForRole("OWNER")).toHaveLength(PERMISSIONS.length);
  });

  it("VIEWER is read-only", () => {
    expect(can("VIEWER", "workspace.view")).toBe(true);
    expect(can("VIEWER", "project.view")).toBe(true);
    expect(can("VIEWER", "workspace.edit")).toBe(false);
    expect(can("VIEWER", "workspace.members.manage")).toBe(false);
    expect(can("VIEWER", "simulation.create")).toBe(false);
    expect(can("VIEWER", "team.manage")).toBe(false);
  });

  it("ADMIN manages members but cannot delete the workspace", () => {
    expect(can("ADMIN", "workspace.members.manage")).toBe(true);
    expect(can("ADMIN", "team.manage")).toBe(true);
    expect(can("ADMIN", "workspace.delete")).toBe(false);
  });

  it("CREATOR can create/run simulations but not manage the team", () => {
    expect(can("CREATOR", "simulation.create")).toBe(true);
    expect(can("CREATOR", "simulation.run")).toBe(true);
    expect(can("CREATOR", "team.manage")).toBe(false);
    expect(can("CREATOR", "workspace.edit")).toBe(false);
  });

  it("ANALYST can view analytics but not edit content", () => {
    expect(can("ANALYST", "analytics.view")).toBe(true);
    expect(can("ANALYST", "content.edit")).toBe(false);
  });

  it("isWorkspaceRole guards arbitrary strings", () => {
    expect(isWorkspaceRole("OWNER")).toBe(true);
    expect(isWorkspaceRole("VIEWER")).toBe(true);
    expect(isWorkspaceRole("SUPERADMIN")).toBe(false);
    expect(isWorkspaceRole("")).toBe(false);
  });
});
