// Money is an integer string in minor units. Preserve precision beyond Number.MAX_SAFE_INTEGER.
export function effectMoney(amount: string, currency: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const minor = BigInt(amount),
    unit = 10n ** BigInt(digits),
    whole = minor / unit;
  const fraction = (minor < 0n ? -minor : minor) % unit;
  return formatter
    .formatToParts(minor < 0n && whole === 0n ? -0 : whole)
    .map((part) =>
      part.type === "fraction" ? fraction.toString().padStart(digits, "0") : part.value,
    )
    .join("");
}
