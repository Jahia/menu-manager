import { describe, expect, it } from "vitest";
import { dependencyFor, depthOf, holdsCurrent, normalize, type MenuItem } from "./menu.js";

const item = (patch: Partial<MenuItem>): MenuItem => ({
  id: "x", kind: "page", label: "x", style: "default", newTab: false, current: false, inTrail: false, children: [], ...patch,
});

describe("dependencyFor", () => {
  it("maps a subtree entry to a regular expression and anything else to a path", () => {
    expect(dependencyFor("/sites/a.b/menus/main/*")).toEqual({
      flushOnPathMatchingRegexp: String.raw`/sites/a\.b/menus/main(/.*)?`,
    });
    expect(dependencyFor("/sites/a/home/offers")).toEqual({ path: "/sites/a/home/offers" });
  });
});

describe("holdsCurrent", () => {
  it("finds the current page at any level", () => {
    expect(holdsCurrent(item({ children: [item({ children: [item({ current: true })] })] }))).toBe(true);
    expect(holdsCurrent(item({ children: [item({})] }))).toBe(false);
  });
});

describe("depthOf", () => {
  it("keeps the levels between 1 and 3", () => {
    expect(depthOf(2)).toBe(2);
    expect(depthOf("7")).toBe(3);
    expect(depthOf(0)).toBe(1);
    expect(depthOf(undefined)).toBe(3);
  });
});

describe("normalize", () => {
  it("gives every item a children list, the third level included", () => {
    const leaf = { id: "x", kind: "page" as const, label: "x", style: "default" as const, newTab: false, current: false, inTrail: false };
    const [top] = normalize([{ ...leaf, children: [{ ...leaf, children: [leaf as MenuItem] }] }]);
    expect(top.children[0].children[0].children).toEqual([]);
    expect(normalize(null)).toEqual([]);
  });
});
