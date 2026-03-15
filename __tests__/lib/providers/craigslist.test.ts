import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyListing } from '@/lib/providers/types';

vi.mock('@/lib/providers/logger', () => ({
  logProviderSubmission: vi.fn(),
}));

const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}));

import { craigslistProvider, composeListingEmail, getSmtpConfig } from '@/lib/providers/craigslist';
import { logProviderSubmission } from '@/lib/providers/logger';

const baseListing: PropertyListing = {
  title: '2BR Apartment Downtown',
  description: 'Beautiful apartment with city views.',
  highlights: ['Pool', 'Gym', 'Parking'],
  rent: 1800,
  bedrooms: 2,
  bathrooms: 1,
  sqft: 950,
  address: '456 Oak Ave',
  city: 'Denver',
  state: 'CO',
  zip: '80202',
};

describe('composeListingEmail', () => {
  it('formats subject with title, rent, city, and state', () => {
    const { subject } = composeListingEmail(baseListing);
    expect(subject).toBe('2BR Apartment Downtown - $1800/mo - Denver, CO');
  });

  it('includes all listing details in body', () => {
    const { text } = composeListingEmail(baseListing);
    expect(text).toContain('Rent: $1800/month');
    expect(text).toContain('Bedrooms: 2');
    expect(text).toContain('Bathrooms: 1');
    expect(text).toContain('Square Feet: 950');
    expect(text).toContain('456 Oak Ave');
    expect(text).toContain('Denver, CO 80202');
  });

  it('includes highlights', () => {
    const { text } = composeListingEmail(baseListing);
    expect(text).toContain('  - Pool');
    expect(text).toContain('  - Gym');
    expect(text).toContain('  - Parking');
  });

  it('omits sqft when null', () => {
    const { text } = composeListingEmail({ ...baseListing, sqft: null });
    expect(text).not.toContain('Square Feet');
  });
});

describe('getSmtpConfig', () => {
  beforeEach(() => {
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_PORT = '465';
    process.env.EMAIL_SMTP_USER = 'user@test.com';
    process.env.EMAIL_SMTP_PASS = 'secret';
  });

  it('returns SMTP config from env vars', () => {
    const config = getSmtpConfig();
    expect(config.host).toBe('smtp.test.com');
    expect(config.port).toBe(465);
    expect(config.auth.user).toBe('user@test.com');
    expect(config.auth.pass).toBe('secret');
  });

  it('defaults port to 587', () => {
    delete process.env.EMAIL_SMTP_PORT;
    const config = getSmtpConfig();
    expect(config.port).toBe(587);
  });

  it('throws when host is missing', () => {
    delete process.env.EMAIL_SMTP_HOST;
    expect(() => getSmtpConfig()).toThrow('Missing EMAIL_SMTP_HOST');
  });
});

describe('craigslistProvider.submit', () => {
  beforeEach(() => {
    mockSendMail.mockReset();
    vi.mocked(logProviderSubmission).mockReset();
    process.env.EMAIL_SMTP_HOST = 'smtp.test.com';
    process.env.EMAIL_SMTP_USER = 'user@test.com';
    process.env.EMAIL_SMTP_PASS = 'secret';
    process.env.CRAIGSLIST_POSTING_EMAIL = 'post@craigslist.org';
    process.env.CRAIGSLIST_REPLY_EMAIL = 'landlord@example.com';
  });

  it('sends email and returns success', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<msg-123>' });

    const result = await craigslistProvider.submit(baseListing);

    expect(result.success).toBe(true);
    expect(result.provider).toBe('Craigslist');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'landlord@example.com',
        to: 'post@craigslist.org',
        replyTo: 'landlord@example.com',
      }),
    );
    expect(logProviderSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'Craigslist', status: 'success' }),
    );
  });

  it('returns failure when env vars are missing', async () => {
    delete process.env.CRAIGSLIST_POSTING_EMAIL;

    const result = await craigslistProvider.submit(baseListing);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing');
    expect(logProviderSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'Craigslist', status: 'failed' }),
    );
  });

  it('returns failure when sendMail throws', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await craigslistProvider.submit(baseListing);

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP connection refused');
    expect(logProviderSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'Craigslist', status: 'failed' }),
    );
  });
});
