# Product

## Register

product

## Users

- **Merchants** configure products, order rules, branding, and review all orders in `/admin`.
- **Customers** browse the menu, place orders, and track their own order history in `/user` after sign-in.

## Product Purpose

zorder connects merchant setup to a customer ordering flow. Merchants maintain inventory and deterministic workflow JSON. Customers sign in, pick items from the live menu, pay by PayNow or bank transfer, and place orders that appear in the merchant dashboard.

Success means a customer can complete an order without CRM overhead, while the merchant still sees structured orders and payment status in one place.

## Brand Personality

Practical, calm, trustworthy.

The product should feel like a lightweight operations console for a small shop: organized, quick, and clear under pressure. It should not feel like enterprise CRM software or a generic AI chatbot.

## Anti-references

- Full CRM dashboards with crowded sales pipelines, lead scoring, and account-management language.
- Decorative AI assistant interfaces where the model feels like the product instead of the setup helper.
- Marketing-first SaaS landing pages that delay the actual order-tracking workflow.
- Payment-gateway or invoice-heavy tools that imply capabilities outside the MVP.

## Design Principles

- Lead with the task: the first screen is for processing and tracking orders, not explaining the product.
- Keep the owner in control: always show extracted fields and the deterministic reason behind a match.
- Stay lightweight: focus on paid order entry, payment evidence, and review flow.
- Make states visible: paid captures, missing evidence, and needs review should be scannable at a glance.
- Respect the team split: UI supports workflow generation and backend integration without hiding those contracts.

## Accessibility & Inclusion

Target WCAG AA contrast and keyboard-accessible controls. Avoid color-only status communication by pairing colors with labels and icons. Respect reduced-motion preferences and keep motion short because users are in a task flow.
