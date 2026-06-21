# zorder Product Spec

zorder is a lightweight storefront and order operations workspace for small businesses that collect payment outside the app.

The current MVP is not a full commerce platform, CRM, or payment gateway. It gives a merchant a branded customer ordering flow, inventory management, payment proof capture, order tracking, fulfillment status, and deterministic workflow tooling.

## Current Positioning

**Tagline:** A simple storefront and paid-order tracker for small businesses.

**Primary user:** a home-based seller or small operator who needs a practical way to publish products, collect paid orders, and track fulfillment.

**Customer promise:** browse a live menu, pay by the seller's instructions, upload proof, place an order, and track active or completed orders.

**Merchant promise:** manage products, branding, payment instructions, orders, fulfillment, and workflow rules from one admin workspace.

## Product Surfaces

| Route | Audience | Purpose |
| --- | --- | --- |
| `/intro` | Public | Product overview and how it works. |
| `/user` | Customers | Branded storefront, signup/sign-in, menu, checkout, order history, profile. |
| `/admin` | Merchant/admin | Orders, order rules, inventory, sales analytics, branding/payment config. |
| `/tech-stack` | Public | Current architecture notes. |
| `/why-zo-computer` | Public | Zo deployment and cost narrative. |

## Problem

Small sellers need a simple way to manage paid orders before they are ready for a full commerce platform.

The current problem statement is:

- orders can be messy and hard to track
- payment tracking is manual because PayNow and bank transfer happen outside zorder

This creates repeated operational work:

- customers ask for status after paying
- payment proof must be reviewed by the merchant
- product availability and order status are hard to keep synchronized
- full storefront, CRM, and POS tools are too heavy for early or small operations

### Enhancement Boundary

Users may still prefer to send or receive orders through chat. That is an enhancement path, not the current core product. Future WhatsApp, Instagram, Telegram, or marketplace ingestion should feed the same order tracker and payment-proof workflow.

## Goals

- Let a merchant publish active products and payment instructions quickly.
- Let a customer place a paid order without a marketplace or payment gateway account.
- Require payment proof before structured customer checkout can create an order.
- Keep customer order history scoped to the signed-in username.
- Let the merchant see every order, payment proof, payment status, and fulfillment state.
- Keep daily order logic deterministic and explainable.
- Keep local demo setup simple with SQLite and JSON-backed config.

## Non-Goals

- No payment processing or automatic payment verification.
- No refunds, invoices, accounting, or payout reconciliation.
- No production-grade auth, RBAC, tenant billing, or merchant onboarding.
- No WhatsApp, Instagram, Telegram, or marketplace ingestion in the current MVP. These are future intake channels, not current core scope.
- No runtime LLM dependency for normal order processing.
- No full CRM pipeline, lead management, or sales automation.

## Roles

| Role | Capabilities |
| --- | --- |
| Public visitor | Read overview, view storefront landing, preview public menu snippets. |
| Customer user | Sign up/sign in, edit profile, browse menu, add cart items, upload payment proof, place orders, view own active/completed orders. |
| Admin user | View all orders, complete orders, manage inventory, review sales analytics, configure branding/payment settings, generate/test/publish workflow JSON. |

## Customer Experience

1. Customer opens `/user`.
2. Customer sees the merchant's branded storefront.
3. Customer signs in or creates a user account with username + 6-digit PIN.
4. Customer chooses an order method:
   - browse menu and checkout
   - guided ordering flow inside zorder
5. Customer selects active products from the merchant inventory.
6. Customer reviews cart total and optional notes.
7. Customer pays externally through PayNow or bank transfer using merchant instructions.
8. Customer uploads payment proof image.
9. Customer places the order.
10. Customer sees the order under active orders until the merchant completes it.

## Merchant Experience

1. Admin signs in at `/admin`.
2. Admin manages the product catalog under **Inventory**.
3. Admin configures storefront copy and payment details under **Branding**.
4. Admin views all orders under **Orders**.
5. Admin marks active orders as completed.
6. Admin uses **Inventory -> Analytics** for paid capture summaries and product sales views.
7. Admin uses **Order Rules** to view, generate, test, and publish deterministic workflow JSON.

## Current Feature Set

### Customer Storefront

- Branded landing page from shop config.
- User signup and sign-in.
- Profile fields: first name, last name, email, contact.
- PIN change for self-created user accounts.
- Active product menu grouped by category.
- Cart quantity controls.
- Checkout notes.
- Payment instruction display.
- PayNow QR preview where configured.
- Payment proof image/PDF preview UI, with image upload required for structured checkout.
- Current and completed order history.
- Receipt PDF download.

### Admin Orders

- Order summary metrics:
  - needs review
  - outstanding
  - paid
- All-order table.
- Payment proof display.
- Fulfillment status.
- Complete active order action.
- Receipt PDF download.

### Inventory

- Add product.
- Edit product.
- Delete product.
- Toggle active state.
- Product image upload.
- Bulk product upload by CSV or JSON.
- Paid sales analytics by period.
- Product/unit sales summaries.

