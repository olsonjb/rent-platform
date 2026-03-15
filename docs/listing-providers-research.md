# Listing Provider API Research

Last updated: 2026-03-15

## Zillow Rental Manager

### Overview
Zillow Rental Manager is Zillow's platform for landlords to list rental properties. Listings syndicate to Zillow, Trulia, and HotPads.

### API Access
- **No public REST API** for posting rental listings.
- Zillow's public API (ZPID lookups, Zestimates) does not support creating or managing rental listings.
- The Zillow Rental Manager web interface and mobile app are the only supported channels for individual landlords.

### Bulk/Partner Access
- **Zillow Feeds Program**: Property management companies and listing aggregators can submit listings via XML/JSON feed files uploaded to a Zillow-provided SFTP endpoint.
- **Requirements**: Minimum portfolio size (typically 50+ units), signed data-sharing agreement, and Zillow partner onboarding.
- **Feed format**: Zillow's proprietary XML schema. Includes property details, photos, pricing, availability, and contact info.
- **Turnaround**: Feed processing is asynchronous. Listings appear within 24-48 hours after feed acceptance.

### Integration Path
1. Apply for the Zillow Feeds Program via the Zillow Group partner portal.
2. Sign data-sharing and terms-of-use agreements.
3. Implement feed file generation in the required XML schema.
4. Configure SFTP upload on a daily/hourly schedule.
5. Monitor feed status via Zillow's partner dashboard.

### Timeline Estimate
- Partner application and approval: 2-4 weeks
- Feed implementation and testing: 1-2 weeks
- Total: 3-6 weeks

### Current Implementation
Mock provider (`lib/providers/zillow.ts`) simulates API latency and random success/failure. No real integration.

---

## Apartments.com (CoStar Group)

### Overview
Apartments.com is owned by CoStar Group. It is one of the largest rental listing platforms in the US, along with ForRent.com and ApartmentFinder.com.

### API Access
- **No public API** for individual landlord listing creation.
- Apartments.com offers a self-service web portal for landlords (free for properties with fewer than a certain number of units).
- Paid listing tiers provide enhanced visibility (featured listings, premium placement).

### Bulk/Partner Access
- **CoStar Data Integration**: Property management software companies can integrate via CoStar's data exchange program.
- **Requirements**: Must be an approved property management software vendor. Requires a business agreement with CoStar Group.
- **Protocols**: Typically REST API or SFTP feed, with CoStar-specific schemas.
- **MLS Integration**: Some markets support MLS-based syndication, but this is primarily for for-sale properties.

### Integration Path
1. Contact CoStar Group's partnership team.
2. Execute a vendor integration agreement.
3. Implement the CoStar data exchange format (property details, availability, pricing, media).
4. Test in CoStar's staging environment.
5. Launch with monitoring and reconciliation.

### Timeline Estimate
- Partnership application and legal: 4-8 weeks
- API implementation and testing: 2-3 weeks
- Total: 6-11 weeks

### Current Implementation
Mock provider (`lib/providers/apartments.ts`) simulates API latency and random success/failure. No real integration.

---

## Currently Implemented Providers

### Craigslist (Email Gateway)
- **Status**: Implemented (`lib/providers/craigslist.ts`)
- **Method**: Composes a formatted listing email and sends via SMTP (nodemailer)
- **Limitations**: Craigslist email posting is market-dependent and may require manual confirmation. No programmatic confirmation of listing acceptance.
- **Markets**: Many US metro areas support email-based posting. Availability varies and Craigslist may change or disable this at any time.

### Generic Webhook
- **Status**: Implemented (`lib/providers/webhook.ts`)
- **Method**: POSTs listing JSON to a configurable URL with HMAC-SHA256 signature
- **Use Cases**: Zapier, Make (Integromat), custom integrations, property management systems
- **Retry**: One retry with 1-second backoff on failure

---

## Recommendations

### Short Term (Now)
- Use the **Craigslist email gateway** for direct external posting.
- Use the **webhook provider** for integration with automation platforms (Zapier, Make) that can forward to any listing site.

### Medium Term (1-3 months)
- Apply for the **Zillow Feeds Program** once portfolio reaches minimum requirements.
- Explore **Rentler** API (Utah-focused, may have easier onboarding).

### Long Term (3-6 months)
- Pursue **CoStar/Apartments.com** partnership once PMC client base justifies it.
- Evaluate **Realtor.com** (Move/News Corp) rental API as additional syndication channel.
- Consider **MLS integration** via RETS/RESO Web API for broader syndication.
