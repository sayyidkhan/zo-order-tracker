# Workflow Schema

zorder workflows are deterministic JSON decision trees. They are used for raw text processing, workflow testing, and setup tooling. Structured customer checkout does not depend on an LLM.

The runtime schema file is `backend/workflows/workflow-schema.json`.

The product problem stays focused on messy order tracking and manual payment tracking. Raw text and future chat intake are enhancement paths that should feed the same deterministic tracker instead of becoming a separate chat product.

## Workflow Shape

```json
{
  "id": "default-order-flow",
  "name": "Default Order Flow",
  "version": 1,
  "start": "detect_intent",
  "states": {
    "detect_intent": {
      "type": "decision",
      "rules": [],
      "else": "needs_review"
    },
    "needs_review": {
      "type": "action",
      "action": "needs_review"
    }
  }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable workflow identifier. |
| `name` | Yes | Human-readable name. |
| `version` | Yes | Integer version. |
| `start` | Yes | First state ID. |
| `states` | Yes | Object keyed by state ID. |

## Decision State

A decision state checks rules in order and moves to the first matching `then` state. If no rule matches, it moves to `else`.

```json
{
  "type": "decision",
  "rules": [
    {
      "id": "paid_order_request",
      "if": {
        "containsAny": ["paid", "paynow", "receipt"]
      },
      "then": "create_order"
    }
  ],
  "else": "needs_review"
}
```

Supported condition operators:

| Operator | Type | Behavior |
| --- | --- | --- |
| `containsAny` | `string[]` | Match when normalized input contains at least one phrase. |
| `containsAll` | `string[]` | Match when normalized input contains every phrase. |
| `matchesRegex` | `string` | Match JavaScript regex against normalized input. |
| `amountDetected` | `boolean` | Match when input contains a currency-like amount. |

Rules:

- Input is normalized to lowercase.
- `containsAny` and `containsAll` are phrase checks, not regex.
- If multiple operators exist in one condition, all must pass.
- First matching rule wins.

## Action State

Action states end workflow execution.

```json
{
  "type": "action",
  "action": "ask_follow_up",
  "message": "Ask for PayNow or bank transfer evidence before capturing this order.",
  "required_fields": ["payment_evidence"]
}
```

Supported actions:

| Action | Meaning |
| --- | --- |
| `create_order` | Build an order result from the raw input. |
| `update_payment_status` | Return a payment update result. Requires `payment_status`. |
| `needs_review` | Return a review result. |
| `ask_follow_up` | Return missing fields and prompt copy. |

Supported `payment_status` values:

- `paid`
- `partial`
- `unpaid`
- `unknown`

Supported `required_fields` values:

- `customer_name`
- `customer_handle`
- `order_summary`
- `items`
- `total_amount`
- `payment_status`
- `payment_evidence`

## Runner Output

The runner returns traceable output for UI previews and tests.

```json
{
  "workflow_id": "default-order-flow",
  "workflow_version": 1,
  "matched_state": "create_order",
  "matched_rule": "paid_order_request",
  "action_taken": "create_order",
  "status": "created",
  "message": "Paid order captured.",
  "explanation": "Matched paid_order_request.",
  "trace": ["detect_intent", "create_order"],
  "order": {
    "customer_name": null,
    "customer_handle": null,
    "source_channel": "manual",
    "source_input": "hi i want 12 egg tarts, paid by paynow",
    "order_summary": "12 egg tarts",
    "payment_status": "paid",
    "fulfillment_status": "active",
    "total_amount": null,
    "currency": "SGD",
    "items": [
      {
        "item_name": "egg tarts",
        "quantity": 12,
        "unit_price": null,
        "notes": null
      }
    ],
    "evidence": "hi i want 12 egg tarts, paid by paynow",
    "created_at": "2026-06-21T00:00:00.000Z"
  }
}
```

## Runtime Rules

- Normal workflow execution must not call an LLM.
- Missing payment proof should route to `ask_follow_up` rather than silently creating a paid order.
- Ambiguous input should return `needs_review`.
- Workflow JSON should be validated before use.
- Published workflows are stored in `backend/workflows/{workflowId}.json`.

## Current Endpoints

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `GET /workflows/schema` | Admin | Read JSON schema. |
| `GET /workflows/:workflowId` | Admin | Read a workflow. |
| `POST /workflows/run` | Admin | Test a workflow or saved workflow ID. |
| `POST /workflows/generate` | Admin | Generate a draft workflow. |
| `POST /workflows/publish` | Admin | Save workflow JSON. |
| `POST /orders/process` | User | Process raw text and save only paid order results. |
| `POST /agent/setup-workflow` | Admin | Guided setup wrapper around workflow generation. |

## Optional OpenAI Drafting

By default, `workflow-builder.js` creates local deterministic drafts.

To explicitly use OpenAI for setup-only drafting:

```env
WORKFLOW_BUILDER_MODE=openai
OPENAI_API_KEY=your_api_key_here
```

Daily order processing should still use the generated JSON deterministically.
