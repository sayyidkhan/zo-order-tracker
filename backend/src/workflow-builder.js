import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateWorkflow } from "./workflow-runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(__dirname, "..", "workflows");
const defaultOpenAiEndpoint = "https://api.openai.com/v1/responses";

const workflowGenerationSchema = {
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
          type: "object",
          additionalProperties: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["type", "rules", "else"],
                properties: {
                  type: { const: "decision" },
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
                          properties: {
                            containsAny: {
                              type: "array",
                              items: { type: "string" }
                            },
                            containsAll: {
                              type: "array",
                              items: { type: "string" }
                            },
                            matchesRegex: { type: "string" },
                            amountDetected: { type: "boolean" }
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
                required: ["type", "action"],
                properties: {
                  type: { const: "action" },
                  action: {
                    enum: ["create_order", "update_payment_status", "needs_review", "ask_follow_up"]
                  },
                  payment_status: {
                    enum: ["unpaid", "partial", "paid", "unknown"]
                  },
                  message: { type: "string" },
                  required_fields: {
                    type: "array",
                    items: {
                      enum: [
                        "customer_name",
                        "customer_handle",
                        "order_summary",
                        "items",
                        "total_amount",
                        "payment_status"
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
  commonOrderMessages = [],
  paidPhrases = [],
  payLaterPhrases = [],
  requiredFields = [],
  workflowId = "generated-order-flow",
  workflowName = "Generated Order Flow"
}) {
  const apiKey = process.env["GPT-API-KEY"] ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const error = new Error("Missing GPT-API-KEY. Add it to backend/.env to generate workflow JSON.");
    error.statusCode = 503;
    throw error;
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
        model: process.env.GPT_MODEL ?? "gpt-4o-mini",
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
                common_order_messages: commonOrderMessages,
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

  const generated = parseStructuredOutput(payload);
  generated.workflow.id = sanitizeWorkflowId(generated.workflow.id || workflowId);
  generated.workflow.name = generated.workflow.name || workflowName;
  generated.workflow.version = generated.workflow.version || 1;
  validateWorkflow(generated.workflow);

  return generated;
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
    "The workflow runs as a deterministic decision tree, so use only explicit keyword and amount rules.",
    "Do not create CRM, invoice, inventory, auth, payment gateway, or Telegram-only behavior.",
    "Prefer order detection rules before payment-only update rules so paid order messages still create orders.",
    "Use only these condition operators: containsAny, containsAll, matchesRegex, amountDetected.",
    "Use only these actions: create_order, update_payment_status, needs_review, ask_follow_up.",
    "Payment status must be unpaid, partial, paid, or unknown.",
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

function sanitizeWorkflowId(workflowId) {
  return workflowId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
