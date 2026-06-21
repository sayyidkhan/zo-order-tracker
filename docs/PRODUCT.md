# Product Brief

zorder is a simple storefront and paid-order tracker for small businesses.

It helps a merchant publish products, show payment instructions, capture payment proof, and track order fulfillment without adopting a full commerce stack.

## Users

| User | Need |
| --- | --- |
| Merchant/admin | Manage products, branding, payment details, orders, fulfillment, analytics, and workflow rules. |
| Customer | Browse the menu, pay externally, upload proof, place an order, and track status. |

## Current Product Promise

- A customer can place a structured order from the live menu.
- Payment proof is required before checkout creates an order.
- A merchant can see all orders, payment evidence, and fulfillment status.
- Inventory and storefront copy can change without code changes.
- Runtime workflow logic is deterministic and does not require an AI key.

## Positioning

Not a CRM. Not a payment gateway. Not a generic AI chatbot.

zorder is a lightweight operations layer for small sellers that already collect payment through PayNow or bank transfer.

## Design Principles

- Lead with the task: ordering and operations come before marketing copy.
- Keep status visible: paid, outstanding, needs review, active, completed.
- Keep the merchant in control: products, branding, payments, and workflow rules are explicit.
- Keep AI optional: AI can draft setup rules, but daily order handling stays deterministic.

See [SPEC.md](./SPEC.md) for the full product scope.
