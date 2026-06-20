# zorder Tech Stack

## Goal

Build a fast hackathon MVP for home businesses:

- Enter or import order details in a web app.
- Classify orders and payment status with deterministic JSON workflows.
- Show a simple paid/unpaid dashboard.
- Keep the architecture ready for Telegram automation later.
- Use AI only as optional build-time assistance, not as the default runtime engine.

## Stack Decision

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Vite, React, TypeScript | Fast local dev, simple SPA architecture, no unnecessary SSR framework. |
| Routing | TanStack Router | Type-safe routing and URL state without adopting a heavier full-stack framework. |
| Server State | TanStack Query | Handles fetching, caching, mutations, loading states, and dashboard refreshes cleanly. |
| Styling | Tailwind CSS, shadcn/ui, lucide-react | Fast dashboard UI with clean components and icons. |
| Backend | Hono on Node.js | Lightweight API server for order entry, workflow execution, dashboard APIs, and future Telegram webhook. |
| Data | SQLite + Drizzle ORM for MVP | Simple local persistence, no external database setup during hackathon. |
| Future Data | Postgres | Move here only after the MVP needs multi-user persistence or production hosting. |
| Validation | Zod | Validate order input and workflow JSON before runtime execution. |
| Workflow Engine | Deterministic JSON decision tree | Cheap, predictable, debuggable, and suitable for budget-conscious users. |
| AI Assistance | Optional build-time workflow generator | Helps users create workflows faster, but users can also configure the JSON manually. |
| Telegram | Future Telegram Bot API webhook | Telegram is not required for the MVP; automation is a later integration path. |
| Hosting | Zo Computer / Zo environment first | Use Zo as the live demo host, data home, and build-time agent environment for the challenge. |
| Fallback Hosting | Any Node-compatible host | Useful only if Zo deployment blocks the demo. |

## MVP Architecture

```text
Vite React web app
        |
        v
TanStack Router pages
        |
        v
TanStack Query mutations/queries
        |
        v
Hono API: /orders/process
        |
        v
Deterministic parser + workflow engine
        |
        v
SQLite database
        |
        v
Paid / unpaid dashboard
```

## Future Telegram Automation Path

The MVP should not depend on Telegram. Start with the web app because it is demoable, controllable, and avoids bot setup friction.

Premium automation path:

```text
Telegram bot
        |
        v
Webhook endpoint: /api/telegram/webhook
        |
        v
Normalize Telegram message
        |
        v
JSON decision tree workflow engine
        |
        v
Order dashboard
```

Important Telegram constraint:

- A Telegram bot should not be assumed to read historical private chats.
- For automation, the seller must either receive orders through the bot, forward messages to the bot, or add the bot into a Telegram group/channel with the right privacy settings.
- Telegram supports two update delivery modes: polling with `getUpdates` or webhooks. We should use webhooks for the premium version.

References:

- TanStack Router: https://tanstack.com/router/latest
- TanStack Query: https://tanstack.com/query/latest
- Hono: https://hono.dev/
- Zo Computer: https://zo.computer/
- Zo plans and hosted services: https://zocomputer.mintlify.app/billing
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Bots FAQ: https://core.telegram.org/bots/faq

## Framework Decision

Use TanStack Router and TanStack Query with Vite instead of Next.js.

Do not start with TanStack Start unless we specifically need server rendering, server functions, or a single full-stack framework later. The MVP is a dashboard-style web app with API calls, so a client-first Vite app plus Hono API is simpler.

Recommended app split:

```text
apps/web
- Vite
- React
- TanStack Router
- TanStack Query
- Tailwind CSS

apps/api
- Hono
- Drizzle
- SQLite
- JSON workflow runner
```

## Zo Advantage For Challenge

Do not treat Zo as just a deployment target. The challenge rewards builds that meaningfully use Zo, so the demo should show why Zo is part of the product architecture.

Use Zo in four concrete ways:

1. Live app hosting

Host the web app and API from the Zo environment. The submission should include a live link served from Zo, not only a local demo.

2. Owner-controlled data home

Store the SQLite database and workflow JSON inside the Zo environment. This matches the product story: a small business owner gets a lightweight order system that lives in their own personal cloud instead of another heavy SaaS.

3. Build-time AI assistance

Use Zo's agent/skills during setup to help generate starter workflow JSON, seed sample order data, draft test cases, and prepare the submission demo. This keeps AI aligned with the product direction: useful during building, deterministic during daily operations.

4. Future automation path

Use Zo as the always-on place where future integrations can run: Telegram webhook, scheduled cleanup tasks, exports, backups, and owner notifications.

Demo narrative:

```text
zorder is built and hosted on Zo.
The business owner's order data and workflow rules live in their Zo environment.
AI helps create the workflow during setup.
Daily order tracking runs through cheap deterministic JSON rules.
```

