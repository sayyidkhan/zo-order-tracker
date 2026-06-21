# Tech Stack

This document describes the current implementation. Future ideas are listed separately and should not be presented as shipped behavior.

## Current Stack

| Layer | Current Choice | Notes |
| --- | --- | --- |
| Frontend | Vite + React + TypeScript | Single-page app under `frontend/`. |
| Routing | Lightweight pathname router | Implemented in frontend helpers, not TanStack Router yet. |
| Server state | TanStack Query | Queries/mutations for shop config, orders, inventory, profile, menu, and workflow APIs. |
| Icons | lucide-react | Shared visual language for buttons and status UI. |
| Styling | Plain CSS split by feature | `frontend/src/styles.css` imports feature CSS files. |
| Backend | Express | API server under `backend/src/server.js`. |
| Validation | Zod | Request validation and shop config validation. |
| Persistence | Node `node:sqlite` | Products, orders, order items, and shop config. |
| File-backed data | JSON files | Users and workflow JSON files. |
| Workflow engine | Deterministic JSON decision tree | No runtime LLM dependency for normal order handling. |
| Optional AI | OpenAI workflow drafting | Enabled only with `WORKFLOW_BUILDER_MODE=openai` and `OPENAI_API_KEY`. |
| Deployment | `deploy-server.js` + Zo service | Serves built frontend and proxies API routes to backend. |

## Repo Structure

```text
frontend/
  src/
    App.tsx
    components/
    features/
      admin/
      public/
      user/
    lib/
    styles/
    types.ts

backend/
  src/
    server.js
    data-store.js
    customer-order.js
    workflow-runner.js
    workflow-builder.js
    shop-config.js
    user-store.js
    user-profile.js
  workflows/
  scripts/
  data/

deployment/
  deploy.sh
  service-entrypoint.sh
  health-check.sh
  restart-service.sh
```

## Runtime Architecture

```text
Browser
  -> frontend Vite React bundle
  -> same-origin deploy server or local Vite proxy
  -> Express backend
  -> SQLite database
  -> JSON workflow files and user data
```

Local development:

- backend runs on `PORT=4000`
- frontend runs through Vite, usually `http://127.0.0.1:5173`
- frontend uses same-origin API paths by default; Vite proxies those paths to the local backend

Production deployment:

- `deployment/service-entrypoint.sh` installs dependencies and builds the frontend when needed
- `deploy-server.js` serves `frontend/dist`
- API paths are proxied to the backend child process
- `ZORDER_BACKEND_PORT` controls the internal backend port

## Main API Groups

| Group | Purpose |
| --- | --- |
| `/auth/*` | Login, signup, profile, PIN changes. |
| `/config/shop` | Storefront branding and payment settings. |
| `/menu*` | Public preview and customer menu. |
| `/orders*` | Structured checkout, order list, raw workflow processing, completion. |
| `/inventory*` | Product catalog and analytics data. |
| `/workflows*` | Schema, load, run, generate, publish. |
| `/agent*` | Agent-style wrappers for workflow testing/setup. |

## Data Storage

SQLite database:

- `products`
- `orders`
- `order_items`
- `shop_config`

JSON files:

- `backend/data/users.json`
- `backend/workflows/*.json`

Ignored local data:

- `backend/data/*.sqlite`
- `backend/data/*.json`

## Environment Variables

Repo-root `.env`:

```env
NODE_ENV=development
ZORDER_BACKEND_PORT=4000
DATABASE_URL=file:./data/zorder.sqlite
ZORDER_USER_USERNAME=user
ZORDER_USER_PIN=123456
ZORDER_USER_EMAIL=user@example.com
ZORDER_ADMIN_USERNAME=admin
ZORDER_ADMIN_PIN=654321
WORKFLOW_BUILDER_MODE=local
# OPENAI_API_KEY=
```

Deployment:

```env
ZORDER_BACKEND_PORT=4000
```

## Deliberate Current Constraints

- Auth is simple username + 6-digit PIN for MVP/demo use.
- Customer checkout uses uploaded proof, not payment gateway verification.
- Messaging-channel ingestion is not part of the current MVP. It is a future enhancement for users who still prefer to send or receive orders through chat.
- TanStack Router is installed but not the active router.
- Tailwind/shadcn are not used in the shipped frontend.
- Hono exists in the root Zo wrapper path, but the app API is Express.

## Future Technical Options

Only revisit these after the current workflow is stable:

- migrate routing to TanStack Router
- add production auth and merchant accounts
- move from local SQLite to hosted Postgres for multi-tenant scale
- add exports and reporting jobs
- add chat/message-channel ingestion that reuses the same workflow runner after the order tracker and payment-proof flow are stable
