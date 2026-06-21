# zorder Docs

Start here when changing product, architecture, or demo behavior.

## Source Of Truth

| Doc | Use It For |
| --- | --- |
| [SPEC.md](./SPEC.md) | Canonical product, user flow, API, data model, and scope. |
| [PRODUCT.md](./PRODUCT.md) | Short product brief and positioning. |
| [USER_JOURNEY.md](./USER_JOURNEY.md) | Current customer/admin flows. |
| [tech-stack.md](./tech-stack.md) | Current implementation stack and repo structure. |
| [workflow-schema.md](./workflow-schema.md) | Deterministic workflow contract. |
| [agent-chat-flow.md](./agent-chat-flow.md) | Agent-style and guided workflow behavior. |
| [ZO_INFRA.md](./ZO_INFRA.md) | Zo deployment shape and environment variables. |
| [VISION.md](./VISION.md) | Strategic direction and roadmap. |
| [TEAM.md](./TEAM.md) | Hackathon ownership notes. |

## Maintenance Rules

- Keep `docs/SPEC.md` aligned with shipped behavior.
- Keep aspirational roadmap items out of implementation docs unless clearly marked as future.
- Do not describe Hono, TanStack Router, Tailwind, Telegram, or payment gateway behavior as current unless the code actually ships it.
- Keep the builder statement folder as source material for the hackathon submission, not as runtime documentation.
