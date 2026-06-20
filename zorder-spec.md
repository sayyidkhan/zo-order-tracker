# zorder — Product Specification

**Tagline:** A lightweight storefront and order operations workspace for small businesses.

| | |
|---|---|
| **Project Name** | zorder |
| **Submitted By** | Team of Wicks |
| **Contact** | shab.hacks@gmail.com |
| **Built On** | Zo |
| **Live Link** | https://your-live-link.com |
| **Demo Video** | https://your-video-link.com |

---

## 1. Executive Summary

zorder is a lightweight web app for small sellers that need a simple way to publish a menu, receive paid customer orders, and track fulfillment from one operations dashboard.

The product has two main surfaces:

- **Customer storefront (`/user`)** — customers sign in, browse active menu items, add products to cart, upload payment proof, place orders, and track their own active/completed orders.
- **Merchant admin (`/admin`)** — business owners manage incoming orders, inventory, storefront branding, payment instructions, and deterministic order workflows.

The current MVP focuses on a controlled structured-ordering flow while keeping deterministic workflow infrastructure in place for future messy-message intake and automation channels.

## 2. Problem Statement

Small and home-based businesses often sell through informal channels without a full e-commerce system. This creates operational friction:

- **Menus are shared manually.** Sellers repeatedly send product lists, prices, payment details, and availability through chat.
- **Orders are hard to centralize.** Customer requests, payment screenshots, and fulfillment status can get scattered across messages.
- **Payment evidence is easy to lose.** Owners need a single view of who has paid and what needs action.
- **Customers lack order visibility.** After paying, customers often need to ask for order status manually.
- **Heavy storefront tools are overkill.** Many micro-businesses need a simple order flow, not a full CRM, POS, or marketplace setup.

## 3. Goal

Give small sellers a simple storefront and back-office workspace where customers can place paid orders and merchants can manage products, orders, payment evidence, and fulfillment without adopting heavy e-commerce software.

### 3.1 Success Indicators

- A merchant can publish active products and payment instructions quickly.
- A customer can sign in, place an order, upload payment proof, and see order status.
- The merchant can see all orders, payment status, outstanding items, and fulfillment state from one dashboard.
- Inventory/product updates are reflected in the customer menu without code changes.
- Runtime order processing remains deterministic and does not require an AI API key.

## 4. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Home-based seller** | Sells food, crafts, or small goods directly to customers | Publish a simple menu and track paid orders |
| **Small merchant/operator** | Manages orders, payment evidence, and fulfillment manually | Centralize orders and operational status |
| **Repeat customer** | Buys from the seller and wants a simple ordering flow | Browse items, pay, place order, and track status |

## 5. Scope

### 5.1 In Scope (Current MVP)

- Public product overview page.
- Customer storefront with sign-in/sign-up.
- Customer menu generated from active merchant inventory.
- Cart and checkout flow.
- Payment instructions for PayNow and/or bank transfer.
- Payment proof image upload during checkout.
- Customer order history scoped to the signed-in username.
- Merchant admin dashboard for all orders.
- Payment status summary: paid, outstanding, and needs review.
- Fulfillment status tracking: active and completed.
- Merchant inventory management: add, edit, delete, and bulk upload products.
- Merchant branding management: business name, mark, tagline, description, payment instructions, PayNow details, bank details, footer note.
- PayNow QR upload and QR generation support.
- Deterministic JSON workflow runner.
- Workflow builder/setup flow for merchants.
- Workflow draft preview, publish flow, and deterministic decision-tree traversal.
- Local demo auth using username and 6-digit PIN.
- SQLite-backed local persistence for orders and products.

### 5.2 Out of Scope (Current MVP)

- Direct chat-platform ingestion from WhatsApp, Instagram, Telegram, or marketplace comments.
- Payment gateway processing or automatic payment verification.
- Refunds, invoices, receipts, and accounting exports.
- Production-grade auth, roles, permissions, or team management.
- Multi-tenant SaaS billing.
- Fully automated ambiguous-message review queue.
- Runtime LLM classification for normal order processing.

## 6. Core Features

### 6.1 Customer Storefront

The customer storefront is the primary ordering surface. Customers can view the seller's branded landing page, sign in or sign up, browse active menu products, add items to cart, review totals, upload payment proof, and place an order.

The storefront uses merchant-configured branding and payment instructions so the customer-facing flow can be adapted for different small businesses.

### 6.2 Menu and Cart Ordering

Customers order from products configured by the merchant. Each active product includes:

- product name
- category
- unit price, if available
- active/inactive status

Customers can adjust quantities, review subtotal and total, add pickup/delivery notes, and proceed to checkout.

### 6.3 Payment Proof Capture

The current checkout flow requires customers to upload payment proof before placing an order. Payment proof is stored with the order for merchant review.

