# Auto PM

Auto PM is an autonomous property management platform built to reduce manual coordination between renters and landlords.

It combines communication workflows, maintenance operations, and AI-assisted decision support into one product experience.

## Overview

Property management is full of repetitive, high-friction tasks: answering lease questions, routing maintenance issues, collecting details, and finding trusted vendors quickly. Auto PM automates those workflows so both renters and landlords can move from request to resolution faster.

## Core Workflows

### Renter Experience

- Automates landlord-renter communication for common day-to-day requests
- Supports text-message (SMS) conversations for fast renter updates and replies
- Answers questions about lease and contract terms in plain language
- Guides tenants through creating complete maintenance requests

### Landlord Experience

- Reviews and organizes incoming maintenance requests
- Supports SMS-based communication with tenants for quicker coordination
- Provides cost-estimation support for repair planning
- Finds contact information for relevant maintenance vendors

## How It Works

- **Multi-channel access:** supports both in-app workflows and text-message (SMS) interactions
- **Role-aware product flows:** separate renter and landlord experiences with focused dashboards
- **AI-assisted operations:** autonomous helpers support communications, request triage, and maintenance decision-making
- **Structured maintenance lifecycle:** requests move through clear states from intake to completion
- **Property management data model:** built around properties, tenants, leases, conversations, and maintenance events

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Supabase (database, auth, and server-side integrations)
- Tailwind CSS + shadcn/ui for UI primitives
- Anthropic SDK for AI orchestration
- Twilio for communication channels

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Update `.env.local` with your keys and project values.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Vision

Auto PM aims to become the default operating layer for small and mid-size rental portfolios: AI-native, communication-first, and operationally reliable from first tenant message to final maintenance resolution.
