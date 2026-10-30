import parsePhoneNumber from "libphonenumber-js/max";

export function normalizePhone(input: string): string | undefined {
  const phone = parsePhoneNumber(input.trim(), { defaultCountry: "TR", extract: false });
  return phone?.isValid() && !phone.ext ? phone.number : undefined;
}
