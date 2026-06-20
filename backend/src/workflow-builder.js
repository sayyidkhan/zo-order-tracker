import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateWorkflow } from "./workflow-runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(__dirname, "..", "workflows");
const defaultOpenAiEndpoint = "https://api.openai.com/v1/responses";

export const workflowGenerationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workflow", "test_inputs", "rule_explanations"],
  properties: {
    workflow: {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "version", "start", "states"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        version: { type: "integer" },
        start: { type: "string" },
        states: {
          type: "array",
          items: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["id", "type", "rules", "else"],
                properties: {
                  id: { type: "string" },
                  type: { type: "string", enum: ["decision"] },
                  rules: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["id", "if", "then"],
                      properties: {
                        id: { type: "string" },
                        if: {
                          type: "object",
                          additionalProperties: false,
                          required: ["containsAny", "containsAll", "matchesRegex", "amountDetected"],
                          properties: {
                            containsAny: {
                              type: ["array", "null"],
                              items: { type: "string" }
                            },
                            containsAll: {
                              type: ["array", "null"],
                              items: { type: "string" }
                            },
                            matchesRegex: { type: ["string", "null"] },
                            amountDetected: { type: ["boolean", "null"] }
                          }
                        },
                        then: { type: "string" }
                      }
                    }
                  },
                  else: { type: "string" }
                }
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["id", "type", "action", "payment_status", "message", "required_fields"],
                properties: {
                  id: { type: "string" },
                  type: { type: "string", enum: ["action"] },
                  action: {
                    type: "string",
                    enum: ["create_order", "update_payment_status", "needs_review", "ask_follow_up"]
                  },
                  payment_status: {
                    type: ["string", "null"],
                    enum: ["unpaid", "partial", "paid", "unknown", null]
                  },
                  message: { type: ["string", "null"] },
                  required_fields: {
                    type: ["array", "null"],
                    items: {
                      type: "string",
                      enum: [
                        "customer_name",
                        "customer_handle",
                        "order_summary",
                        "items",
                        "total_amount",
                        "payment_status",
                        "payment_evidence"
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      }
    },
    test_inputs: {
      type: "array",
      items: { type: "string" }
    },
    rule_explanations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rule_id", "explanation"],
        properties: {
          rule_id: { type: "string" },
          explanation: { type: "string" }
        }
      }
    }
  }
};

export async function generateWorkflow({
  businessDescription,
  changeRequest = "",
  commonOrderMessages = [],
  existingWorkflow,
  paidPhrases = [],
  payLaterPhrases = [],
  requiredFields = [],
  workflowId = "generated-order-flow",
  workflowName = "Generated Order Flow"
}) {
  const apiKey = process.env["GPT-API-KEY"] ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return buildDecisionTreeWorkflow({
      businessDescription,
      changeRequest,
      commonOrderMessages,
      existingWorkflow,
      paidPhrases,
      workflowId,
      workflowName
    });
  }

  let response;

  try {
    response = await fetch(process.env.OPENAI_RESPONSES_URL ?? defaultOpenAiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GPT_MODEL ?? "gpt-5.5",
        input: [
          {
            role: "developer",
            content: workflowBuilderInstructions()
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                workflow_id: workflowId,
                workflow_name: workflowName,
                business_description: businessDescription,
                change_request: changeRequest,
                common_order_messages: commonOrderMessages,
                existing_workflow: existingWorkflow ?? null,
                paid_phrases: paidPhrases,
                pay_later_phrases: payLaterPhrases,
                required_fields: requiredFields
              },
              null,
              2
            )
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "zorder_workflow_generation",
            strict: true,
            schema: workflowGenerationSchema
          }
        }
      })
    });
  } catch (cause) {
    const error = new Error("Could not reach OpenAI to generate workflow JSON.");
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }

  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error?.message ?? "OpenAI workflow generation failed");
    error.statusCode = response.status;
    throw error;
  }

  const generated = normalizeGeneratedWorkflow(parseStructuredOutput(payload));
  generated.workflow.id = sanitizeWorkflowId(generated.workflow.id || workflowId);
  generated.workflow.name = generated.workflow.name || workflowName;
  generated.workflow.version = generated.workflow.version || 1;
  validateWorkflow(generated.workflow);

  if (!isDecisionTreeWorkflow(generated.workflow)) {
    return buildDecisionTreeWorkflow({
      businessDescription,
      changeRequest,
      commonOrderMessages,
      existingWorkflow,
      paidPhrases,
      workflowId,
      workflowName
    });
  }

  return {
    generation_mode: "openai",
    ...generated
  };
}

