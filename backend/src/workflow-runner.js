import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(__dirname, "..", "workflows");

const paymentHints = {
  paid: ["paid", "paynow", "bank transfer", "transferred", "transfer done", "sent", "receipt"]
};

export function loadWorkflow(workflowId = "default-order-flow") {
  const safeId = workflowId.replace(/[^a-zA-Z0-9_-]/g, "");
  const workflowPath = path.join(workflowDir, `${safeId}.json`);

  if (!fs.existsSync(workflowPath)) {
    const error = new Error(`Workflow not found: ${workflowId}`);
    error.statusCode = 404;
    throw error;
  }

  return JSON.parse(fs.readFileSync(workflowPath, "utf8"));
}

export function normalizeInput(input) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function runWorkflow({ workflow, sourceInput, sourceChannel = "manual" }) {
  validateWorkflow(workflow);

  const normalizedInput = normalizeInput(sourceInput);
  const trace = [];
  let currentStateId = workflow.start;
  let matchedRule = null;

  for (let step = 0; step < 25; step += 1) {
    const state = workflow.states[currentStateId];

    if (!state) {
      throw new Error(`Workflow references missing state: ${currentStateId}`);
    }

    trace.push(currentStateId);

    if (state.type === "decision") {
      const rule = state.rules.find((candidate) => conditionMatches(candidate.if, normalizedInput));
      matchedRule = rule?.id ?? null;
      currentStateId = rule?.then ?? state.else;
      continue;
    }

    if (state.type === "action") {
      return buildActionResult({
        workflow,
        state,
        stateId: currentStateId,
        matchedRule,
        sourceInput,
        sourceChannel,
        normalizedInput,
        trace
      });
    }

    throw new Error(`Unsupported state type: ${state.type}`);
  }

  throw new Error("Workflow exceeded maximum step count");
}

export function processOrder({ sourceInput, sourceChannel = "manual", workflowId = "default-order-flow" }) {
  const workflow = loadWorkflow(workflowId);
  return runWorkflow({ workflow, sourceInput, sourceChannel });
}

export function conditionMatches(condition, normalizedInput) {
  const checks = [];

  if (condition.containsAny) {
    checks.push(condition.containsAny.some((phrase) => normalizedInput.includes(phrase.toLowerCase())));
  }

  if (condition.containsAll) {
    checks.push(condition.containsAll.every((phrase) => normalizedInput.includes(phrase.toLowerCase())));
  }

  if (condition.matchesRegex) {
    checks.push(new RegExp(condition.matchesRegex, "i").test(normalizedInput));
  }

  if (typeof condition.amountDetected === "boolean") {
    checks.push(hasAmount(normalizedInput) === condition.amountDetected);
  }

  return checks.length > 0 && checks.every(Boolean);
}

function buildActionResult({
  workflow,
  state,
  stateId,
  matchedRule,
  sourceInput,
  sourceChannel,
  normalizedInput,
  trace
}) {
  const action = state.action;
  const inferredPaymentStatus = inferPaymentStatus(normalizedInput);
  const paymentStatus = state.payment_status ?? inferredPaymentStatus;
  const explanation = explainMatch({ action, matchedRule, state, normalizedInput });

  const base = {
    workflow_id: workflow.id,
    workflow_version: workflow.version,
    matched_state: stateId,
    matched_rule: matchedRule,
    action_taken: action,
    status: statusFromAction(action),
    message: messageFromAction(action, paymentStatus, state.message),
    explanation,
    trace
  };

  if (action === "create_order") {
    return {
      ...base,
      order: extractOrder({ sourceInput, sourceChannel, paymentStatus })
    };
  }

  if (action === "update_payment_status") {
    return {
      ...base,
      payment_status: paymentStatus
    };
  }

  if (action === "ask_follow_up") {
    return {
      ...base,
      required_fields: state.required_fields ?? []
    };
  }

  return base;
}

export function validateWorkflow(workflow) {
  if (!workflow?.id || !workflow?.start || !workflow?.states?.[workflow.start]) {
    throw new Error("Invalid workflow: missing id, start, or start state");
  }

  for (const [stateId, state] of Object.entries(workflow.states)) {
    if (state.type === "decision") {
      for (const rule of state.rules ?? []) {
        if (!workflow.states[rule.then]) {
          throw new Error(`Invalid workflow: rule ${rule.id} in ${stateId} points to missing state ${rule.then}`);
        }
      }

      if (!workflow.states[state.else]) {
        throw new Error(`Invalid workflow: state ${stateId} points to missing else state ${state.else}`);
      }
    }
  }
}