Supported payment instruction types:

- PayNow number
- PayNow QR image
- generated PayNow QR
- bank name
- bank account name
- bank account number

The app does not process payments directly. It records customer-provided proof and payment status.

### 6.4 Merchant Order Dashboard

The merchant dashboard shows all orders in one place with summary metrics:

- **Needs review** — orders or inputs with unclear evidence/status.
- **Outstanding** — unpaid or partially paid orders.
- **Paid** — paid orders.

The order table shows customer details, source input, ordered items, payment evidence, payment status, amount, and fulfillment state. Merchants can mark active orders as completed.

### 6.5 Inventory Management

Merchants manage the product catalog from the admin workspace. They can:

- add products manually
- edit product name, category, price, and active status
- delete products
- bulk upload products through CSV or JSON

Only active products appear in the customer menu.

### 6.6 Branding and Payment Configuration

Merchants can configure the storefront without code changes:

- business name
- brand mark letter
- tagline
- description
- payment instructions
- PayNow number
- PayNow QR image
- bank transfer details
- footer note

These settings power the public `/user` landing page and customer checkout instructions.

### 6.7 Deterministic Workflow Infrastructure

zorder includes a deterministic JSON workflow runner. The workflow engine evaluates ordered rules against input and returns predictable outcomes such as:

- create order
- update payment status
- ask follow-up
- route to review

The same input and same workflow always produce the same result. Runtime order processing does not require an LLM.

### 6.8 Workflow Builder and Preview

The merchant admin includes an order rules workspace where merchants can set up deterministic workflow drafts by answering guided setup prompts:

1. products/categories sold
2. payment evidence phrases
3. sales capture rule

The app can generate a workflow draft, preview the decision tree, publish the workflow, and manually traverse the deterministic branches for testing.

## 7. User Flow

### 7.1 Customer Flow

1. **Open storefront** — Customer visits `/user`.
2. **Sign in or sign up** — Customer uses username and 6-digit PIN.
3. **Browse menu** — Customer sees active products grouped by category.
4. **Build cart** — Customer adds items and quantities.
5. **Review checkout** — Customer checks order total and optional pickup/delivery notes.
6. **Pay externally** — Customer pays through PayNow or bank transfer using merchant instructions.
7. **Upload proof** — Customer uploads payment proof image.
8. **Place order** — Order is stored and appears in the customer's active orders.
9. **Track order** — Customer views current and completed order history.

### 7.2 Merchant Flow

1. **Sign in to admin** — Merchant opens `/admin`.
2. **Configure inventory** — Merchant creates or uploads products.
3. **Configure branding** — Merchant saves storefront and payment details.
4. **Set up order rules** — Merchant builds and publishes deterministic workflow JSON.
5. **Monitor orders** — Merchant sees all incoming orders and payment status.
6. **Fulfill orders** — Merchant marks active orders as completed.
7. **Review sales analytics** — Merchant checks paid captures, units sold, and product performance.

## 8. Data Model (Current MVP)

### 8.1 Order

| Field | Type | Notes |
|---|---|---|
| `id` | identifier | Unique order ID |
| `customer_name` | text/null | Customer display name when available |
| `customer_handle` | text/null | Customer handle when available |
| `source_channel` | text | `customer_app`, `manual`, or other source label |
| `source_input` | text | Source summary or original input used for workflow traceability |
| `order_summary` | text | Human-readable order summary |
| `payment_status` | enum | `paid`, `partial`, `unpaid`, `unknown` |
| `fulfillment_status` | enum | `active`, `completed` |
| `total_amount` | number/null | Total amount when known |
| `currency` | text | Defaults to `SGD` |
| `evidence` | text | Payment proof or evidence text/data |
| `placed_by_username` | text/null | Signed-in customer username for customer-scoped history |
| `created_at` | timestamp | When the order was created |

### 8.2 Order Item

| Field | Type | Notes |
|---|---|---|
| `id` | identifier | Unique item row ID |
| `order_id` | reference | Parent order |
| `item_name` | text | Product/item name |
| `quantity` | integer | Ordered quantity |
| `unit_price` | number/null | Unit price when available |
| `notes` | text/null | Category or item notes |

### 8.3 Product

| Field | Type | Notes |
|---|---|---|
| `id` | identifier | Unique product ID |
| `name` | text | Product name |
| `category` | text | Product category |
| `unit_price` | number/null | Product price |
| `is_active` | boolean | Whether product appears in customer menu |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last product update |

### 8.4 Shop Branding