export function buildDecisionTreeWorkflow({
  businessDescription = "",
  changeRequest = "",
  commonOrderMessages = [],
  existingWorkflow,
  paidPhrases = [],
  workflowId = "generated-order-flow",
  workflowName = "Generated Order Flow"
}) {
  const contextText = `${businessDescription} ${changeRequest}`;
  const paymentEvidencePhrases = uniquePhrases([
    ...paidPhrases,
    ...extractPaymentPhrases(changeRequest),
    "paid",
    "paynow",
    "bank transfer",
    "transferred",
    "transfer done",
    "sent receipt",
    "receipt"
  ]);
  const orderIntentPhrases = uniquePhrases(["want", "buy", "reserve", "take", "can i get", "get", "need", "order"]);
  const productHints = extractProductHints(contextText);
  const quantityPattern = productHints.length
    ? `\\b\\d+\\s+(?:${productHints.map(escapeRegex).join("|")})\\b`
    : "\\b\\d+\\s+[a-z][a-z\\s-]{1,40}";
  const workflow = {
    id: sanitizeWorkflowId(existingWorkflow?.id ?? workflowId),
    name: existingWorkflow?.name ?? workflowName,
    version: Number(existingWorkflow?.version ?? 0) + 1,
    start: "detect_payment_evidence",
    states: {
      detect_payment_evidence: {
        type: "decision",
        rules: [
          {
            id: "has_payment_evidence",
            if: {
              containsAny: paymentEvidencePhrases
            },
            then: "detect_order_content"
          }
        ],
        else: "detect_order_without_payment"
      },
      detect_order_content: {
        type: "decision",
        rules: [
          {
            id: "paid_message_has_order_intent",
            if: {
              containsAny: orderIntentPhrases
            },
            then: "create_paid_capture"
          },
          {
            id: "paid_message_has_quantity",
            if: {
              matchesRegex: quantityPattern
            },
            then: "create_paid_capture"
          }
        ],
        else: "mark_paid_only"
      },
      detect_order_without_payment: {
        type: "decision",
        rules: [
          {
            id: "order_missing_payment_evidence",
            if: {
              containsAny: orderIntentPhrases
            },
            then: "ask_payment_evidence"
          },
          {
            id: "amount_without_clear_order",
            if: {
              amountDetected: true
            },
            then: "ask_order_confirmation"
          }
        ],
        else: "needs_review"
      },
      create_paid_capture: {
        type: "action",
        action: "create_order",
        payment_status: "paid"
      },
      mark_paid_only: {
        type: "action",
        action: "update_payment_status",
        payment_status: "paid"
      },
      ask_payment_evidence: {
        type: "action",
        action: "ask_follow_up",
        message: "Ask for PayNow or bank transfer evidence before capturing this order.",
        required_fields: ["payment_evidence"]
      },
      ask_order_confirmation: {
        type: "action",
        action: "ask_follow_up",
        message: "I found an amount, but I need to confirm whether this is an order.",
        required_fields: ["order_summary"]
      },
      needs_review: {
        type: "action",
        action: "needs_review",
        message: "This input did not match a paid order capture rule."
      }
    }
  };

  validateWorkflow(workflow);

  return {
    generation_mode: existingWorkflow ? "local_refine" : "local_template",
    workflow,
    test_inputs: buildTestInputs(commonOrderMessages, productHints),
    rule_explanations: [
      {
        rule_id: "has_payment_evidence",
        explanation: "First branch checks for PayNow, bank transfer, receipt, or other explicit paid evidence."
      },
      {
        rule_id: "paid_message_has_order_intent",
        explanation: "Paid messages with order intent become sales captures."
      },
      {
        rule_id: "paid_message_has_quantity",
        explanation: "Paid messages with item quantities become sales captures even if the wording is short."
      },
      {
        rule_id: "order_missing_payment_evidence",
        explanation: "Order requests without payment evidence ask for follow-up instead of creating unpaid orders."
      },
      {
        rule_id: "amount_without_clear_order",
        explanation: "Amount-only messages need owner confirmation before they can affect the dashboard."
      }
    ]
  };
}