function extractOrder({ sourceInput, sourceChannel, paymentStatus }) {
  const amount = extractAmount(sourceInput);
  const item = extractItem(sourceInput);

  return {
    customer_name: extractCustomerName(sourceInput),
    customer_handle: extractCustomerHandle(sourceInput),
    source_channel: sourceChannel,
    source_input: sourceInput,
    order_summary: item.item_name ? `${item.quantity} ${item.item_name}` : sourceInput.trim(),
    payment_status: paymentStatus,
    total_amount: amount?.value ?? null,
    currency: amount?.currency ?? "SGD",
    items: [
      {
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: null,
        notes: null
      }
    ],
    evidence: sourceInput.trim()
  };
}

function inferPaymentStatus(normalizedInput) {
  for (const [status, hints] of Object.entries(paymentHints)) {
    if (hints.some((hint) => normalizedInput.includes(hint))) {
      return status;
    }
  }

  return "unknown";
}

function hasAmount(normalizedInput) {
  return /(?:sgd|\$|s\$)\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:sgd|dollars?)/i.test(normalizedInput);
}

function extractAmount(input) {
  const match = input.match(/(?:sgd|s\$|\$)\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:sgd|dollars?)/i);

  if (!match) {
    return null;
  }

  return {
    value: Number(match[1] ?? match[2]),
    currency: "SGD"
  };
}

function extractItem(input) {
  const withoutPayment = input
    .replace(/\b(paid|paynow|transferred|transfer done|sent receipt|receipt|deposit|half paid|partial|balance)\b/gi, "")
    .replace(/(?:sgd|s\$|\$)\s*\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s*(?:sgd|dollars?)/gi, "")
    .trim();

  const quantityMatch = withoutPayment.match(/\b(?:want|buy|order|reserve|take|get|need)\s+(\d+)\s+([a-z][a-z\s-]{1,40})/i);

  if (quantityMatch) {
    return {
      quantity: Number(quantityMatch[1]),
      item_name: cleanupItemName(quantityMatch[2])
    };
  }

  const fallbackMatch = withoutPayment.match(/\b(\d+)\s+([a-z][a-z\s-]{1,40})/i);

  if (fallbackMatch) {
    return {
      quantity: Number(fallbackMatch[1]),
      item_name: cleanupItemName(fallbackMatch[2])
    };
  }

  return {
    quantity: 1,
    item_name: cleanupItemName(withoutPayment)
  };
}

function cleanupItemName(value) {
  return value
    .replace(/\bplease\b/gi, "")
    .replace(/\bthanks?\b/gi, "")
    .replace(/\bby\b.*/gi, "")
    .replace(/[.,!]+$/g, "")
    .trim();
}

function extractCustomerHandle(input) {
  return input.match(/@[a-zA-Z0-9_]+/)?.[0] ?? null;
}

function extractCustomerName(input) {
  const match = input.match(/\b(?:from|name is|customer)\s+([a-zA-Z][a-zA-Z\s]{1,40})/i);
  return match ? match[1].trim() : null;
}

function explainMatch({ action, matchedRule, state, normalizedInput }) {
  if (matchedRule) {
    return `Matched ${matchedRule} before taking ${action}.`;
  }

  if (state.message) {
    return state.message;
  }

  if (inferPaymentStatus(normalizedInput) !== "unknown") {
    return `Detected payment language before taking ${action}.`;
  }

  return `No rule matched, so the input was routed to ${action}.`;
}

function statusFromAction(action) {
  if (action === "create_order") {
    return "created";
  }

  if (action === "update_payment_status") {
    return "updated";
  }

  if (action === "ask_follow_up") {
    return "follow_up";
  }

  return "needs_review";
}

function messageFromAction(action, paymentStatus, configuredMessage) {
  if (configuredMessage) {
    return configuredMessage;
  }

  if (action === "create_order") {
    return `Order detected. Payment looks ${paymentStatus}.`;
  }

  if (action === "update_payment_status") {
    return `Payment status updated to ${paymentStatus}.`;
  }

  if (action === "ask_follow_up") {
    return "I need one more detail before saving this order.";
  }

  return "This input needs manual review.";
}
