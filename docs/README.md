# zorder Docs

Start here when changing product, architecture, or demo behavior.

## Product Framing

Keep the product story centered on the current problem:

- orders can be messy and hard to track
- payment tracking is manual because payment happens outside zorder

Chat-based ordering is a future enhancement only. Users may still prefer to send or receive orders through chat, but current docs should describe chat ingestion as a later channel that feeds the same tracker, not as the core shipped product.

## Source Of Truth

| Doc | Use It For |
| --- | --- |
| [SPEC.md](./SPEC.md) | Canonical product, user flow, API, data model, and scope. |
| [PRODUCT.md](./PRODUCT.md) | Short product brief and positioning. |
| [USER_JOURNEY.md](./USER_JOURNEY.md) | Current customer/admin flows. |
| [TECH_STACK.md](./TECH_STACK.md) | Current implementation stack and repo structure. |
| [WORKFLOW_SCHEMA.md](./WORKFLOW_SCHEMA.md) | Deterministic workflow contract. |
| [ZO_INFRA.md](./ZO_INFRA.md) | Zo deployment shape and environment variables. |
| [VISION.md](./VISION.md) | Strategic direction and roadmap. |

## Maintenance Rules

- Keep `docs/SPEC.md` aligned with shipped behavior.
- Keep aspirational roadmap items out of implementation docs unless clearly marked as future.
- Do not describe Hono, TanStack Router, Tailwind, Telegram, chat ingestion, or payment gateway behavior as current unless the code actually ships it.
- Keep historical hackathon material out of runtime docs unless it directly explains shipped behavior.
