import * as React from "react";
import { useState } from "react";
import type {
  AppRoute,
  AdminTab,
  AuthAccess,
  AuthCredential,
  AuthMode,
  AuthRole,
  AuthState,
  CapturePeriodDays,
  CustomerMenuSnapshot,
  DemoLoginCredential,
  FulfillmentStatus,
  InventoryProduct,
  InventoryProductDraft,
  InventoryProductInput,
  InventorySnapshot,
  PaymentStatus,
  PlaceOrderResult,
  ProcessResult,
  ProcessedOrder,
  ShopBranding,
  UserProfile,
  WorkflowCondition,
  WorkflowGeneration,
  WorkflowSetupAnswers,
  WorkflowChatMessage,
  WorkflowSetupStepId,
  WorkflowActionState,
  WorkflowDecisionState,
  WorkflowState
} from "../types";
import {
  apiBase,
  defaultShopBranding,
  maxPaymentProofPayloadLength,
  maxProductImagePayloadLength,
  workflowChatStorageKey,
  workflowDraftStorageKey,
  workflowSetupSteps
} from "../constants";

export function isActiveOrder(order: ProcessedOrder) {
  return (order.fulfillment_status ?? "active") === "active";
}

export function isCompletedOrder(order: ProcessedOrder) {
  return order.fulfillment_status === "completed";
}

export const captureTimeZone = "Asia/Singapore";
export const captureDateFormatter = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeZone: captureTimeZone
});
export const captureTimeFormatter = new Intl.DateTimeFormat("en-SG", {
  timeStyle: "short",
  timeZone: captureTimeZone
});
export const captureDateKeyFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "2-digit",
  month: "2-digit",
  timeZone: captureTimeZone,
  year: "numeric"
});

export function isPaidOrder(order: ProcessedOrder) {
  return order.payment_status === "paid";
}

export function buildMetrics(orders: ProcessedOrder[]) {
  const paidOrders = orders.filter(isPaidOrder);

  return {
    paid: paidOrders.length,
    today: paidOrders.filter((order) => isCapturedToday(order.created_at)).length,
    review: orders.filter((order) => order.payment_status === "unknown").length,
    outstanding: orders.filter(
      (order) => order.payment_status === "unpaid" || order.payment_status === "partial"
    ).length
  };
}

export function countDecisionStates(states: Record<string, WorkflowState>) {
  return Object.values(states).filter((state) => state.type === "decision").length;
}

export function countWorkflowRules(states: Record<string, WorkflowState>) {
  return Object.values(states).reduce(
    (total, state) => total + (state.type === "decision" ? state.rules.length : 0),
    0
  );
}

export function isCapturedToday(value: string) {
  return getCaptureDateKey(value) === getCaptureDateKey(new Date());
}

export function isCapturedThisYear(value: string) {
  return getCaptureYearKey(value) === getCaptureYearKey(new Date());
}

export function isWithinLastDays(value: string, days: number) {
  return isWithinCapturePeriod(value, days);
}

export const capturePeriodOptions: Array<{ days: CapturePeriodDays; label: string; shortLabel: string }> = [
  { days: 1, label: "1 day", shortLabel: "1 day" },
  { days: 3, label: "3 days", shortLabel: "3 days" },
  { days: 7, label: "7 days", shortLabel: "7 days" },
  { days: 30, label: "1 month", shortLabel: "1 mth" },
  { days: 90, label: "90 days", shortLabel: "90D" },
  { days: 365, label: "1 year", shortLabel: "1 yr" }
];

export function getCapturePeriodLabel(days: CapturePeriodDays) {
  return capturePeriodOptions.find((option) => option.days === days)?.label ?? `${days} days`;
}

export function isWithinCapturePeriod(value: string | Date, days: number) {
  const date = toValidDate(value);
  if (!date) {
    return false;
  }

  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - Math.max(days - 1, 0));
  start.setHours(0, 0, 0, 0);

  return date >= start && date <= end;
}

export function buildCapturePeriodSummary(orders: ProcessedOrder[], days: CapturePeriodDays) {
  const scopedOrders = orders.filter(
    (order) => isPaidOrder(order) && isWithinCapturePeriod(order.created_at, days)
  );
  let sales = 0;
  let units = 0;

  for (const order of scopedOrders) {
    sales += order.total_amount ?? 0;
    units += sumOrderQuantity(order);
  }

  return {
    count: scopedOrders.length,
    sales,
    units,
    orders: scopedOrders.sort(
      (first, second) =>
        (toValidDate(second.created_at)?.getTime() ?? 0) - (toValidDate(first.created_at)?.getTime() ?? 0)
    )
  };
}

