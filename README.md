# BillReve

BillReve is a comprehensive SaaS platform for businesses to manage their quotes, invoices, and clients. 
This repository contains both the frontend (React/Vite) and backend (Supabase/Edge Functions) code.

## Architecture

This project is structured as a **Monorepo** with a cloud-native architecture:

- **Frontend (`/client`)**: Built with React, Vite, Tailwind CSS, and Zustand. Hosted on **Vercel**.
- **Backend (`/server`)**: Fully serverless, powered by **Supabase**.
  - PostgreSQL Database
  - Supabase Auth
  - Edge Functions (Deno) for webhooks and scheduled jobs (pg_cron)
  - Row Level Security (RLS) for data isolation.

## Project Structure

```
BillReve/
├── client/                 # React Frontend Application
│   ├── src/                # UI Components, Pages, and Global State
│   │   ├── pages/          # Landing Page (/), Dashboard (/dashboard), Auth, etc.
│   │   └── store/          # Zustand global state (with offline persistence)
│   ├── public/             # Static Assets
│   └── package.json        # Frontend Dependencies
└── server/                 # Supabase Backend Configuration
    ├── supabase/
    │   ├── functions/      # Deno Edge Functions (e.g., email-worker, saas-webhook)
    │   └── migrations/     # PostgreSQL Database Migrations
    └── package.json        # Backend Utilities (if any)
```

## Setup & Local Development

### 1. Frontend Setup
```bash
cd client
npm install
npm run dev
```

### 2. Backend Setup
Ensure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed.

```bash
cd server
supabase start       # Start local Supabase instance
supabase status      # View local API URLs and keys
```

## Deployment

- **Frontend**: Connect the GitHub repository to **Vercel**, setting the Root Directory to `client`.
- **Backend**: Use the Supabase CLI to deploy migrations and edge functions to your cloud project.

```bash
cd server
supabase link --project-ref your-project-id
supabase db push
supabase functions deploy
```