| Field | Type | Notes |
|---|---|---|
| `business_name` | text | Storefront business name |
| `mark_letter` | text | Short brand mark |
| `tagline` | text | Customer-facing headline |
| `description` | text | Storefront description |
| `payment_instructions` | text | Checkout payment copy |
| `paynow_number` | text | Optional PayNow number |
| `paynow_qr_image` | text | Optional QR image data |
| `bank_name` | text | Optional bank name |
| `bank_account_name` | text | Optional bank account name |
| `bank_account_number` | text | Optional bank account number |
| `footer_note` | text | Optional storefront footer note |

### 8.5 Workflow

| Field | Type | Notes |
|---|---|---|
| `id` | text | Workflow identifier |
| `name` | text | Human-readable workflow name |
| `version` | integer | Workflow version |
| `start` | text | Start state ID |
| `states` | object | Decision/action state map |

## 9. System Architecture

The current app is a Vite React frontend backed by an Express API and local SQLite persistence.

```text
Customer / Merchant Browser
        |
        v
Vite React SPA
        |
        v
Express API
        |
        +--> Auth and profile JSON stores
        +--> Shop config JSON store
        +--> SQLite products/orders/order_items
        +--> Deterministic JSON workflow runner
        +--> Workflow JSON files
```

Key runtime components:

- **Frontend:** Vite, React, TypeScript, TanStack Query, lucide-react.
- **Backend:** Express, Zod validation, Node SQLite runtime.
- **Persistence:** local SQLite database for products and orders; local JSON files for users, shop config, and workflows.
- **Workflow engine:** deterministic JSON decision tree.
- **AI usage:** optional workflow generation/setup only; not required for normal order processing.

## 10. API Surface (Current MVP)

| Endpoint | Role | Purpose |
|---|---|---|
| `GET /health` | public | API health check |
| `POST /auth/login` | public | Username + PIN login |
| `POST /auth/signup` | public | Customer signup |
| `GET /auth/profile` | user | Read customer profile |
| `PUT /auth/profile` | user | Update customer profile |
| `POST /auth/change-password` | user | Change customer PIN |
| `GET /config/shop` | public | Read storefront branding/payment config |
| `PUT /config/shop` | admin | Update storefront branding/payment config |
| `GET /menu/preview` | public | Preview active menu products |
| `GET /menu` | user | Read active customer menu |
| `POST /orders/place` | user | Place structured cart order |
| `GET /orders` | user/admin | User-scoped orders or all admin orders |
| `PATCH /orders/:orderId/complete` | admin | Mark active order completed |
| `GET /inventory` | admin | Inventory and order snapshot |
| `POST /inventory/upload` | admin | Bulk upload products |
| `PUT /inventory/products/:productId` | admin | Update product |
| `DELETE /inventory/products/:productId` | admin | Delete product |
| `GET /workflows/schema` | admin | Read workflow JSON schema |
| `GET /workflows/:workflowId` | admin | Read workflow JSON |
| `POST /workflows/run` | admin | Test workflow against input |
| `POST /workflows/generate` | admin | Generate workflow draft |
| `POST /workflows/publish` | admin | Publish workflow JSON |
| `POST /orders/process` | user | Process raw order input through workflow |
| `POST /agent/chat` | user | Test order note through agent-style response |
| `POST /agent/setup-workflow` | admin | Guided workflow setup endpoint |

## 11. Non-Functional Considerations

- **Predictable order logic.** Runtime classification uses deterministic workflows, not opaque AI decisions.
- **Low-friction customer ordering.** Customers should be able to order without learning a heavy marketplace UI.
- **Merchant control.** Merchants own product catalog, branding, payment instructions, and workflow rules.
- **Clear payment visibility.** Payment proof and payment status should be visible from the order dashboard.
- **Local-first demo simplicity.** SQLite and JSON files keep the hackathon MVP easy to run, inspect, and explain.
- **Future automation-ready.** Additional channels can reuse the workflow runner and order store later.

## 12. Future Roadmap

- Direct ingestion from Telegram, WhatsApp, Instagram, or forwarded chat messages.
- Full review queue for ambiguous raw messages.
- Manual correction and confirmation of extracted order fields.
- Payment reminders for outstanding orders.
- Lightweight payment links or payment gateway integration.
- Production-grade authentication and merchant account management.
- Multi-operator admin roles.
- Exportable sales reports.
- Hosted Zo deployment with live demo URL.

## 13. Appendix — Current Demo Narrative

> zorder helps small sellers turn a basic product catalog into a simple paid-order workflow. Merchants configure products, payment instructions, branding, and deterministic order rules. Customers sign in, browse the menu, pay externally, upload payment proof, and track their orders. Merchants manage all orders, payment status, fulfillment, inventory, and workflow setup from one admin dashboard.
>
> Zo is positioned as the deployment and operations environment for the hackathon demo: the app, data store, workflow JSON, and future automation runtime can live in the seller's Zo environment. Runtime order tracking remains deterministic, while AI assistance is used only for workflow setup and build-time acceleration.
