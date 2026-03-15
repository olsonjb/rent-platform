import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all provider modules to avoid SMTP/env side effects
vi.mock('@/lib/providers/zillow', () => ({
  zillowProvider: { name: 'Zillow', submit: vi.fn() },
}));
vi.mock('@/lib/providers/apartments', () => ({
  apartmentsProvider: { name: 'Apartments.com', submit: vi.fn() },
}));
vi.mock('@/lib/providers/craigslist', () => ({
  craigslistProvider: { name: 'Craigslist', submit: vi.fn() },
}));
vi.mock('@/lib/providers/webhook', () => ({
  webhookProvider: { name: 'Webhook', submit: vi.fn() },
}));

import { getActiveProviders } from '@/lib/providers/index';

describe('getActiveProviders', () => {
  beforeEach(() => {
    delete process.env.ACTIVE_LISTING_PROVIDERS;
  });

  it('returns zillow and apartments by default', () => {
    const providers = getActiveProviders();
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(['Zillow', 'Apartments.com']);
  });

  it('returns providers based on env var', () => {
    process.env.ACTIVE_LISTING_PROVIDERS = 'craigslist,webhook';
    const providers = getActiveProviders();
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(['Craigslist', 'Webhook']);
  });

  it('handles single provider', () => {
    process.env.ACTIVE_LISTING_PROVIDERS = 'webhook';
    const providers = getActiveProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('Webhook');
  });

  it('ignores unknown providers with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.ACTIVE_LISTING_PROVIDERS = 'zillow,nonexistent,webhook';

    const providers = getActiveProviders();

    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(['Zillow', 'Webhook']);
    expect(warnSpy).toHaveBeenCalledWith(
      '[listing-providers] Unknown provider: nonexistent',
    );
    warnSpy.mockRestore();
  });

  it('handles whitespace and empty segments', () => {
    process.env.ACTIVE_LISTING_PROVIDERS = ' zillow , apartments , ';
    const providers = getActiveProviders();
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(['Zillow', 'Apartments.com']);
  });

  it('is case-insensitive', () => {
    process.env.ACTIVE_LISTING_PROVIDERS = 'Zillow,WEBHOOK';
    const providers = getActiveProviders();
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.name)).toEqual(['Zillow', 'Webhook']);
  });
});
