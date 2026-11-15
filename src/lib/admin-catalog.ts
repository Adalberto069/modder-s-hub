export function parseCatalogPrice(value: string): number | null {
  if (!value.trim()) return null;
  const price = Number(value.replace(",", "."));
  return Number.isFinite(price) && price >= 0 && Math.abs(Math.round(price * 100) - price * 100) < 0.000001 ? price : null;
}

export function categorySlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}