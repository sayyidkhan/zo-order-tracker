import { processOrder } from "./workflow-runner.js";
import { generateWorkflow } from "./workflow-builder.js";

export function handleAgentMessage({
  message,
  state = "collect_input",
  sourceChannel = "manual",
  workflowId = "default-order-flow"
}) {
  if (!message?.trim()) {
    return {
      state: "idle",
      status: "follow_up",
      message: "Paste an order note and I will test it against the active workflow.",
      result: null,
      explanation: "No source input was provided."
    };
  }

  const result = processOrder({
    sourceInput: message,
    sourceChannel,
    workflowId
  });

  return {
    state: nextAgentState(result.status),
    status: result.status,
    message: buildAgentMessage(result),
    result,
    explanation: result.explanation,
    previous_state: state
  };
}

export async function handleWorkflowSetupMessage({
  businessDescription,
  commonOrderMessages = [],
  paidPhrases = [],
  payLaterPhrases = [],
  requiredFields = [],
  workflowId = "generated-order-flow",
  workflowName = "Generated Order Flow"
}) {
  const generated = await generateWorkflow({
    businessDescription,
    commonOrderMessages,
    paidPhrases,
    payLaterPhrases,
    requiredFields,
    workflowId,
    workflowName
  });

  return {
    state: "workflow_setup",
    status: "generated",
    message: `I generated ${generated.workflow.name} with ${Object.keys(generated.workflow.states).length} workflow states.`,
    result: generated,
    explanation: "GPT generated the setup-time decision tree; runtime order processing still uses deterministic JSON rules."
  };
}

function nextAgentState(status) {
  if (status === "created" || status === "updated") {
    return "show_result";
  }

  if (status === "follow_up") {
    return "ask_follow_up";
  }

  return "needs_review";
}

function buildAgentMessage(result) {
  if (result.status === "created") {
    return `I found 1 order: ${result.order.order_summary}. Payment looks ${result.order.payment_status}. ${result.explanation}`;
  }

  if (result.status === "updated") {
    return `Payment status updated to ${result.payment_status}. ${result.explanation}`;
  }

  if (result.status === "follow_up") {
    return `${result.message} Missing: ${(result.required_fields ?? []).join(", ") || "order details"}.`;
  }

  return `${result.message} ${result.explanation}`;
}