export function buildSalesByDate(orders: ProcessedOrder[]) {
  const buckets = new Map<
    string,
    { dateKey: string; label: string; orderCount: number; sales: number; timestamp: number; unitsSold: number }
  >();

  for (const order of orders) {
    const date = toValidDate(order.created_at);
    const dateKey = getCaptureDateKey(order.created_at);
    const current = buckets.get(dateKey) ?? {
      dateKey,
      label: formatCaptureDate(order.created_at),
      orderCount: 0,
      sales: 0,
      timestamp: date?.getTime() ?? 0,
      unitsSold: 0
    };

    current.orderCount += 1;
    current.sales += order.total_amount ?? 0;
    current.unitsSold += sumOrderQuantity(order);
    buckets.set(dateKey, current);
  }

  return Array.from(buckets.values()).sort((first, second) => second.timestamp - first.timestamp);
}

export function buildSalesByYear(orders: ProcessedOrder[]) {
  const buckets = new Map<
    string,
    { yearKey: string; label: string; orderCount: number; sales: number; unitsSold: number }
  >();

  for (const order of orders) {
    const yearKey = getCaptureYearKey(order.created_at);
    const current = buckets.get(yearKey) ?? {
      yearKey,
      label: yearKey,
      orderCount: 0,
      sales: 0,
      unitsSold: 0
    };

    current.orderCount += 1;
    current.sales += order.total_amount ?? 0;
    current.unitsSold += sumOrderQuantity(order);
    buckets.set(yearKey, current);
  }

  return Array.from(buckets.values()).sort((first, second) => Number(second.yearKey) - Number(first.yearKey));
}

export function buildInventorySummary(orders: ProcessedOrder[]) {
  const products = new Map<string, { name: string; quantity: number; orderCount: number }>();
  let paidSales = 0;
  let unitsSold = 0;

  for (const order of orders) {
    if (order.total_amount !== null && order.payment_status === "paid") {
      paidSales += order.total_amount;
    }

    for (const item of order.items) {
      unitsSold += item.quantity;
      const existing = products.get(item.item_name) ?? {
        name: item.item_name,
        quantity: 0,
        orderCount: 0
      };

      existing.quantity += item.quantity;
      existing.orderCount += 1;
      products.set(item.item_name, existing);
    }
  }

  return {
    paidSales,
    unitsSold,
    topProducts: Array.from(products.values())
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5)
  };
}

export function sumOrderQuantity(order: ProcessedOrder) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function createInventoryDraft(product?: InventoryProduct): InventoryProductDraft {
  return {
    name: product?.name ?? "",
    category: product?.category ?? "",
    unit_price: product?.unit_price === null || product?.unit_price === undefined ? "" : String(product.unit_price),
    image_url: product?.image_url ?? "",
    is_active: product?.is_active ?? true
  };
}

export function inventoryProductFromDraft(draft: InventoryProductDraft): InventoryProduct {
  return normalizeInventoryProducts([
    {
      name: draft.name,
      category: draft.category,
      unit_price: draft.unit_price,
      image_url: draft.image_url,
      is_active: draft.is_active
    }
  ])[0];
}

export function parseInventoryUpload(rawText: string, fileName: string): InventoryProduct[] {
  const text = rawText.trim();
  if (!text) {
    throw new Error("Inventory file is empty");
  }

  if (fileName.endsWith(".json") || text.startsWith("[") || text.startsWith("{")) {
    const payload = JSON.parse(text) as InventoryProductInput[] | { products?: InventoryProductInput[] };
    const products = Array.isArray(payload) ? payload : payload.products;
    if (!Array.isArray(products)) {
      throw new Error("JSON inventory must be an array or { products: [...] }");
    }

    return normalizeInventoryProducts(products);
  }

  const rows = parseCsvRows(text);
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const products = dataRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""]));

      return {
        name: record.name,
        category: record.category || "inventory",
        unit_price: record.unit_price || null,
        image_url: record.image_url || record.image || "",
        is_active: record.is_active || true
      };
    });

  return normalizeInventoryProducts(products);
}

export function normalizeInventoryProducts(products: InventoryProductInput[]): InventoryProduct[] {
  const normalized = products.map((product) => ({
    name: String(product.name ?? "").trim(),
    category: String(product.category ?? "").trim() || "inventory",
    unit_price: product.unit_price === null || product.unit_price === undefined || product.unit_price === "" ? null : Number(product.unit_price),
    image_url: String(product.image_url ?? "").trim(),
    is_active: normalizeInventoryActive(product.is_active)
  }));

  if (!normalized.length || normalized.some((product) => !product.name)) {
    throw new Error("Inventory upload needs at least one product with a name");
  }

  if (normalized.some((product) => product.unit_price !== null && Number.isNaN(product.unit_price))) {
    throw new Error("Inventory unit_price values must be numbers");
  }

  return normalized;
}

export function normalizeInventoryActive(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return !["false", "0", "no", "inactive"].includes(value.trim().toLowerCase());
  }

  return true;
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && isQuoted && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (char === "," && !isQuoted) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows;
}

export async function readApiError(response: Response) {
  try {
    const payload = await response.json();
    if (Array.isArray(payload.issues) && payload.issues.length > 0) {
      const issueMessages = payload.issues
        .map((issue: { message?: string }) => issue.message)
        .filter(Boolean)
        .join(", ");

      if (issueMessages) {
        return issueMessages;
      }
    }

    return payload.error ?? "API request failed";
  } catch {
    return "API request failed";
  }
}

export function formatWorkflowGenerateError(error: Error) {
  if (/gpt-api-key|openai api key|api key/i.test(error.message)) {
    return `${error.message} Disable WORKFLOW_BUILDER_MODE=openai or configure the API key for explicit OpenAI workflow drafting.`;
  }

  return error.message;
}

export function createEmptyWorkflowSetupAnswers(): WorkflowSetupAnswers {
  return {
    products: ""
  };
}

export function createInitialWorkflowChatMessages(): WorkflowChatMessage[] {
  return [
    {
      id: "workflow-builder-welcome",
      role: "assistant",
      content: buildWorkflowSetupQuestion(0),
      createdAt: new Date().toISOString()
    }
  ];
}

export function buildWorkflowSetupQuestion(stepIndex: number) {
  const step = workflowSetupSteps[stepIndex];
  return `${step.title}\n${step.question}`;
}

export function buildWorkflowSetupContext(answers: WorkflowSetupAnswers) {
  return [
    `Seller sells: ${answers.products}.`,
    "Accepted payment evidence is fixed by the platform: the customer must pay and upload a screenshot or receipt of the completed payment.",
    "Sales capture rule is fixed by the platform: capture or fulfill the order only when order content and uploaded payment proof are both present.",
    "If order content is present but uploaded payment proof is missing, ask for payment proof. Do not let merchants configure this policy.",
    "Build only explicit deterministic keyword, regex, amount, and branch rules."
  ].join(" ");
}

export function loadGeneratedWorkflowDraft() {
  const stored = localStorage.getItem(workflowDraftStorageKey);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (isStoredWorkflowGeneration(parsed)) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(workflowDraftStorageKey);
  }

  localStorage.removeItem(workflowDraftStorageKey);
  return null;
}

export function saveGeneratedWorkflowDraft(generatedWorkflow: WorkflowGeneration | null) {
  if (!generatedWorkflow) {
    localStorage.removeItem(workflowDraftStorageKey);
    return;
  }

  localStorage.setItem(workflowDraftStorageKey, JSON.stringify(generatedWorkflow));
}

export function isStoredWorkflowGeneration(value: unknown): value is WorkflowGeneration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WorkflowGeneration>;
  const workflow = candidate.workflow;

  return Boolean(
    workflow &&
      typeof workflow === "object" &&
      typeof workflow.id === "string" &&
      typeof workflow.name === "string" &&
      typeof workflow.version === "number" &&
      typeof workflow.start === "string" &&
      workflow.states &&
      typeof workflow.states === "object" &&
      Array.isArray(candidate.test_inputs) &&
      Array.isArray(candidate.rule_explanations)
  );
}

export function loadWorkflowChatHistory() {
  const stored = localStorage.getItem(workflowChatStorageKey);
  if (!stored) {
    return createInitialWorkflowChatMessages();
  }

  try {
    const parsed = JSON.parse(stored) as WorkflowChatMessage[];
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (message) =>
          (message.role === "assistant" || message.role === "user") &&
          typeof message.content === "string" &&
          typeof message.createdAt === "string" &&
          typeof message.id === "string"
      )
    ) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(workflowChatStorageKey);
  }

  return createInitialWorkflowChatMessages();
}

export function createWorkflowChatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildWorkflowAssistantReply(result: WorkflowGeneration, hadExistingWorkflow: boolean) {
  const workflow = result.workflow;
  const action = hadExistingWorkflow ? "Rebuilt" : "Built";
  const decisionCount = countDecisionStates(workflow.states);
  const ruleCount = countWorkflowRules(workflow.states);

  return `${action} ${workflow.name} v${workflow.version} from the product list and fixed platform payment policy. It has ${decisionCount} decision nodes and ${ruleCount} deterministic rules, starting at ${workflow.start}. Missing uploaded payment proof routes to follow-up, so sales captures stay paid-only.`;
}

export function formatAmount(value: number | null, currency: string) {
  if (value === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency
  }).format(value);
}

export function formatOrderId(order: ProcessedOrder) {
  return order.id ?? "Not assigned";
}

export function getOrderCustomerLabel(order: ProcessedOrder) {
  return order.customer_name ?? order.customer_handle ?? "Manual entry";
}

export function downloadOrderReceiptPdf(order: ProcessedOrder) {
  const blob = createOrderReceiptPdf(order);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${formatOrderId(order).replace(/[^a-z0-9_-]+/gi, "-")}-receipt.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createOrderReceiptPdf(order: ProcessedOrder) {
  const receiptLines = buildOrderReceiptLines(order).flatMap((line) => wrapPdfTextLine(line, 86));
  const streamLines = [
    "BT",
    "/F1 18 Tf",
    "50 800 Td",
    "(zorder order receipt) Tj",
    "/F1 10 Tf"
  ];

  receiptLines.forEach((line) => {
    streamLines.push("0 -18 Td");
    if (line) {
      streamLines.push(`(${escapePdfText(line)}) Tj`);
    }
  });

  streamLines.push("ET");
  const stream = streamLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function buildOrderReceiptLines(order: ProcessedOrder) {
  const itemLines = order.items.length
    ? order.items.map((item) => {
        const price = item.unit_price === null ? "price not set" : formatAmount(item.unit_price * item.quantity, order.currency);
        return `- ${item.quantity} x ${item.item_name} (${price})`;
      })
    : ["- No item details captured"];

  return [
    `Order ID: ${formatOrderId(order)}`,
    `Placed: ${formatCaptureDate(order.created_at)} ${formatCaptureTime(order.created_at)}`,
    `Customer: ${getOrderCustomerLabel(order)}`,
    `Order: ${order.order_summary}`,
    `Payment status: ${order.payment_status}`,
    `Fulfillment: ${isActiveOrder(order) ? "In progress" : "Completed"}`,
    `Total: ${formatAmount(order.total_amount, order.currency)}`,
    "",
    "Items:",
    ...itemLines,
    "",
    "Payment proof: uploaded in zorder"
  ];
}

export function wrapPdfTextLine(line: string, maxLength: number) {
  if (!line || line.length <= maxLength) {
    return [line];
  }

  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    const breakpoint = remaining.lastIndexOf(" ", maxLength);
    const nextIndex = breakpoint > 24 ? breakpoint : maxLength;
    chunks.push(remaining.slice(0, nextIndex).trim());
    remaining = remaining.slice(nextIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

export function escapePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function isPaymentProofImage(value: string) {
  return value.trim().startsWith("data:image/");
}

export function isPaymentProofPdf(value: string) {
  return value.trim().toLowerCase().startsWith("data:application/pdf");
}

export function formatPaynowNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("65") && digits.length === 10 ? digits.slice(2) : digits;

  if (localDigits.length === 8) {
    return `${localDigits.slice(0, 4)} ${localDigits.slice(4)}`;
  }

  return value.trim();
}

export function buildBrandingSavePayload(source: ShopBranding): ShopBranding {
  return {
    business_name: source.business_name.trim(),
    mark_letter: source.mark_letter.trim(),
    tagline: source.tagline.trim(),
    description: source.description.trim(),
    payment_instructions: source.payment_instructions.trim(),
    paynow_number: source.paynow_number.trim(),
    paynow_qr_image: source.paynow_qr_image,
    bank_name: source.bank_name.trim(),
    bank_account_name: source.bank_account_name.trim(),
    bank_account_number: source.bank_account_number.trim(),
    footer_note: source.footer_note.trim()
  };
}

export function isBrandingDraftReadyToSave(source: ShopBranding) {
  const payload = buildBrandingSavePayload(source);
  const hasPayNowDetails = Boolean(payload.paynow_number || payload.paynow_qr_image);
  const hasBankTransferDetails = Boolean(
    payload.bank_name && payload.bank_account_name && payload.bank_account_number
  );

  return Boolean(
    payload.business_name &&
      payload.mark_letter &&
      payload.tagline &&
      payload.description &&
      payload.payment_instructions &&
      hasPayNowDetails &&
      hasBankTransferDetails
  );
}

export function buildAcceptedPaymentMethods(shopBranding: ShopBranding) {
  const methods: string[] = [];

  if (shopBranding.paynow_number.trim() || shopBranding.paynow_qr_image.trim()) {
    methods.push("PayNow");
  }

  if (
    shopBranding.bank_name.trim() ||
    shopBranding.bank_account_name.trim() ||
    shopBranding.bank_account_number.trim()
  ) {
    methods.push("Bank transfer");
  }

  return methods.length ? methods : ["PayNow", "Bank transfer"];
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function paymentProofFileToDataUrl(file: File) {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isImage && !isPdf) {
    throw new Error("Upload an image or PDF file for your payment proof.");
  }

  const dataUrl = isImage ? await imageFileToDataUrl(file) : await fileToDataUrl(file);

  if (dataUrl.length > maxPaymentProofPayloadLength) {
    throw new Error("Payment proof is too large. Upload a smaller image or PDF.");
  }

  return dataUrl;
}

export async function productImageFileToDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Upload an image file for the product photo.");
  }

  const dataUrl = await imageFileToDataUrl(file);
  if (dataUrl.length > maxProductImagePayloadLength) {
    throw new Error("Product image is too large. Upload a smaller image.");
  }

  return dataUrl;
}

export async function imageFileToDataUrl(file: File) {
  if (!("createImageBitmap" in window)) {
    return fileToDataUrl(file);
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSize = 420;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return fileToDataUrl(file);
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch {
    return fileToDataUrl(file);
  }
}

export type BarcodeDetectionResult = {
  rawValue?: string;
};

export type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect(image: ImageBitmapSource): Promise<BarcodeDetectionResult[]>;
};

export async function readQrTextFromImage(file: File) {
  const barcodeWindow = window as unknown as {
    BarcodeDetector?: BarcodeDetectorConstructor;
  };

  if (!barcodeWindow.BarcodeDetector || !("createImageBitmap" in window)) {
    return null;
  }

  const detector = new barcodeWindow.BarcodeDetector({ formats: ["qr_code"] });
  const bitmap = await createImageBitmap(file);

  try {
    const detected = await detector.detect(bitmap);
    return detected[0]?.rawValue ?? null;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

export function extractPayNowNumberFromQrText(value: string) {
  const match = value.match(/(?:\+?65[\s-]?)?[689]\d{3}[\s-]?\d{4}/);

  if (!match) {
    return null;
  }

  return formatPaynowNumber(match[0]);
}

export function formatCompactNumber(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000) {
    return `${sign}${trimCompactDecimal(absolute / 1_000_000)}M`;
  }

  if (absolute >= 1_000) {
    return `${sign}${trimCompactDecimal(absolute / 1_000)}K`;
  }

  return new Intl.NumberFormat("en-SG").format(value);
}

export function formatCompactAmount(value: number | null, currency: string) {
  if (value === null) {
    return "Not set";
  }

  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = currency === "SGD" ? "$" : `${currency} `;

  if (absolute >= 1_000_000) {
    return `${sign}${prefix}${trimCompactDecimal(absolute / 1_000_000)}M`;
  }

  if (absolute >= 1_000) {
    return `${sign}${prefix}${trimCompactDecimal(absolute / 1_000)}K`;
  }

  return formatAmount(value, currency);
}

export function trimCompactDecimal(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
}

export function formatCaptureDate(value: string) {
  const date = toValidDate(value);
  return date ? captureDateFormatter.format(date) : "No date";
}

export function formatCaptureTime(value: string) {
  const date = toValidDate(value);
  return date ? captureTimeFormatter.format(date) : "No time";
}

export function formatChatTime(value: string) {
  const date = toValidDate(value);
  return date ? captureTimeFormatter.format(date) : "";
}

export function getCaptureDateKey(value: string | Date) {
  const date = toValidDate(value);
  if (!date) {
    return "unknown-date";
  }

  const parts = captureDateKeyFormatter.formatToParts(date);
  const partValue = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
}

export function getCaptureYearKey(value: string | Date) {
  const date = toValidDate(value);
  if (!date) {
    return "unknown-year";
  }

  const parts = captureDateKeyFormatter.formatToParts(date);
  return parts.find((part) => part.type === "year")?.value ?? "unknown-year";
}

export function toValidDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useStateValue<T>(initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  return useState(initialValue);
}

export function getAuthModeFromUrl(): AuthMode {
  return new URLSearchParams(window.location.search).get("mode") === "sign-up" ? "sign-up" : "sign-in";
}

export function getInitialRoute(): AppRoute {
  const path = window.location.pathname;
  if (path.startsWith("/user/login") || path.startsWith("/login")) {
    return "login";
  }
  if (path.startsWith("/intro")) {
    return "intro";
  }
  if (path.startsWith("/tech-stack")) {
    return "tech-stack";
  }
  if (path.startsWith("/why-zo-computer")) {
    return "why-zo-computer";
  }
  if (path.startsWith("/admin")) {
    return "admin";
  }
  return "user";
}

export function routePath(route: AppRoute) {
  if (route === "intro") {
    return "/intro";
  }
  if (route === "login") {
    return "/login";
  }
  if (route === "tech-stack") {
    return "/tech-stack";
  }
  if (route === "why-zo-computer") {
    return "/why-zo-computer";
  }
  return route === "admin" ? "/admin" : "/user";
}

export function getInitialAdminTab(): AdminTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (tab === "workflow" || tab === "runtime") {
    return "rules";
  }
  if (tab === "data") {
    return "orders";
  }

  return isAdminTab(tab) ? tab : "orders";
}

export function isAdminTab(value: string | null): value is AdminTab {
  return value === "orders" || value === "rules" || value === "inventory" || value === "branding";
}

export function adminTabPath(tab: AdminTab) {
  return `/admin?tab=${tab}`;
}

export function authStorageKey(role: AuthRole) {
  return `zorder:${role}:auth`;
}

export function loadAuthState(): AuthState {
  return {
    user: readAuthCredential("user"),
    admin: readAuthCredential("admin")
  };
}

export function readAuthCredential(role: AuthRole): AuthCredential | null {
  const stored = localStorage.getItem(authStorageKey(role));
  if (!stored) {
    return null;
  }

  try {
    const credential = JSON.parse(stored) as Partial<AuthCredential>;
    if (typeof credential.username === "string" && /^\d{6}$/.test(credential.pin ?? "")) {
      return {
        username: credential.username,
        pin: credential.pin as string
      };
    }
  } catch {
    localStorage.removeItem(authStorageKey(role));
  }

  return null;
}

export function authHeaders(role: AuthRole, credential: AuthCredential) {
  return {
    "x-zorder-role": role,
    "x-zorder-username": credential.username,
    "x-zorder-pin": credential.pin
  };
}

export function getOrderAccess(auth: AuthState): AuthAccess | null {
  if (auth.user) {
    return {
      role: "user",
      credential: auth.user
    };
  }

  if (auth.admin) {
    return {
      role: "admin",
      credential: auth.admin
    };
  }

  return null;
}

export async function fetchOrders(access: AuthAccess): Promise<ProcessedOrder[]> {
  const response = await fetch(`${apiBase}/orders`, {
    headers: authHeaders(access.role, access.credential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { orders: ProcessedOrder[] };
  return payload.orders;
}

export async function completeOrder(adminCredential: AuthCredential, orderId: string): Promise<ProcessedOrder> {
  const response = await fetch(`${apiBase}/orders/${orderId}/complete`, {
    method: "PATCH",
    headers: authHeaders("admin", adminCredential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { order: ProcessedOrder };
  return payload.order;
}

export async function fetchInventory(adminCredential: AuthCredential): Promise<InventorySnapshot> {
  const response = await fetch(`${apiBase}/inventory`, {
    headers: authHeaders("admin", adminCredential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as InventorySnapshot;
}

export async function uploadInventory(adminCredential: AuthCredential, products: InventoryProduct[]) {
  const response = await fetch(`${apiBase}/inventory/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("admin", adminCredential)
    },
    body: JSON.stringify({ products })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { imported: number; products: InventoryProduct[] };
}

export async function updateInventoryProduct(
  adminCredential: AuthCredential,
  productId: string,
  product: InventoryProduct
) {
  const response = await fetch(`${apiBase}/inventory/products/${encodeURIComponent(productId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("admin", adminCredential)
    },
    body: JSON.stringify(product)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { product: InventoryProduct };
}

export async function deleteInventoryProduct(adminCredential: AuthCredential, productId: string) {
  const response = await fetch(`${apiBase}/inventory/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: authHeaders("admin", adminCredential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function fetchMenuPreview(): Promise<InventoryProduct[]> {
  try {
    const response = await fetch(`${apiBase}/menu/preview`);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { products?: InventoryProduct[] };
    return payload.products ?? [];
  } catch {
    return [];
  }
}

export async function fetchDemoLoginCredentials(): Promise<DemoLoginCredential[]> {
  try {
    const response = await fetch(`${apiBase}/auth/demo-credentials`);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { credentials?: DemoLoginCredential[] };
    return payload.credentials ?? [];
  } catch {
    return [];
  }
}

export async function fetchShopConfig(): Promise<ShopBranding> {
  try {
    const response = await fetch(`${apiBase}/config/shop`);
    if (!response.ok) {
      throw new Error("Could not load shop branding");
    }

    const payload = (await response.json()) as Partial<ShopBranding>;
    return {
      ...defaultShopBranding,
      ...payload,
      payment_instructions: payload.payment_instructions ?? defaultShopBranding.payment_instructions
    };
  } catch {
    return defaultShopBranding;
  }
}

export async function fetchUserProfile(credential: AuthCredential): Promise<UserProfile> {
  const response = await fetch(`${apiBase}/auth/profile`, {
    headers: authHeaders("user", credential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as UserProfile;
}

export async function saveUserProfile(
  credential: AuthCredential,
  profile: Pick<UserProfile, "first_name" | "last_name" | "email" | "contact">
): Promise<UserProfile> {
  const response = await fetch(`${apiBase}/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("user", credential)
    },
    body: JSON.stringify(profile)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as UserProfile;
}

export async function changeUserPassword(credential: AuthCredential, currentPin: string, newPin: string) {
  const response = await fetch(`${apiBase}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("user", credential)
    },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export function formatUsernameLabel(username: string) {
  if (!username.trim()) {
    return "there";
  }

  return username.charAt(0).toUpperCase() + username.slice(1);
}

export function inferEmailFromUsername(username: string) {
  const trimmedUsername = username.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUsername) ? trimmedUsername : "";
}

export async function fetchCustomerMenu(credential: AuthCredential): Promise<CustomerMenuSnapshot> {
  const response = await fetch(`${apiBase}/menu`, {
    headers: authHeaders("user", credential)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as CustomerMenuSnapshot;
}

export async function placeCustomerOrder(
  credential: AuthCredential,
  payload: {
    items: Array<{ product_id: string; quantity: number }>;
    payment_evidence: string;
    notes: string;
  }
): Promise<PlaceOrderResult> {
  const response = await fetch(`${apiBase}/orders/place`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("user", credential)
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PlaceOrderResult;
}

export async function publishWorkflow(credential: AuthCredential, workflow: WorkflowGeneration["workflow"]) {
  const response = await fetch(`${apiBase}/workflows/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders("admin", credential)
    },
    body: JSON.stringify({ workflow })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export function groupMenuProducts(products: InventoryProduct[]) {
  const grouped = new Map<string, InventoryProduct[]>();

  for (const product of products) {
    const category = product.category.trim() || "Menu";
    grouped.set(category, [...(grouped.get(category) ?? []), product]);
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
}
