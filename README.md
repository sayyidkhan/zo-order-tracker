# zorder

A simple web-based order and payment tracker for home businesses.

## App Structure

- `frontend/` - Vite React web app.
- `backend/` - Express API and deterministic JSON workflow runner.
- `/intro` - product overview: business problem, solution, and how it works.
- `/user` - customer ordering UI (menu, checkout, my orders).
- `/admin` - admin UI for orders, order rules, inventory, and branding.
- `/tech-stack` - public architecture and stack notes.

## Prerequisites

- Node.js 22.5+ for the backend SQLite runtime. Node 25 is tested locally.
- npm or pnpm.

## Setup

Backend:

```bash
cd backend
npm run setup:env
npm install --no-package-lock
npm run seed:users
npm run seed:demo
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.example .env
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

Admin and the default demo user are configured in `backend/.env`:

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

To create or update `backend/.env` without editing the file manually:

```bash
cd backend
npm run setup:env
```

You can also pass values directly:

```bash
cd backend
npm run setup:env -- --user-username=user --user-pin=123456 --admin-username=admin --admin-pin=654321 --gpt-api-key=your_api_key_here
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

AI is only used to generate starter workflow JSON in the admin setup flow. To enable it, set one of these in `backend/.env`:

```env
GPT-API-KEY=your_api_key_here
# or
OPENAI_API_KEY=your_api_key_here
```

The default model is:

```env
GPT_MODEL=gpt-5.5
```

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
