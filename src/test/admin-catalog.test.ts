import { describe, expect, it } from "vitest";
import { parseCatalogPrice, categorySlug } from "@/lib/admin-catalog";

describe("catalog input validation", () => {
  it("accepts a Brazilian decimal price", () => expect(parseCatalogPrice("12,50")).toBe(12.5));
  it("accepts a zero price", () => expect(parseCatalogPrice("0")).toBe(0));
  it("rejects negative prices", () => expect(parseCatalogPrice("-1")).toBeNull());
  it("rejects empty prices", () => expect(parseCatalogPrice("")).toBeNull());
  it("rejects nonfinite prices", () => expect(parseCatalogPrice("Infinity")).toBeNull());
  it("rejects fractional cents", () => expect(parseCatalogPrice("1.001")).toBeNull());
  it("normalizes accented category identifiers", () => expect(categorySlug("Ação e RPG")).toBe("acao-e-rpg"));
});