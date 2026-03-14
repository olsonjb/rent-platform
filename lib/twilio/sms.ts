import twilio from "twilio";

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }
  return twilio(accountSid, authToken);
}

function getTwilioPhone() {
  const phone = process.env.TWILIO_PHONE_NUMBER;
  if (!phone) throw new Error("Missing TWILIO_PHONE_NUMBER");
  return phone;
}

export async function sendSms(to: string, body: string) {
  const client = getClient();
  await client.messages.create({ from: getTwilioPhone(), to, body });
}

/** Normalize any common phone format to E.164 (+1XXXXXXXXXX for US numbers) */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export function buildLandlordSms(opts: {
  propertyName: string;
  unit: string;
  tenantName: string;
  tenantPhone: string | null;
  issue: string;
  urgency: "habitability" | "standard";
}): string {
  const urgencyLine =
    opts.urgency === "habitability"
      ? "URGENT - habitability issue (3-day repair window)"
      : "Standard (10-day repair window)";

  return [
    `New maintenance request - ${opts.propertyName}`,
    `Unit ${opts.unit} - ${opts.tenantName}`,
    `Issue: ${opts.issue}`,
    `Priority: ${urgencyLine}`,
    opts.tenantPhone ? `Tenant contact: ${opts.tenantPhone}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
