# TASK T14: Lease Renewal Agent

You are an autonomous agent working on the `rent-platform` repository. Your task is to build an AI agent that evaluates tenants for renewal, generates personalized offers, and manages the renewal workflow.

## Acceptance Criteria

### 1. Tenant Evaluation Agent (`lib/agent/renewal-agent.ts`)
- Triggers when a lease is 60 days from expiry
- Evaluates tenant based on:
  - Payment history (if billing from T09 exists: on-time rate, late payments)
  - Maintenance request frequency and type (high-frequency habitability = negative signal)
  - Communication responsiveness (response time in chat history)
  - Lease duration (longer tenure = positive signal)
- Claude generates a renewal recommendation: renew (with rent adjustment), renew (same terms), do not renew
- Include suggested rent adjustment with reasoning (market conditions, tenant quality)

### 2. Renewal Offer Generator (`lib/agent/renewal-content.ts`)
- Generate a personalized renewal offer letter using Claude:
  - Friendly tone acknowledging tenancy duration
  - New terms (rent, lease duration)
  - Deadline to respond (configurable, default 14 days)
  - Instructions to accept or decline
- Store offer in `renewal_offers` table: id, lease_id, tenant_id, new_monthly_rent, new_end_date, offer_letter, status (pending/accepted/declined/expired), sent_at, responded_at, expires_at

### 3. Renewal Notification Flow
- Send renewal offer to tenant via SMS and/or email
- If tenant accepts: create new lease record, update old lease status to 'renewed', cancel any pending listing for this property
- If tenant declines or no response by deadline: trigger the existing listing agent to find new tenants
- If landlord chooses "do not renew": skip offer, go straight to listing agent

### 4. Landlord Review Interface
- On landlord dashboard, show "Upcoming Renewals" section
- Each renewal shows: tenant name, current rent, AI recommendation, suggested new rent
- Landlord can: approve AI suggestion, modify terms, or decline renewal
- After landlord decision, the offer is sent (or listing agent is triggered)

### 5. Cron Integration (`app/api/cron/check-renewals/route.ts`)
- Run daily, secured with CRON_SECRET
- Find leases expiring in 45-60 days without existing renewal offers
- Trigger evaluation agent for each
- Present results to landlord (don't auto-send offers)

### 6. Tests
- Test tenant evaluation with various payment/maintenance histories
- Test renewal offer generation
- Test acceptance flow (new lease creation, old lease status update)
- Test decline flow (triggers listing agent)
- Test cron deduplication (don't create duplicate offers)

## Technical Constraints
- Renewal offers require landlord approval before sending to tenant
- If payment history is unavailable (T09 not complete), evaluate on available signals only
- New lease inherits all property and tenant links from the old lease

## Definition of Done
- Leases approaching expiry trigger renewal evaluation
- AI generates personalized renewal offers
- Landlord reviews and approves before tenant is notified
- Acceptance creates new lease, decline triggers listing agent
- Tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE
