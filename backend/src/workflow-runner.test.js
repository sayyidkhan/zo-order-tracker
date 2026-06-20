import assert from "node:assert/strict";
import { processOrder } from "./workflow-runner.js";

const paidOrder = processOrder({
  sourceInput: "Hi I want 2 brownies for $12, paid by PayNow",
  sourceChannel: "manual"
});

assert.equal(paidOrder.status, "created");
assert.equal(paidOrder.order.payment_status, "paid");
assert.equal(paidOrder.order.total_amount, 12);
assert.equal(paidOrder.order.items[0].quantity, 2);

const unpaidOrder = processOrder({
  sourceInput: "Can I get 3 cookies tomorrow?",
  sourceChannel: "manual"
});

assert.equal(unpaidOrder.status, "created");
assert.equal(unpaidOrder.order.payment_status, "unpaid");

const paymentUpdate = processOrder({
  sourceInput: "Customer sent receipt, paid already",
  sourceChannel: "manual"
});

assert.equal(paymentUpdate.status, "updated");
assert.equal(paymentUpdate.payment_status, "paid");

const review = processOrder({
  sourceInput: "hello are you open today",
  sourceChannel: "manual"
});

assert.equal(review.status, "needs_review");

console.log("workflow runner tests passed");
