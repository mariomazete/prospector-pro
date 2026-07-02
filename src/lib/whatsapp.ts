import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Returns a wa.me URL when the phone is a mobile number (WhatsApp-capable),
 * otherwise null. Uses libphonenumber-js to detect line type.
 */
export function whatsappLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  try {
    const p = parsePhoneNumberFromString(phone);
    if (!p || !p.isValid()) return null;
    const type = p.getType();
    // Strict: only real mobiles. Undefined/fixed lines are NOT considered WhatsApp.
    if (type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return null;
    return `https://wa.me/${p.number.replace(/\D/g, "")}`;
  } catch {
    return null;
  }
}