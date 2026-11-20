// Display only: money stays an integer string, including above JS safe integer.
export function formatMinorAmount(minor: string, currency: string) {
  const format = new Intl.NumberFormat("tr-TR", { style: "currency", currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 0;
  const amount = BigInt(minor);
  const absolute = amount < 0n ? -amount : amount;
  const divisor = 10n ** BigInt(digits);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(digits, "0");
  const signed = amount < 0n ? (whole === 0n ? -0 : -whole) : whole;
  return format
    .formatToParts(signed)
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}