export function saveGeneratedWorkflow(workflow) {
  const safeId = sanitizeWorkflowId(workflow.id);
  const workflowPath = path.join(workflowDir, `${safeId}.json`);

  fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`, "utf8");

  return {
    workflow_id: safeId,
    path: workflowPath
  };
}

function workflowBuilderInstructions() {
  return [
    "You generate zorder workflow JSON for home business order tracking.",
    "The workflow must be a deterministic multi-node decision tree, not a single flat rules list.",
    "Return workflow.states as an array of state objects. Every state object must include an id, and all then, else, and start references must use those ids.",
    "If existing_workflow and change_request are provided, revise only the relevant branches and preserve unrelated state ids where possible.",
    "Use at least these decision states: detect_payment_evidence, detect_order_content, detect_order_without_payment.",
    "The start state must be detect_payment_evidence.",
    "The first branch must decide whether PayNow, bank transfer, paid, transfer done, or receipt evidence exists.",
    "A paid branch may create_order only after order intent or quantity is detected.",
    "A missing-payment branch must ask_follow_up for payment_evidence.",
    "Use only explicit keyword, regex, and amount rules.",
    "For rule conditions, set unused condition operators to null.",
    "Do not create CRM, invoice, inventory, auth, payment gateway, or Telegram-only behavior.",
    "Only create an order when the message includes PayNow, bank transfer, transfer done, paid, or receipt evidence.",
    "If an order request is missing payment evidence, ask a follow-up for payment_evidence instead of creating an unpaid order.",
    "Prefer paid order detection rules before payment-only update rules so paid order messages still create orders.",
    "Use only these condition operators: containsAny, containsAll, matchesRegex, amountDetected.",
    "Use only these actions: create_order, update_payment_status, needs_review, ask_follow_up.",
    "For action states, set payment_status, message, or required_fields to null when they do not apply.",
    "Daily sales capture should use paid orders only; do not model pending, pay-later, unpaid, or partial sales.",
    "Always include a needs_review action state as the final else target.",
    "Return concise rule explanations for non-technical business owners."
  ].join(" ");
}

function parseStructuredOutput(payload) {
  const outputText =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text;

  if (!outputText) {
    throw new Error("OpenAI response did not include workflow JSON output.");
  }

  return JSON.parse(outputText);
}

export function normalizeGeneratedWorkflow(generated) {
  const workflow = generated?.workflow;

  if (!workflow || typeof workflow !== "object") {
    return generated;
  }

  const states = Array.isArray(workflow.states)
    ? Object.fromEntries(workflow.states.map((state) => [state.id, normalizeGeneratedState(state)]))
    : Object.fromEntries(
        Object.entries(workflow.states ?? {}).map(([stateId, state]) => [stateId, normalizeGeneratedState(state)])
      );

  return {
    ...generated,
    workflow: {
      ...workflow,
      states
    }
  };
}

function normalizeGeneratedState(state) {
  if (state?.type === "decision") {
    return {
      type: "decision",
      rules: (state.rules ?? []).map((rule) => ({
        id: rule.id,
        if: normalizeGeneratedCondition(rule.if),
        then: rule.then
      })),
      else: state.else
    };
  }

  if (state?.type === "action") {
    return {
      type: "action",
      action: state.action,
      ...(state.payment_status ? { payment_status: state.payment_status } : {}),
      ...(state.message ? { message: state.message } : {}),
      ...(Array.isArray(state.required_fields) && state.required_fields.length
        ? { required_fields: state.required_fields.filter(Boolean) }
        : {})
    };
  }

  return state;
}

function normalizeGeneratedCondition(condition = {}) {
  const normalized = {};

  if (Array.isArray(condition.containsAny)) {
    const containsAny = condition.containsAny.map((phrase) => String(phrase).trim()).filter(Boolean);
    if (containsAny.length) {
      normalized.containsAny = containsAny;
    }
  }

  if (Array.isArray(condition.containsAll)) {
    const containsAll = condition.containsAll.map((phrase) => String(phrase).trim()).filter(Boolean);
    if (containsAll.length) {
      normalized.containsAll = containsAll;
    }
  }

  if (condition.matchesRegex) {
    normalized.matchesRegex = condition.matchesRegex;
  }

  if (typeof condition.amountDetected === "boolean") {
    normalized.amountDetected = condition.amountDetected;
  }

  return normalized;
}

function sanitizeWorkflowId(workflowId) {
  return workflowId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function isDecisionTreeWorkflow(workflow) {
  const decisionStates = Object.values(workflow.states ?? {}).filter((state) => state.type === "decision");
  return workflow.start === "detect_payment_evidence" && decisionStates.length >= 3;
}

function uniquePhrases(phrases) {
  return Array.from(
    new Set(
      phrases
        .map((phrase) => String(phrase ?? "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function extractProductHints(description) {
  const lower = description.toLowerCase();
  const knownProducts = [
    "egg tarts",
    "egg tart",
    "bandung",
    "lemonade",
    "brownies",
    "brownie",
    "cookies",
    "cookie",
    "tart boxes",
    "tart box"
  ];

  return knownProducts.filter((product) => lower.includes(product));
}

function extractPaymentPhrases(text) {
  const lower = text.toLowerCase();
  const knownPhrases = [
    "paylah",
    "pay lah",
    "paynow qr",
    "bank receipt",
    "transfer receipt",
    "receipt screenshot",
    "payment screenshot"
  ];
  const quotedPhrases = Array.from(text.matchAll(/["'`]([^"'`]{2,40})["'`]/g), (match) => match[1].trim().toLowerCase());

  return uniquePhrases([...knownPhrases.filter((phrase) => lower.includes(phrase)), ...quotedPhrases]);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTestInputs(commonOrderMessages, productHints) {
  const fallbackProduct = productHints[0] ?? "egg tarts";
  return [
    ...commonOrderMessages.slice(0, 3),
    `I want 2 ${fallbackProduct}, paid by PayNow`,
    `Can I get 3 ${fallbackProduct} tomorrow?`,
    "Customer sent bank transfer receipt"
  ].filter(Boolean);
}
