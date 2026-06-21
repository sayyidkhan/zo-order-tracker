# Agent And Guided Ordering Flow

zorder currently has two related but different flows:

1. **Customer guided ordering UI** in `/user`, which helps a customer choose products, quantities, payment proof, and completion.
2. **Agent-style workflow endpoints** that wrap deterministic workflow processing for testing/setup.

Neither flow should imply that an LLM verifies payment or autonomously decides business state.

## Customer Guided Ordering

The customer guided ordering panel is a UI wrapper around the same product catalog and checkout rules:

1. Choose product category/product.
2. Choose quantity.
3. Review order.
4. Upload payment proof.
5. Place order.
6. View active orders.

This is not a free-form AI chatbot. It is a structured ordering helper.

## Agent Endpoint Scope

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `POST /agent/chat` | User | Sends a message through deterministic workflow handling and returns a conversational-style response. |
| `POST /agent/setup-workflow` | Admin | Guided wrapper around workflow generation. |

The normal runner endpoint remains:

```text
POST /orders/process
```

## Chat Principles

- Keep output operational and short.
- Explain deterministic workflow matches in plain language.
- Ask for missing fields only when needed.
- Never claim that payment was verified by a bank, gateway, or AI.
- Do not create order/payment facts that are not in the input or structured checkout payload.

## Useful States

| State | Meaning |
| --- | --- |
| `collect_input` | User provides raw order/payment text. |
| `show_result` | Workflow returned a structured result. |
| `ask_follow_up` | Workflow needs missing fields. |
| `needs_review` | Input is ambiguous. |
| `workflow_setup` | Admin is creating/testing workflow rules. |

## Setup Workflow

The setup flow collects:

- products or categories sold
- common order messages
- paid/payment proof phrases
- details required before a paid capture should be saved

Output:

- workflow JSON
- sample test inputs
- rule explanations

By default, this uses the local deterministic workflow builder. OpenAI drafting is optional:

```env
WORKFLOW_BUILDER_MODE=openai
OPENAI_API_KEY=your_api_key_here
```

Generated workflows must still be tested and published before use.