### Branding And Payment Config

- Business name.
- Brand mark letter.
- Tagline.
- Storefront description.
- Payment instructions.
- PayNow number.
- PayNow QR upload.
- PayNow QR generation.
- Bank name.
- Bank account name.
- Bank account number.
- Footer note.

### Workflow Tools

- Deterministic JSON workflow runner.
- Workflow generation from seller context.
- Local deterministic generation by default.
- Optional OpenAI drafting when `WORKFLOW_BUILDER_MODE=openai` and `OPENAI_API_KEY` are set.
- Workflow graph preview.
- Workflow traversal/test panel.
- Publish workflow JSON to `backend/workflows`.

## Data Model

### Product

| Field | Notes |
| --- | --- |
| `id` | UUID. |
| `name` | Unique product name. |
| `category` | Menu grouping. |
| `unit_price` | Nullable number. |
| `image_url` | Data URL or URL string. |
| `is_active` | Only active products appear in customer menu. |
| `created_at`, `updated_at` | Timestamps. |

### Order

| Field | Notes |
| --- | --- |
| `id` | UUID. |
| `customer_name` | Name or username. |
| `customer_handle` | Handle such as `@username`. |
| `source_channel` | `customer_app`, `manual`, or another source label. |
| `source_input` | Text used for workflow traceability. |
| `order_summary` | Human-readable summary. |
| `payment_status` | `paid`, `partial`, `unpaid`, or `unknown`. |
| `fulfillment_status` | `active` or `completed`. |
| `total_amount` | Nullable number. |
| `currency` | Defaults to `SGD`. |
| `evidence` | Payment proof data or evidence text. |
| `placed_by_username` | Used to scope customer order history. |
| `created_at` | Timestamp. |

### Order Item

| Field | Notes |
| --- | --- |
| `id` | UUID. |
| `order_id` | Parent order ID. |
| `item_name` | Product name at time of order. |
| `quantity` | Integer. |
| `unit_price` | Nullable number at time of order. |
| `notes` | Category or extra detail. |

### Shop Config

Shop config is stored in SQLite and controls storefront branding and checkout payment copy.

## API Surface

| Method | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | API health. |
| POST | `/auth/login` | Public | Username + PIN login. |
| POST | `/auth/signup` | Public | Customer self-signup. |
| GET | `/auth/profile` | User | Read profile. |
| PUT | `/auth/profile` | User | Save profile. |
| POST | `/auth/change-password` | User | Change PIN for self-created users. |
| GET | `/config/shop` | Public | Read shop config. |
| PUT | `/config/shop` | Admin | Save shop config. |
| GET | `/menu/preview` | Public | Read first active products for landing page. |
| GET | `/menu` | User | Read active menu and accepted payment methods. |
| POST | `/orders/place` | User | Place structured cart order. |
| GET | `/orders` | User/Admin | User sees own orders; admin sees all orders. |
| PATCH | `/orders/:orderId/complete` | Admin | Complete active order. |
| GET | `/inventory` | Admin | Products and orders snapshot. |
| POST | `/inventory/upload` | Admin | Bulk upsert products. |
| PUT | `/inventory/products/:productId` | Admin | Update product. |
| DELETE | `/inventory/products/:productId` | Admin | Delete product. |
| GET | `/workflows/schema` | Admin | Read workflow JSON schema. |
| GET | `/workflows/:workflowId` | Admin | Read workflow JSON. |
| POST | `/workflows/run` | Admin | Test workflow. |
| POST | `/workflows/generate` | Admin | Generate workflow draft. |
| POST | `/workflows/publish` | Admin | Save workflow JSON. |
| POST | `/orders/process` | User | Process raw order input through workflow. |
| POST | `/agent/chat` | User | Agent-style wrapper around workflow processing. |
| POST | `/agent/setup-workflow` | Admin | Guided workflow setup endpoint. |

## Runtime Architecture

```text
Browser
  -> Vite React SPA
  -> Express API
  -> SQLite data store
  -> JSON workflow files
```

Current implementation:

- Frontend: Vite, React, TypeScript, TanStack Query, lucide-react, CSS files.
- Backend: Express, Zod validation, Node `node:sqlite`.
- Persistence: SQLite for products, orders, order items, and shop config; JSON for users and workflow files.
- Deployment: `deploy-server.js` serves `frontend/dist` and proxies API paths to the backend server.

## Environment

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

The frontend uses same-origin API paths by default. In local standalone Vite dev, those paths proxy to `http://localhost:4000`.

## Roadmap

Near-term:

- Continue simplifying docs and admin workflows.
- Improve product/order edit flows.
- Add better manual review for ambiguous raw order inputs.
- Make workflow publish/versioning clearer.

Later:

- Production-grade auth and merchant account separation.
- Exportable reports.
- Real payment verification or payment gateway integration.
- Messaging-channel ingestion as an input source that reuses the same workflow runner.
