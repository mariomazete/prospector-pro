import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Returns a desktop-app WhatsApp protocol URL only when the phone is classified
 * as a real mobile number. The `/max` metadata build is required because the
 * default libphonenumber-js metadata often cannot detect line type for
 * countries like Portugal (`+351 928...` must be MOBILE, `+351 291...` must be
 * FIXED_LINE).
 */
export function whatsappLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  try {
    const p = parsePhoneNumberFromString(phone);
    if (!p || !p.isValid()) return null;
    const type = p.getType();
    // Strict: only confirmed mobiles get the green WhatsApp state.
    if (type !== "MOBILE") return null;
    return `whatsapp://send?phone=${p.number.replace(/\D/g, "")}`;
  } catch {
    return null;
  }
}