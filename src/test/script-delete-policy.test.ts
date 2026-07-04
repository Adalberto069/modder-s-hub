import { describe, it, expect } from "vitest";

/**
 * Replica em TS a lógica da policy de DELETE em public.scripts:
 *
 *   is_admin(uid)
 *   OR (uid = modder_id AND is_modder(uid) AND NOT script_has_purchases(id))
 *
 * E também o guard do client (handleDelete no Dashboard) que bloqueia
 * quando o script já possui compras registradas.
 */

type Ctx = {
  uid: string;
  isAdmin: boolean;
  isModder: boolean;
  script: { id: string; modder_id: string; hasPurchases: boolean };
};

function canDelete(ctx: Ctx): boolean {
  if (ctx.isAdmin) return true;
  return (
    ctx.uid === ctx.script.modder_id &&
    ctx.isModder &&
    !ctx.script.hasPurchases
  );
}

const scriptA = { id: "s1", modder_id: "modder-1", hasPurchases: false };
const scriptSold = { id: "s2", modder_id: "modder-1", hasPurchases: true };

describe("scripts DELETE policy", () => {
  it("modder pode excluir o próprio script sem vendas", () => {
    expect(
      canDelete({ uid: "modder-1", isAdmin: false, isModder: true, script: scriptA }),
    ).toBe(true);
  });

  it("modder NÃO pode excluir o próprio script com vendas", () => {
    expect(
      canDelete({ uid: "modder-1", isAdmin: false, isModder: true, script: scriptSold }),
    ).toBe(false);
  });

  it("modder NÃO pode excluir script de outro modder", () => {
    expect(
      canDelete({ uid: "modder-2", isAdmin: false, isModder: true, script: scriptA }),
    ).toBe(false);
  });

  it("usuário comum (não-modder) NÃO pode excluir mesmo sendo dono", () => {
    expect(
      canDelete({ uid: "modder-1", isAdmin: false, isModder: false, script: scriptA }),
    ).toBe(false);
  });

  it("admin pode excluir qualquer script (sem vendas)", () => {
    expect(
      canDelete({ uid: "admin-1", isAdmin: true, isModder: false, script: scriptA }),
    ).toBe(true);
  });

  it("admin pode excluir qualquer script (mesmo com vendas)", () => {
    expect(
      canDelete({ uid: "admin-1", isAdmin: true, isModder: false, script: scriptSold }),
    ).toBe(true);
  });

  it("anônimo (uid vazio) não pode excluir", () => {
    expect(
      canDelete({ uid: "", isAdmin: false, isModder: false, script: scriptA }),
    ).toBe(false);
  });
});
