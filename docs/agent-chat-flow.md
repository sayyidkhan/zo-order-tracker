# Agent Chat Flow

Owner: Haoming

The agent chat should help a home business owner turn messy messages into trackable orders without pretending to be a generic AI assistant. It is a guided workflow tester and setup helper.

## Chat Principles

- Keep messages short and operational.
- Explain workflow matches in plain language.
- Ask for missing details only when they affect order tracking.
- Never imply that payment was verified through a payment gateway.
- Keep daily processing deterministic; AI is only for setup assistance later.

## MVP Conversation States

| State | User Intent | Assistant Behavior | Output |
| --- | --- | --- | --- |
| `idle` | Owner opens chat | Offer to process an order note or test workflow rules. | Empty draft |
| `collect_input` | Owner pastes messy order text | Send text to workflow runner. | Raw source input |
| `show_result` | Workflow returns result | Summarize detected paid order, items, amount, and payment evidence. | Structured preview |
| `ask_follow_up` | Required fields are missing | Ask one focused question. | Missing field request |
| `confirm_save` | Result is good enough | Ask owner to save or edit. | Paid capture draft |
| `needs_review` | Workflow cannot classify input | Explain why and suggest manual fields. | Review draft |
| `workflow_setup` | Owner wants custom rules | Collect business type, common products, payment phrases, and ambiguous cases. | Starter workflow JSON |

## Primary Flow

1. Owner pastes an order message.
2. Chat calls `/orders/process` with the raw input and active workflow id.
3. Chat shows a preview:
   - customer
   - order summary
   - items
   - amount
   - payment evidence
   - explanation
4. Owner confirms, edits, or marks for review.
5. Saved paid captures appear in the dashboard.

## Message Templates

### Successful Order Detection

```text
I found 1 paid order capture: {order_summary}. I matched this because {explanation}
```

### Missing Details

```text
I can track this, but I need {missing_field}. What should I use?
```

### Needs Review

```text
I could not confidently classify this as an order or payment update. I marked it for review so it does not pollute the dashboard.
```

### Payment Update

```text
Payment evidence updated to paid. Reason: {explanation}
```

## Setup Flow For Optional AI Assistance

The optional setup assistant can generate a starter workflow, but the output must still be editable JSON.

Questions to ask:

1. What do you sell?
2. What are 3 common order messages you receive?
3. What words usually mean the customer has paid?
4. What payment evidence must exist before you save a sales capture?
5. What details must every paid order have before you save it?

Generated output:

- Workflow JSON using the schema in `docs/workflow-schema.md`.
- Sample test inputs.
- A short explanation of each rule.

Backend endpoint:

```text
POST /agent/setup-workflow
```

This endpoint may call GPT using `GPT-API-KEY` from `backend/.env`. The generated workflow is still plain JSON and should be tested through the deterministic runner before daily use.

## UI Contract

The frontend should display the workflow explanation near the extracted fields. This makes the deterministic system feel trustworthy and keeps the owner in control.

Minimum chat payload:

```json
{
  "source_input": "string",
  "source_channel": "manual",
  "workflow_id": "default-order-flow"
}
```

Minimum chat response:

```json
{
  "status": "created | updated | needs_review | follow_up",
  "message": "string",
  "result": {},
  "explanation": "string"
}
```
