export function formatEUR(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
      }).format(number)
    : "—";
}
export function validImageUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function validMoney(value: number, allowZero = false) {
  return (
    Number.isFinite(value) &&
    value < 100000000 &&
    (allowZero ? value >= 0 : value > 0) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}
export function toLocalDateTime(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}
export function sameIds(a: number[], b: number[]) {
  return (
    JSON.stringify([...a].sort((x, y) => x - y)) ===
    JSON.stringify([...b].sort((x, y) => x - y))
  );
}
export function productPrice(variants: { price: string | number | null }[]) {
  const prices = variants
    .filter((v) => v.price !== null)
    .map((v) => Number(v.price))
    .filter(Number.isFinite);
  if (!prices.length) return "—";
  const min = Math.min(...prices),
    max = Math.max(...prices);
  return min === max ? formatEUR(min) : `${formatEUR(min)} – ${formatEUR(max)}`;
}
