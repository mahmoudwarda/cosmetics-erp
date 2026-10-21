export function formatAmount(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    Number.isFinite(amount) ? amount : 0
  );
}

export function formatAmountInput(value: number) {
  return (Math.round(value * 100) / 100).toString();
}
