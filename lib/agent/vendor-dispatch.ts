import { createServiceClient } from "@/lib/supabase/service";
import { sendSms, toE164 } from "@/lib/twilio/sms";
import { createLogger } from "@/lib/logger";
import type { VendorOutreachMethod } from "@/lib/types";

const logger = createLogger("vendor-dispatch");

const MAX_VENDORS_PER_REQUEST = 3;

export interface VendorContact {
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  user_ratings_total: number | null;
}

export interface DispatchContext {
  maintenanceRequestId: string;
  issue: string;
  propertyAddress: string;
  propertyName: string;
  unit: string;
  trade: string;
  estimatedCostMin: number;
  estimatedCostMax: number;
  vendors: VendorContact[];
}

/**
 * Build a concise outreach message for a vendor (SMS-friendly, < 320 chars).
 * Kept short since SMS segments are 160 chars each.
 */
export function buildOutreachMessage(ctx: DispatchContext, vendorName: string): string {
  const lines = [
    `Hi ${vendorName}, we have a ${ctx.trade} job at ${ctx.propertyAddress} (Unit ${ctx.unit}).`,
    `Issue: ${ctx.issue}`,
    `Est. range: $${ctx.estimatedCostMin}-$${ctx.estimatedCostMax}.`,
    `Please reply with your quote, availability, and any notes.`,
  ];
  return lines.join("\n");
}

/**
 * Dispatch vendor outreach for a maintenance request.
 * Contacts up to 3 vendors via SMS and records each outreach in the database.
 */
export async function dispatchVendors(ctx: DispatchContext): Promise<number> {
  const supabase = createServiceClient();
  const vendorsToContact = ctx.vendors
    .filter((v) => v.phone)
    .slice(0, MAX_VENDORS_PER_REQUEST);

  if (vendorsToContact.length === 0) {
    logger.warn(
      { maintenanceRequestId: ctx.maintenanceRequestId },
      "No vendors with phone numbers to contact",
    );
    return 0;
  }

  let contactedCount = 0;

  for (const vendor of vendorsToContact) {
    const phone = toE164(vendor.phone!);
    const message = buildOutreachMessage(ctx, vendor.name);
    const outreachMethod: VendorOutreachMethod = "sms";

    try {
      await sendSms(phone, message);

      const { error } = await supabase.from("vendor_outreach").insert({
        maintenance_request_id: ctx.maintenanceRequestId,
        vendor_name: vendor.name,
        vendor_phone: phone,
        vendor_email: null,
        outreach_method: outreachMethod,
        message_sent: message,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

      if (error) {
        logger.error(
          { err: error, vendor: vendor.name, maintenanceRequestId: ctx.maintenanceRequestId },
          "Failed to save vendor outreach record",
        );
      } else {
        contactedCount += 1;
      }

      logger.info(
        { vendor: vendor.name, phone, maintenanceRequestId: ctx.maintenanceRequestId },
        "Vendor contacted via SMS",
      );
    } catch (err) {
      logger.error(
        { err, vendor: vendor.name, maintenanceRequestId: ctx.maintenanceRequestId },
        "Failed to send SMS to vendor",
      );
    }
  }

  return contactedCount;
}
