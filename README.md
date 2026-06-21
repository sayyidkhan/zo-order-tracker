# zorder

zorder helps a small merchant take paid orders without setting up a full ecommerce store.

Think of it as:

- a simple menu page for customers
- an admin page for the merchant
- a place to collect PayNow or bank-transfer proof
- a lightweight order list so the merchant knows what to prepare

Live demo:

```text
https://zo-order-tracker-shab.zocomputer.io
```

## Who Should Read This

If you are the merchant using an already deployed zorder app, start at **Merchant Setup**.

If you are the person deploying zorder to Zo, start at **One-Push Zo Deployment**.

If you are an AI assistant helping with deployment, use the skill file:

```text
Skills/zo-order-tracker-deploy/SKILL.md
```

That skill file tells future AI sessions how this repo should be deployed and what assumptions must stay true.

## What The Merchant Needs Ready

Before setting up the shop, prepare:

- shop name
- short tagline
- payment instructions
- PayNow number
- PayNow QR image, if available
- bank name, account name, and account number, if accepting bank transfer
- product list with name, category, price, and active/inactive status

Example product list:

| name | category | unit_price | active |
| --- | --- | ---: | --- |
| egg tarts | pastry | 2 | yes |
| bandung | sweet drink | 3 | yes |
| lemonade | sweet drink | 3 | yes |

## Merchant Setup

Use this after the app is already deployed.

1. Open the admin page:

```text
https://zo-order-tracker-shab.zocomputer.io/admin
```

2. Sign in with the admin username and 6-digit PIN.

Demo admin login:

```text
admin / 654321
```

3. Open **Branding**.

Fill in:

- shop name
- shop tagline
- shop description
- payment instructions
- PayNow number
- PayNow QR
- bank details

4. Open **Inventory**.

Add products manually, or upload a CSV/JSON product list.

5. Open the customer page:

```text
https://zo-order-tracker-shab.zocomputer.io/user
```

6. Check that the customer sees the right shop name, menu, prices, and payment instructions.

7. Share the `/user` link with customers.

8. When customers place orders, review them from `/admin`.

Important: zorder stores payment proof for the merchant to review. It does not confirm that the money really arrived in the bank or PayNow account.

## Customer Flow

Customers use zorder like this:

1. Open `/user`.
2. Sign in or sign up.
3. Pick products from the menu.
4. Pay outside the app by PayNow or bank transfer.
5. Upload a screenshot, photo, or PDF of the payment proof.
6. Place the order.
7. Track active and completed orders from the customer page.

Demo customer login:

```text
user / 123456
```

## Merchant Accounts

The MVP uses simple username + 6-digit PIN login.

The default customer and admin accounts are configured in the repo-root `.env` file:

```env
ZORDER_USER_USERNAME=user
ZORDER_USER_PIN=123456
ZORDER_USER_EMAIL=user@example.com
ZORDER_ADMIN_USERNAME=admin
ZORDER_ADMIN_PIN=654321
```

Change these before any public demo.

This login system is intentionally simple for MVP/demo use. It is not production-grade auth.

## Product Upload

The easiest way is to add products from **Admin → Inventory**.

For bulk upload, use CSV:

```csv
name,category,unit_price,is_active
egg tarts,pastry,2,true
bandung,sweet drink,3,true
lemonade,sweet drink,3,true
```

Or JSON:

```json
{
  "products": [
    { "name": "egg tarts", "category": "pastry", "unit_price": 2, "is_active": true },
    { "name": "bandung", "category": "sweet drink", "unit_price": 3, "is_active": true },
    { "name": "lemonade", "category": "sweet drink", "unit_price": 3, "is_active": true }
  ]
}
```

Only active products appear on the customer menu.

## What zorder Does Not Do Yet

zorder does not currently:

- verify PayNow or bank transfers automatically
- process card payments
- send WhatsApp or Telegram messages
- manage delivery routes
- provide production-grade multi-merchant auth

It is currently best for demos, pilots, hackathons, and small owner-operated workflows.

## One-Push Zo Deployment

This section is for the person deploying the app to Zo.

The goal: after the first setup, deployment should be:

```text
push code -> run one deploy command on Zo -> live app updates
```

There is no separate frontend upload. There is no separate backend deployment. Everything lives in this one repo.

## One-Time Zo Setup

Do this once on Zo after cloning the repo.

1. Create the env file:

```bash
cp .env.example .env
npm run setup:env
```

2. Edit `.env` with real merchant login and payment values.

3. Keep these production rules:

