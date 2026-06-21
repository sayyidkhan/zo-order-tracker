# zorder

A simple web-based order and payment tracker for home businesses.

## Docs

- Canonical spec: [`docs/SPEC.md`](docs/SPEC.md)
- Docs index: [`docs/README.md`](docs/README.md)
- Current stack: [`docs/tech-stack.md`](docs/tech-stack.md)
- Deployment notes: [`docs/ZO_INFRA.md`](docs/ZO_INFRA.md)

## App Structure

- `frontend/` - Vite React web app.
- `backend/` - Express API and deterministic JSON workflow runner.
- `/intro` - product overview: business problem, solution, and how it works.
- `/user` - customer ordering UI (menu, checkout, my orders).
- `/admin` - admin UI for orders, order rules, inventory, and branding.
- `/tech-stack` - public architecture and stack notes.

## Deployment Structure

This repo is set up for one-folder Zo deployment:

- `frontend/` and `backend/` remain in this repository.
- `deploy-server.js` at the repo root serves `frontend/dist` and proxies backend APIs.
- The live URL is https://zo-order-tracker-shab.zocomputer.io.
- Backend APIs are same-origin paths, not a separate public URL.

## Prerequisites

- Node.js 22.5+ for the backend SQLite runtime. Node 25 is tested locally.
- npm or pnpm.

## Setup

Create the repo-level env file:

```bash
cp .env.example .env
npm run setup:env
```

Backend:

```bash
cd backend
npm install --no-package-lock
npm run seed:users
npm run seed:demo
npm run dev
```

Frontend:

```bash
cd frontend
npm install --no-package-lock
npm run dev
```

Local URLs:

- Intro: `http://127.0.0.1:5173/intro`
- User app: `http://127.0.0.1:5173/user`
- Admin app: `http://127.0.0.1:5173/admin`
- Tech stack: `http://127.0.0.1:5173/tech-stack`
- API health: `http://localhost:4000/health`

## Demo Auth

The MVP uses simple username + 6-digit PIN auth.

Admin and the default demo user are configured in the repo-root `.env`:

```env
ZORDER_USER_USERNAME=user
ZORDER_USER_PIN=123456
ZORDER_USER_EMAIL=user@example.com
ZORDER_ADMIN_USERNAME=admin
ZORDER_ADMIN_PIN=654321
```

Use:

- `user` / `123456` for `/user`
- `admin` / `654321` for `/admin`

Regular users can also self-sign up from `/login`. Signup creates role `user` only and stores the local demo account in:

```text
backend/data/users.json
```

Business/admin access is not self-service. Add that manually through backend config or a future database migration.

This is only a lightweight demo guard, not production auth.

To create or update `.env` without editing the file manually:

```bash
npm run setup:env
```

You can also pass values directly:

```bash
npm run setup:env -- --user-username=user --user-pin=123456 --admin-username=admin --admin-pin=654321
```

To seed custom demo users:

```bash
cd backend
npm run seed:users -- --user-username=user --user-pin=123456 --admin-username=admin --admin-pin=654321
```

To generate random local PINs:

```bash
cd backend
npm run seed:users -- --random
```

## Demo Data And Inventory

Orders and inventory products are stored in local SQLite:

```text
backend/data/zorder.sqlite
```

Seed the demo with egg tarts, bandung, lemonade, and sample orders:

```bash
cd backend
npm run seed:demo
```

Admin users can add, edit, remove, or bulk upload inventory from `/admin?tab=inventory`.

CSV upload format:

```csv
name,category,unit_price,is_active
egg tarts,pastry,2,true
bandung,sweet drink,3,true
lemonade,sweet drink,3,true
```

JSON upload format:

```json
{
  "products": [
    { "name": "egg tarts", "category": "pastry", "unit_price": 2, "is_active": true },
    { "name": "bandung", "category": "sweet drink", "unit_price": 3, "is_active": true },
    { "name": "lemonade", "category": "sweet drink", "unit_price": 3, "is_active": true }
  ]
}
```

## Optional AI Setup

Runtime order tracking is deterministic and does not require an AI key.

AI is only used to generate starter workflow JSON in the admin setup flow. To enable it, set these in `.env`:

```env
WORKFLOW_BUILDER_MODE=openai
OPENAI_API_KEY=your_api_key_here
```

The code has defaults for the Responses endpoint and model. Override them only when needed:

```env
# OPENAI_RESPONSES_URL=https://api.openai.com/v1/responses
# GPT_MODEL=gpt-5.5
```

## Zo Deployment

The live Zo app is a managed long-running service.

Environment loading is centralized:

- Zo/system environment variables win.
- Repo-root `.env` is the canonical file.
- `backend/.env` is still read as a legacy fallback.
- The frontend uses same-origin API paths by default, so production does not need `frontend/.env`.

That means `git pull` by itself is not a deployment step. Pulling updates the files in the repo, but the public site can still serve the old frontend build and old server process until the service is rebuilt and restarted.

Use this command when you want new code to go live on Zo:

```bash
npm run deploy:zo
```

What it does:

1. checks that the repo is clean
2. fetches and fast-forwards the current branch
3. installs dependencies
4. rebuilds the frontend bundle
5. restarts the running Zo service
6. waits for the live health check to pass

Useful variants:

```bash
npm run deploy:zo -- --skip-pull
npm run deploy:zo -- --skip-pull --allow-dirty
npm run restart:service
npm run health:service
```

When to use them:

- `npm run deploy:zo` deploys the latest committed code from the remote branch
- `npm run deploy:zo -- --skip-pull` deploys the code already checked out locally
- `npm run deploy:zo -- --skip-pull --allow-dirty` deploys local uncommitted changes for testing
- `npm run restart:service` only restarts the live service
- `npm run health:service` only checks the public health endpoint

Deployment scripts live in `deployment/`.
Deployment skill for future AI sessions: `Skills/zo-order-tracker-deploy/SKILL.md`.
The production service startup path is `deployment/service-entrypoint.sh`, which reuses the existing build when the current commit is already built and rebuilds automatically when it is not.

Recommended Zo workflow:

```bash
git pull
npm run deploy:zo
```

Or just run:

```bash
npm run deploy:zo
```

if you want one command to both pull and deploy.

## Useful Commands

Run backend tests:

```bash
cd backend
npm test
```

Build frontend:

```bash
cd frontend
npm run build
```

Stop local dev ports:

```bash
for port in 4000 5173; do
  lsof -ti tcp:$port | xargs kill -9 2>/dev/null || true
done
```
