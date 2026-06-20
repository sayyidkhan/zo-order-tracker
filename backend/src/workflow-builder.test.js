import assert from "node:assert/strict";
import { buildDecisionTreeWorkflow } from "./workflow-builder.js";
import { runWorkflow } from "./workflow-runner.js";

const generated = buildDecisionTreeWorkflow({
  businessDescription:
    "Small Singapore dessert stall selling egg tarts and sweet drinks. Drinks are usually bandung or lemonade. Customers pay only by PayNow or bank transfer.",
  commonOrderMessages: ["Maya wants 12 egg tarts and 2 bandung, paid by PayNow"],
  paidPhrases: ["paid", "paynow", "bank transfer"],
  workflowId: "seller-generated-flow",
  workflowName: "Seller Generated Flow"
});

assert.equal(generated.generation_mode, "local_template");
assert.equal(generated.workflow.start, "detect_payment_evidence");

const decisionStates = Object.values(generated.workflow.states).filter((state) => state.type === "decision");
assert.equal(decisionStates.length, 3);

const paidOrder = runWorkflow({
  workflow: generated.workflow,
  sourceInput: "Afiq wants 4 egg tarts, bank transfer done",
  sourceChannel: "manual"
});

assert.equal(paidOrder.status, "created");
assert.equal(paidOrder.order.payment_status, "paid");
assert.deepEqual(paidOrder.trace, ["detect_payment_evidence", "detect_order_content", "create_paid_capture"]);

const missingEvidence = runWorkflow({
  workflow: generated.workflow,
  sourceInput: "Can I get 3 bandung tomorrow?",
  sourceChannel: "manual"
});

assert.equal(missingEvidence.status, "follow_up");
assert.deepEqual(missingEvidence.required_fields, ["payment_evidence"]);
assert.deepEqual(missingEvidence.trace, [
  "detect_payment_evidence",
  "detect_order_without_payment",
  "ask_payment_evidence"
]);

const paymentOnly = runWorkflow({
  workflow: generated.workflow,
  sourceInput: "Customer sent bank transfer receipt",
  sourceChannel: "manual"
});

assert.equal(paymentOnly.status, "updated");
assert.equal(paymentOnly.payment_status, "paid");
assert.deepEqual(paymentOnly.trace, ["detect_payment_evidence", "detect_order_content", "mark_paid_only"]);

const refined = buildDecisionTreeWorkflow({
  businessDescription:
    "Small Singapore dessert stall selling egg tarts and sweet drinks. Drinks are usually bandung or lemonade. Customers pay only by PayNow or bank transfer.",
  changeRequest: "Add PayLah as payment evidence.",
  existingWorkflow: generated.workflow,
  workflowId: "seller-generated-flow",
  workflowName: "Seller Generated Flow"
});

assert.equal(refined.generation_mode, "local_refine");
assert.equal(refined.workflow.version, generated.workflow.version + 1);

const paylahOrder = runWorkflow({
  workflow: refined.workflow,
  sourceInput: "Maya wants 2 egg tarts, PayLah done",
  sourceChannel: "manual"
});

assert.equal(paylahOrder.status, "created");
assert.equal(paylahOrder.order.payment_status, "paid");

console.log("workflow builder tests passed");
