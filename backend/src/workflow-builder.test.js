import assert from "node:assert/strict";
import { buildDecisionTreeWorkflow, normalizeGeneratedWorkflow, workflowGenerationSchema } from "./workflow-builder.js";
import { runWorkflow } from "./workflow-runner.js";

assertStructuredOutputSchema(workflowGenerationSchema);

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

const normalizedGenerated = normalizeGeneratedWorkflow({
  workflow: {
    id: "seller-generated-flow",
    name: "Seller Generated Flow",
    version: 1,
    start: "detect_payment_evidence",
    states: [
      {
        id: "detect_payment_evidence",
        type: "decision",
        rules: [
          {
            id: "has_payment_evidence",
            if: {
              containsAny: ["paynow", "paid"],
              containsAll: null,
              matchesRegex: null,
              amountDetected: null
            },
            then: "create_paid_capture"
          }
        ],
        else: "ask_payment_evidence"
      },
      {
        id: "create_paid_capture",
        type: "action",
        action: "create_order",
        payment_status: "paid",
        message: null,
        required_fields: null
      },
      {
        id: "ask_payment_evidence",
        type: "action",
        action: "ask_follow_up",
        payment_status: null,
        message: "Ask for PayNow or bank transfer evidence before capturing this order.",
        required_fields: ["payment_evidence"]
      }
    ]
  },
  test_inputs: [],
  rule_explanations: []
});

assert.deepEqual(Object.keys(normalizedGenerated.workflow.states), [
  "detect_payment_evidence",
  "create_paid_capture",
  "ask_payment_evidence"
]);
assert.deepEqual(normalizedGenerated.workflow.states.detect_payment_evidence.rules[0].if, {
  containsAny: ["paynow", "paid"]
});
assert.equal("message" in normalizedGenerated.workflow.states.create_paid_capture, false);

const normalizedPaidOrder = runWorkflow({
  workflow: normalizedGenerated.workflow,
  sourceInput: "Nora wants 2 egg tarts, paid by PayNow",
  sourceChannel: "manual"
});

assert.equal(normalizedPaidOrder.status, "created");
assert.deepEqual(normalizedPaidOrder.trace, ["detect_payment_evidence", "create_paid_capture"]);

console.log("workflow builder tests passed");

function assertStructuredOutputSchema(schema, path = "schema") {
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, `${path} must set additionalProperties false`);

    const propertyNames = Object.keys(schema.properties ?? {}).sort();
    const requiredNames = [...(schema.required ?? [])].sort();
    assert.deepEqual(requiredNames, propertyNames, `${path} must require every declared property`);
  }

  if (schema.enum) {
    assert.ok(schema.type, `${path} enum schema must declare a type`);
  }

  for (const [propertyName, propertySchema] of Object.entries(schema.properties ?? {})) {
    assertStructuredOutputSchema(propertySchema, `${path}.${propertyName}`);
  }

  if (schema.items) {
    assertStructuredOutputSchema(schema.items, `${path}.items`);
  }

  for (const [index, anyOfSchema] of (schema.anyOf ?? []).entries()) {
    assertStructuredOutputSchema(anyOfSchema, `${path}.anyOf[${index}]`);
  }
}
