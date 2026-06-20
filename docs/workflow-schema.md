# Workflow Schema

Owner: Haoming

This document defines the deterministic workflow contract for zorder. Runtime order processing should follow this contract before any optional AI setup flow is added.

## Goals

- Convert messy order text into structured order data.
- Keep the logic predictable, explainable, and cheap to run.
- Let a home business owner edit rules without understanding backend code.
- Produce enough trace data for the dashboard to show why an input matched.

## Workflow Shape

Each workflow is a JSON decision tree:

```json
{
  "id": "default-order-flow",
  "name": "Default Order Flow",
  "version": 1,
  "start": "detect_intent",
  "states": {}
}
```

Required fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable workflow identifier. |
| `name` | string | Human-readable name. |
| `version` | number | Increment when workflow behavior changes. |
| `start` | string | State id where execution begins. |
| `states` | object | Map of state id to state definition. |

## State Types

### Decision State

A decision state checks rules in order and jumps to the first matching `then` state.

```json
{
  "type": "decision",
  "rules": [
    {
      "id": "looks_like_order",
      "if": {
        "containsAny": ["order", "want", "buy"]
      },
      "then": "extract_order"
    }
  ],
  "else": "needs_review"
}
```

Supported condition operators for MVP:

| Operator | Type | Behavior |
| --- | --- | --- |
| `containsAny` | string[] | Match if normalized input contains at least one phrase. |
| `containsAll` | string[] | Match if normalized input contains every phrase. |
| `matchesRegex` | string | Match if normalized input satisfies the regex. |
| `amountDetected` | boolean | Match if input contains a currency amount. |

Condition evaluation rules:

- Normalize input to lowercase before matching.
- Trim repeated whitespace.
- Match `containsAny` and `containsAll` as plain phrases, not regex.
- If multiple operators exist in one `if`, all operators must match.
- Rules are ordered; first match wins.

### Action State

An action state produces an outcome for the backend.

```json
{
  "type": "action",
  "action": "create_order",
  "payment_status": "unpaid"
}
```

Supported actions for MVP:

| Action | Result |
| --- | --- |
| `create_order` | Extract order fields and create an order. |
| `update_payment_status` | Mark a detected or selected order as paid, partial, unpaid, or unknown. |
| `needs_review` | Store the input for manual review. |
| `ask_follow_up` | Return a prompt for missing order details. |

## Extraction Contract

The workflow runner should return a consistent response:

```json
{
  "workflow_id": "default-order-flow",
  "workflow_version": 1,
  "matched_state": "extract_order",
  "matched_rule": "looks_like_order",
  "action_taken": "create_order",
  "order": {
    "customer_name": null,
    "customer_handle": null,
    "source_channel": "manual",
    "source_input": "hi i want 2 brownies, paid by paynow",
    "order_summary": "2 brownies",
    "payment_status": "paid",
    "total_amount": null,
    "currency": "SGD",
    "items": [
      {
        "item_name": "brownies",
        "quantity": 2,
        "unit_price": null,
        "notes": null
      }
    ]
  },
  "explanation": "Matched looks_like_order because the input contained \"want\"."
}
```

Field requirements:

| Field | Required | Notes |
| --- | --- | --- |
| `workflow_id` | yes | Id of the workflow used. |
| `workflow_version` | yes | Version of the workflow used. |
| `matched_state` | yes | Final state id. |
| `matched_rule` | no | Rule id, if a decision rule matched. |
| `action_taken` | yes | Final action. |
| `order` | no | Present when action creates or updates an order. |
| `explanation` | yes | Short deterministic explanation for the UI. |

## Payment Status Rules

Payment status must stay one of:

- `unpaid`
- `partial`
- `paid`
- `unknown`

Recommended keyword hints:

| Status | Hints |
| --- | --- |
| `paid` | paid, paynow, transferred, transfer done, sent, receipt |
| `partial` | deposit, half paid, partial, balance |
| `unpaid` | unpaid, pay later, cod, cash on delivery |
| `unknown` | no payment hint found |

## MVP Runner Algorithm

1. Load the active workflow JSON.
2. Validate it against `backend/workflows/workflow-schema.json`.
3. Normalize the source input.
4. Start at `workflow.start`.
5. For decision states, evaluate rules in order and move to `then` or `else`.
6. For action states, execute the named action and stop.
7. Return the structured result and explanation.

## Guardrails

- Do not call an LLM inside the normal workflow runner.
- Do not silently invent customer or payment details.
- Do not create invoices, inventory records, or CRM-style profiles for MVP.
- If the input is ambiguous, return `needs_review` or `ask_follow_up`.