This is stronger than saying "we hosted on Zo" because it connects Zo's core value to the product value: personal cloud ownership, simple hosted services, and agent-assisted building.

## Runtime Workflow Model

Daily user workflows should be deterministic. The runtime should behave like an if-else decision tree, not an AI agent.

Why:

- Target users are budget-conscious.
- Day-to-day order capture should be predictable.
- Each workflow step should be easy to debug.
- The system should avoid paying for LLM calls on every order event.
- Business owners should be able to understand and edit their own workflow.

Workflow source of truth:

- Store each workflow as JSON.
- Load the JSON at runtime.
- Match order input against conditions.
- Execute simple actions such as creating an order, updating payment status, asking a follow-up question, or marking the input as unknown.

Example workflow shape:

```json
{
  "id": "default-order-flow",
  "name": "Default Order Flow",
  "version": 1,
  "start": "detect_order",
  "states": {
    "detect_order": {
      "type": "decision",
      "rules": [
        {
          "if": {
            "containsAny": ["order", "want", "buy", "reserve"]
          },
          "then": "extract_order"
        },
        {
          "if": {
            "containsAny": ["paid", "paynow", "transfer", "sent"]
          },
          "then": "mark_paid"
        }
      ],
      "else": "unknown"
    },
    "extract_order": {
      "type": "action",
      "action": "create_order"
    },
    "mark_paid": {
      "type": "action",
      "action": "update_payment_status",
      "payment_status": "paid"
    },
    "unknown": {
      "type": "action",
      "action": "needs_review"
    }
  }
}
```

## AI Usage

AI should be used only where it creates leverage without increasing daily operating cost.

Allowed AI usage:

- Generate a starter workflow JSON from a seller's business description.
- Suggest rules from sample orders.
- Convert messy sample order notes into initial workflow rules.
- Explain why an order input matched a certain rule during testing.

Avoid AI usage:

- Do not call an LLM for every order event by default.
- Do not make order creation depend on free-form AI reasoning.
- Do not make payment status updates depend on opaque AI decisions.

The product promise is a reliable workflow system, not a generic AI chatbot.

## Core Data Model

Start with these tables/entities:

```text
orders
- id
- customer_name
- customer_handle
- source_channel
- source_input
- order_summary
- payment_status
- total_amount
- currency
- created_at
- updated_at

order_items
- id
- order_id
- item_name
- quantity
- unit_price
- notes

extraction_runs
- id
- raw_input
- extracted_json
- confidence
- created_at

workflows
- id
- name
- version
- workflow_json
- is_active
- created_at
- updated_at

workflow_runs
- id
- workflow_id
- source_input
- matched_state
- matched_rule
- action_taken
- created_at
```

Payment status should stay simple for MVP:

- `unpaid`
- `partial`
- `paid`
- `unknown`

## Extraction Contract

The extractor should return structured JSON, not free-form text. For MVP, prefer deterministic parsing and rule matching. AI can help generate the parser rules during setup, but runtime extraction should use the configured workflow JSON where possible.

Minimum output:

```json
{
  "customer_name": "string | null",
  "customer_handle": "string | null",
  "orders": [
    {
      "order_summary": "string",
      "items": [
        {
          "item_name": "string",
          "quantity": 1,
          "unit_price": 0,
          "notes": "string | null"
        }
      ],
      "payment_status": "paid | unpaid | partial | unknown",
      "total_amount": 0,
      "currency": "SGD",
      "evidence": "short quote or field from source input"
    }
  ]
}
```

## Team Ownership

| Owner | Scope |
| --- | --- |
| Haoming | Deterministic workflow logic, workflow JSON schema, optional AI setup flow. |
| Sayyid | Zo Computer setup, backend APIs, database, Telegram webhook path. |
| Bruce | Order entry/import UI, dashboard UI, paid/unpaid states, visual polish. |
| Aslam | Pitch deck, submission video, demo story. |

## Build Order

1. Create the order entry/import form.
2. Add static dashboard mock data.
3. Define the workflow JSON schema.
4. Implement deterministic workflow execution.
5. Persist extracted orders in SQLite.
6. Connect dashboard to real extracted orders.
7. Add manual payment status update.
8. Add optional AI workflow builder only if the deterministic flow is stable.
9. Prepare Telegram bot webhook only if MVP is stable.

## Deliberate Non-Goals

- No full CRM.
- No inventory management.
- No invoices.
- No multi-channel support.
- No complex auth.
- No payment gateway integration.
- No runtime AI dependency for normal order capture.
- No Telegram bot automation until the web app and workflow engine work end to end.

## Recommended Demo Flow

1. Enter or import a messy order.
2. Click process.
3. Show how the JSON workflow converts order input into customer, items, amount, and payment status.
4. Update one order from unpaid to paid.
5. Show the owner dashboard summary.

This proves the core value without overbuilding infrastructure.
