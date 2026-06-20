import assert from "node:assert/strict";
import { processOrder } from "./workflow-runner.js";

const paidOrder = processOrder({
  sourceInput: "Hi I want 12 egg tarts for $24, paid by PayNow",
  sourceChannel: "manual"
});

assert.equal(paidOrder.status, "created");
assert.equal(paidOrder.order.payment_status, "paid");
assert.equal(paidOrder.order.total_amount, 24);
assert.equal(paidOrder.order.items[0].quantity, 12);

const missingPaymentOrder = processOrder({
  sourceInput: "Can I get 3 bandung tomorrow?",
  sourceChannel: "manual"
});

assert.equal(missingPaymentOrder.status, "follow_up");
assert.equal(missingPaymentOrder.order, undefined);
assert.deepEqual(missingPaymentOrder.required_fields, ["payment_evidence"]);

const paymentUpdate = processOrder({
  sourceInput: "Customer sent receipt, paid already",
  sourceChannel: "manual"
});

assert.equal(paymentUpdate.status, "updated");
assert.equal(paymentUpdate.payment_status, "paid");

const bankTransferOrder = processOrder({
  sourceInput: "Afiq wants 4 egg tarts, bank transfer done",
  sourceChannel: "manual"
});

assert.equal(bankTransferOrder.status, "created");
assert.equal(bankTransferOrder.order.payment_status, "paid");

const review = processOrder({
  sourceInput: "hello are you open today",
  sourceChannel: "manual"
});

assert.equal(review.status, "needs_review");

console.log("workflow runner tests passed");
