import nodemailer from 'nodemailer';
import type { ListingProvider, PropertyListing, SubmitResult } from './types';
import { logProviderSubmission } from './logger';

function getSmtpConfig() {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = parseInt(process.env.EMAIL_SMTP_PORT ?? '587', 10);
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Missing EMAIL_SMTP_HOST, EMAIL_SMTP_USER, or EMAIL_SMTP_PASS');
  }

  return { host, port, auth: { user, pass } };
}

function composeListingEmail(listing: PropertyListing): { subject: string; text: string } {
  const subject = `${listing.title} - $${listing.rent}/mo - ${listing.city}, ${listing.state}`;

  const lines = [
    listing.title,
    '',
    listing.description,
    '',
    `Rent: $${listing.rent}/month`,
    `Bedrooms: ${listing.bedrooms}`,
    `Bathrooms: ${listing.bathrooms}`,
    ...(listing.sqft ? [`Square Feet: ${listing.sqft}`] : []),
    '',
    `Address: ${listing.address}`,
    `${listing.city}, ${listing.state} ${listing.zip}`,
    '',
    'Highlights:',
    ...listing.highlights.map((h) => `  - ${h}`),
  ];

  return { subject, text: lines.join('\n') };
}

export const craigslistProvider: ListingProvider = {
  name: 'Craigslist',
  async submit(listing: PropertyListing): Promise<SubmitResult> {
    const postingEmail = process.env.CRAIGSLIST_POSTING_EMAIL;
    const replyEmail = process.env.CRAIGSLIST_REPLY_EMAIL;

    if (!postingEmail || !replyEmail) {
      const error = 'Missing CRAIGSLIST_POSTING_EMAIL or CRAIGSLIST_REPLY_EMAIL';
      logProviderSubmission({ provider: 'Craigslist', status: 'failed', response_data: { error } });
      return { provider: 'Craigslist', success: false, error };
    }

    const { subject, text } = composeListingEmail(listing);

    try {
      const transport = nodemailer.createTransport(getSmtpConfig());
      const info = await transport.sendMail({
        from: replyEmail,
        to: postingEmail,
        replyTo: replyEmail,
        subject,
        text,
      });

      logProviderSubmission({
        provider: 'Craigslist',
        status: 'success',
        response_data: { messageId: info.messageId },
      });

      return {
        provider: 'Craigslist',
        success: true,
        listingUrl: `mailto:${postingEmail}`,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Email send failed';
      logProviderSubmission({
        provider: 'Craigslist',
        status: 'failed',
        response_data: { error },
      });
      return { provider: 'Craigslist', success: false, error };
    }
  },
};

// Exported for testing
export { composeListingEmail, getSmtpConfig };