- Do not set `PORT` in `.env`; Zo injects it.
- Do not set `VITE_API_BASE_URL` in production; the frontend uses same-origin API paths.
- Do not commit `.env`.
- Use `npm run prod` as the Zo publish/start command.

`zosite.json` is already configured to use:

```bash
npm run prod
```

Environment loading order:

1. Zo/system environment variables
2. repo-root `.env`
3. legacy `backend/.env`

## Normal Deployment

On your local machine:

```bash
git add .
git commit -m "your change"
git push
```

On Zo, from the repo root:

```bash
npm run deploy:zo
```

That one command:

1. checks the Zo repo is clean
2. pulls the latest pushed commit
3. installs backend and frontend dependencies
4. rebuilds the frontend
5. restarts the live service
6. checks `/api/health`

If it passes, the public app is live.

Useful deploy commands:

```bash
npm run deploy:zo
npm run deploy:zo -- --skip-pull
npm run deploy:zo -- --skip-pull --allow-dirty
npm run reset:factory -- --dry-run
npm run reset:factory -- --yes
npm run restart:service
npm run health:service
```

Use `npm run deploy:zo` for normal production deploys.

- `npm run deploy:zo` deploys the latest committed code from the remote branch
- `npm run deploy:zo -- --skip-pull` deploys the code already checked out locally
- `npm run deploy:zo -- --skip-pull --allow-dirty` deploys local uncommitted changes for testing
- `npm run reset:factory -- --dry-run` previews a full app reset without changing data
- `npm run reset:factory -- --yes` wipes app data and restores the seeded demo state
- `npm run restart:service` only restarts the live service
- `npm run health:service` only checks the public health endpoint

More deployment detail:

```text
DEPLOYMENT.md
```

## Factory Reset

To reset the app back to its demo defaults on Zo:

```bash
npm run reset:factory -- --yes
```

Preview the reset first:

```bash
npm run reset:factory -- --dry-run
```

What the factory reset does:

1. creates a backup under `deployment/backups/`
2. clears SQLite orders, inventory, and shop config state
3. removes signed-up users and saved user profiles
4. deletes published custom workflow JSON files
5. reseeds the default demo products, sample orders, and default shop config
6. restarts the Zo service and waits for health, unless `--skip-restart` is passed

What it does not reset:

- repo-root `.env`
- `backend/.env`
- API keys and secrets
- deployment scripts and service configuration
- the built-in default workflow files

Useful variants:

```bash
npm run reset:factory -- --dry-run
npm run reset:factory -- --yes --skip-restart
```

## Local Development

This section is for developers.

Requirements:

- Node.js 22.5+ for the backend SQLite runtime
- npm

Create local env:

```bash
cp .env.example .env
npm run setup:env
```

Install dependencies:

```bash
npm run install:app
```

Run backend:

```bash
cd backend
npm run seed:users
npm run seed:demo
npm run dev
```

Run frontend in another terminal:

```bash
cd frontend
npm run dev
```

Local pages:

- Customer page: `http://127.0.0.1:5173/user`
- Admin page: `http://127.0.0.1:5173/admin`
- Product intro: `http://127.0.0.1:5173/intro`
- Tech stack page: `http://127.0.0.1:5173/tech-stack`
- Backend health: `http://localhost:4000/health`

Local frontend development does not need `frontend/.env`. Vite proxies API paths to the backend on `localhost:4000`.

## Optional AI Setup

Runtime order tracking is deterministic and does not need an AI key.

AI is only used to generate starter workflow JSON in the admin setup flow.

To enable that optional setup helper, set:

```env
WORKFLOW_BUILDER_MODE=openai
OPENAI_API_KEY=your_api_key_here
```

Optional overrides:

```env
# OPENAI_RESPONSES_URL=https://api.openai.com/v1/responses
# GPT_MODEL=gpt-5.5
```

## Files Worth Knowing

- `README.md` - this onboarding guide
- `DEPLOYMENT.md` - detailed deployment guide
- `Skills/zo-order-tracker-deploy/SKILL.md` - AI skill file for one-push deployment help
- `.env.example` - template for merchant and deployment settings
- `frontend/` - customer and admin web app
- `backend/` - API, database, order workflow, shop config
- `deployment/` - deploy, restart, health check, and service startup scripts
- `deploy-server.js` - production web server
- `zosite.json` - Zo publish configuration

Useful docs:

- `docs/SPEC.md`
- `docs/USER_JOURNEY.md`
- `docs/tech-stack.md`
- `docs/ZO_INFRA.md`

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
