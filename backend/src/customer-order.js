import { saveOrder } from "./data-store.js";
import { processOrder } from "./workflow-runner.js";

const paidEvidenceHints = [
  "paid",
  "paynow",
  "bank transfer",
  "transferred",
  "transfer done",
  "sent receipt",
  "receipt",
  "receipt uploaded"
];

export function isPaymentProofImage(value) {
  return value.trim().startsWith("data:image/");
}

export function buildCustomerSourceInput({ username, items, paymentEvidence = "", notes = "" }) {
  const summary = items.map((item) => `${item.quantity} ${item.item_name}`).join(", ");
  const parts = [`${username} wants ${summary}`];

  if (isPaymentProofImage(paymentEvidence)) {
    parts.push("PayNow or bank transfer receipt uploaded");
  } else if (paymentEvidence.trim()) {
    parts.push(paymentEvidence.trim());
  }

  if (notes.trim()) {
    parts.push(notes.trim());
  }

  return parts.join(". ");
}

export function inferCustomerPaymentStatus(paymentEvidence) {
  if (isPaymentProofImage(paymentEvidence)) {
    return "paid";
  }

  const normalized = paymentEvidence.trim().toLowerCase();

  if (!normalized) {
    return "unpaid";
  }

  if (paidEvidenceHints.some((hint) => normalized.includes(hint))) {
    return "paid";
  }

  return "unknown";
}

export function placeCustomerOrder({
  username,
  items,
  paymentEvidence = "",
  notes = "",
  workflowId = "default-order-flow"
}) {
  if (!items.length) {
    const error = new Error("Add at least one item to place an order");
    error.statusCode = 400;
    throw error;
  }

  if (!isPaymentProofImage(paymentEvidence)) {
    const error = new Error("Upload payment proof before placing your order");
    error.statusCode = 400;
    throw error;
  }

  const totalAmount = items.reduce((sum, item) => {
    if (item.unit_price === null || item.unit_price === undefined) {
      return sum;
    }

    return sum + item.unit_price * item.quantity;
  }, 0);

  const sourceInput = buildCustomerSourceInput({ username, items, paymentEvidence, notes });
  const paymentStatus = inferCustomerPaymentStatus(paymentEvidence);
  const workflowResult = processOrder({
    sourceInput,
    sourceChannel: "customer_app",
    workflowId
  });

  const order = {
    customer_name: username,
    customer_handle: `@${username}`,
    source_channel: "customer_app",
    source_input: sourceInput,
    order_summary: items.map((item) => `${item.quantity} ${item.item_name}`).join(", "),
    payment_status: paymentStatus === "paid" ? "paid" : paymentStatus,
    total_amount: totalAmount > 0 ? totalAmount : null,
    currency: "SGD",
    items: items.map((item) => ({
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      notes: item.notes ?? null
    })),
    evidence: paymentEvidence.trim(),
    fulfillment_status: "active",
    created_at: new Date().toISOString()
  };

  const orderId = saveOrder(order, { placedByUsername: username });

  return {
    order_id: orderId,
    order,
    workflow: {
      status: workflowResult.status,
      message: workflowResult.message,
      explanation: workflowResult.explanation
    }
  };
}
