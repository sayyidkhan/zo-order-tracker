import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { handleAgentMessage, handleWorkflowSetupMessage } from "./agent-chat.js";
import { generateWorkflow, saveGeneratedWorkflow } from "./workflow-builder.js";
import {
  completeOrder,
  deleteInventoryProduct,
  getInventorySnapshot,
  listActiveMenuProducts,
  listOrders,
  saveOrder,
  updateInventoryProduct,
  upsertInventoryProducts
} from "./data-store.js";
import { placeCustomerOrder } from "./customer-order.js";
import { getAcceptedPaymentMethods, loadShopConfig, saveShopConfig } from "./shop-config.js";
import { createUser, findUserByCredentials, isDemoCredentialUser, normalizeUsername, updateUserPin } from "./user-store.js";
import { formatProfileDisplayName, getUserProfile, saveUserProfile } from "./user-profile.js";
import { loadWorkflow, processOrder, runWorkflow } from "./workflow-runner.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(__dirname, "..", "workflows");
const app = express();
const port = Number(process.env.PORT ?? 4000);
const userCredential = {
  username: process.env.ZORDER_USER_USERNAME ?? "user",
  pin: process.env.ZORDER_USER_PIN ?? "123456"
};
const adminCredential = {
  username: process.env.ZORDER_ADMIN_USERNAME ?? "admin",
  pin: process.env.ZORDER_ADMIN_PIN ?? "654321"
};
const demoUserProfileDefaults = {
  email: process.env.ZORDER_USER_EMAIL ?? "user@example.com"
};

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const orderProcessSchema = z.object({
  source_input: z.string().min(1),
  source_channel: z.string().default("manual"),
  workflow_id: z.string().default("default-order-flow")
});

const workflowRunSchema = orderProcessSchema.extend({
  workflow: z.record(z.unknown()).optional()
});

const agentMessageSchema = z.object({
  message: z.string().default(""),
  state: z.string().default("collect_input"),
  source_channel: z.string().default("manual"),
  workflow_id: z.string().default("default-order-flow")
});

const workflowGenerateSchema = z.object({
  business_description: z.string().min(1),
  common_order_messages: z.array(z.string()).default([]),
  change_request: z.string().default(""),
  existing_workflow: z.record(z.unknown()).nullable().optional(),
  paid_phrases: z.array(z.string()).default([]),
  pay_later_phrases: z.array(z.string()).default([]),
  required_fields: z.array(z.string()).default([]),
  workflow_id: z.string().default("generated-order-flow"),
  workflow_name: z.string().default("Generated Order Flow"),
  save: z.boolean().default(false)
});

const pinSchema = z.string().regex(/^\d{6}$/, "PIN must be 6 digits");
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only use letters, numbers, dots, underscores, and hyphens")
  .transform(normalizeUsername);

const authSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  username: usernameSchema,
  pin: pinSchema
});

const signupSchema = z.object({
  username: usernameSchema,
  pin: pinSchema
});

const inventoryProductSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80).default("inventory"),
  unit_price: z.coerce.number().nonnegative().nullable().default(null),
  is_active: z
    .preprocess((value) => {
      if (typeof value === "string") {
        return !["false", "0", "no", "inactive"].includes(value.trim().toLowerCase());
      }

      return value;
    }, z.boolean())
    .default(true)
});

const inventoryUploadSchema = z.object({
  products: z.array(inventoryProductSchema).min(1)
});

function resolveAuthRole(username, pin, requestedRole) {
  if (requestedRole) {
    return verifyRole(requestedRole, username, pin) ? requestedRole : null;
  }

  if (verifyRole("admin", username, pin)) {
    return "admin";
  }

  if (verifyRole("user", username, pin)) {
    return "user";
  }

  return null;
}

const shopConfigSchema = z.object({
  business_name: z.string().trim().min(1).max(80),
  mark_letter: z.string().trim().min(1).max(2),
  tagline: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  payment_instructions: z.string().trim().min(1).max(1000),
  paynow_number: z.string().trim().max(40).default(""),
  paynow_qr_image: z.string().max(1_500_000).default(""),
  bank_name: z.string().trim().max(80).default(""),
  bank_account_name: z.string().trim().max(120).default(""),
  bank_account_number: z.string().trim().max(80).default("")
});

const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1),
  payment_evidence: z.string().trim().max(1_500_000).default(""),
  notes: z.string().trim().max(500).default("")
});

function verifyRole(role, username, pin) {
  const normalizedUsername = normalizeUsername(username);
  const credential = role === "admin" ? adminCredential : userCredential;

  if (normalizedUsername === normalizeUsername(credential.username) && pin === credential.pin) {
    return true;
  }

  return role === "user" && Boolean(findUserByCredentials(normalizedUsername, pin));
}

function requireAuth(allowedRoles) {
  return (req, res, next) => {
    const role = req.header("x-zorder-role");
    const username = req.header("x-zorder-username");
    const pin = req.header("x-zorder-pin");

    if (!role || !username || !pin || !["user", "admin"].includes(role)) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const isAllowedRole = allowedRoles.includes(role) || (role === "admin" && allowedRoles.includes("user"));

    if (!isAllowedRole || !verifyRole(role, username, pin)) {
      res.status(403).json({ error: "Invalid username or PIN" });
      return;
    }

    req.zorderAuth = { role, username };
    next();
  };
}

function applyUserProfileDefaults(profile, username) {
  if (!isDemoCredentialUser(username)) {
    return profile;
  }

  return {
    ...profile,
    email: profile.email || demoUserProfileDefaults.email
  };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "zorder-api",
    runtime: "express",
    workflow_engine: "deterministic-json"
  });
});

app.post("/auth/login", (req, res, next) => {
  try {
    const body = authSchema.parse(req.body);
    const role = resolveAuthRole(body.username, body.pin, body.role);

    if (!role) {
      res.status(403).json({ error: "Invalid username or PIN" });
      return;
    }

    res.json({
      authenticated: true,
      role
    });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/signup", (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const reservedUsernames = [userCredential.username, adminCredential.username].map(normalizeUsername);

    if (reservedUsernames.includes(body.username)) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    const user = createUser({
      username: body.username,
      pin: body.pin
    });

    res.status(201).json({
      authenticated: true,
      role: "user",
      user
    });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z.object({
  current_pin: pinSchema,
  new_pin: pinSchema
});

const userProfileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().min(1, "Last name is required").max(80),
  email: z.string().trim().min(1, "Email is required").email("Email must be valid").max(120),
  contact: z.string().trim().min(1, "Contact details are required").max(120)
});

app.get("/auth/profile", requireAuth(["user"]), (req, res, next) => {
  try {
    const profile = applyUserProfileDefaults(getUserProfile(req.zorderAuth.username), req.zorderAuth.username);
    const isDemoAccount = isDemoCredentialUser(req.zorderAuth.username);

    res.json({
      ...profile,
      display_name: formatProfileDisplayName(profile, req.zorderAuth.username),
      can_change_password: !isDemoAccount,
      is_demo_account: isDemoAccount
    });
  } catch (error) {
    next(error);
  }
});

app.put("/auth/profile", requireAuth(["user"]), (req, res, next) => {
  try {
    const body = userProfileSchema.parse(req.body);
    const profile = saveUserProfile(req.zorderAuth.username, body);
    const isDemoAccount = isDemoCredentialUser(req.zorderAuth.username);

    res.json({
      ...profile,
      display_name: formatProfileDisplayName(profile, req.zorderAuth.username),
      can_change_password: !isDemoAccount,
      is_demo_account: isDemoAccount
    });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/change-password", requireAuth(["user"]), (req, res, next) => {
  try {
    if (isDemoCredentialUser(req.zorderAuth.username)) {
      res.status(403).json({ error: "This demo account uses the server-configured password" });
      return;
    }

    const body = changePasswordSchema.parse(req.body);
    updateUserPin(req.zorderAuth.username, body.current_pin, body.new_pin);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/config/shop", (_req, res) => {
  res.json(loadShopConfig());
});

app.put("/config/shop", requireAuth(["admin"]), (req, res, next) => {
  try {
    const body = shopConfigSchema.parse(req.body);
    res.json(saveShopConfig(body));
  } catch (error) {
    next(error);
  }
});

app.get("/orders", requireAuth(["user", "admin"]), (req, res, next) => {
  try {
    const username = req.zorderAuth.role === "user" ? req.zorderAuth.username : null;
    res.json({ orders: listOrders({ username }) });
  } catch (error) {
    next(error);
  }
});

app.patch("/orders/:orderId/complete", requireAuth(["admin"]), (req, res, next) => {
  try {
    const order = completeOrder(req.params.orderId);
    if (!order) {
      res.status(404).json({ error: "Active order not found" });
      return;
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

app.get("/menu", requireAuth(["user"]), (_req, res, next) => {
  try {
    const shopConfig = loadShopConfig();

    res.json({
      products: listActiveMenuProducts(),
      payment_methods: getAcceptedPaymentMethods(shopConfig)
    });
  } catch (error) {
    next(error);
  }
});

app.post("/orders/place", requireAuth(["user"]), (req, res, next) => {
  try {
    const body = placeOrderSchema.parse(req.body);
    const products = listActiveMenuProducts();
    const items = body.items.map((line) => {
      const product = products.find((candidate) => candidate.id === line.product_id);

      if (!product) {
        const error = new Error(`Product not found: ${line.product_id}`);
        error.statusCode = 404;
        throw error;
      }

      return {
        item_name: product.name,
        quantity: line.quantity,
        unit_price: product.unit_price,
        notes: product.category
      };
    });

    const result = placeCustomerOrder({
      username: req.zorderAuth.username,
      items,
      paymentEvidence: body.payment_evidence,
      notes: body.notes
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/inventory", requireAuth(["admin"]), (_req, res, next) => {
  try {
    res.json(getInventorySnapshot());
  } catch (error) {
    next(error);
  }
});

app.post("/inventory/upload", requireAuth(["admin"]), (req, res, next) => {
  try {
    const body = inventoryUploadSchema.parse(req.body);
    const products = upsertInventoryProducts(body.products);

    res.json({
      imported: body.products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});

app.put("/inventory/products/:productId", requireAuth(["admin"]), (req, res, next) => {
  try {
    const body = inventoryProductSchema.parse(req.body);
    const product = updateInventoryProduct(req.params.productId, body);

    if (!product) {
      res.status(404).json({ error: "Inventory product not found" });
      return;
    }

    res.json({ product });
  } catch (error) {
    next(error);
  }
});

app.delete("/inventory/products/:productId", requireAuth(["admin"]), (req, res, next) => {
  try {
    const deleted = deleteInventoryProduct(req.params.productId);

    if (!deleted) {
      res.status(404).json({ error: "Inventory product not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/workflows/schema", requireAuth(["admin"]), (_req, res, next) => {
  try {
    const schema = JSON.parse(fs.readFileSync(path.join(workflowDir, "workflow-schema.json"), "utf8"));
    res.json(schema);
  } catch (error) {
    next(error);
  }
});

app.get("/workflows/:workflowId", requireAuth(["admin"]), (req, res, next) => {
  try {
    res.json(loadWorkflow(req.params.workflowId));
  } catch (error) {
    next(error);
  }
});

app.post("/workflows/run", requireAuth(["admin"]), (req, res, next) => {
  try {
    const body = workflowRunSchema.parse(req.body);
    const result = body.workflow
      ? runWorkflow({
          workflow: body.workflow,
          sourceInput: body.source_input,
          sourceChannel: body.source_channel
        })
      : processOrder({
          sourceInput: body.source_input,
          sourceChannel: body.source_channel,
          workflowId: body.workflow_id
        });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/workflows/generate", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const body = workflowGenerateSchema.parse(req.body);
    const generated = await generateWorkflow({
      businessDescription: body.business_description,
      changeRequest: body.change_request,
      commonOrderMessages: body.common_order_messages,
      existingWorkflow: body.existing_workflow,
      paidPhrases: body.paid_phrases,
      payLaterPhrases: body.pay_later_phrases,
      requiredFields: body.required_fields,
      workflowId: body.workflow_id,
      workflowName: body.workflow_name
    });

    const saved = body.save ? saveGeneratedWorkflow(generated.workflow) : null;

    res.json({
      status: saved ? "generated_and_saved" : "generated",
      saved,
      ...generated
    });
  } catch (error) {
    next(error);
  }
});

app.post("/workflows/publish", requireAuth(["admin"]), (req, res, next) => {
  try {
    const workflow = req.body?.workflow;
    if (!workflow || typeof workflow !== "object") {
      res.status(400).json({ error: "Workflow JSON is required" });
      return;
    }

    const saved = saveGeneratedWorkflow(workflow);
    res.json({
      status: "published",
      saved
    });
  } catch (error) {
    next(error);
  }
});

app.post("/orders/process", requireAuth(["user"]), (req, res, next) => {
  try {
    const body = orderProcessSchema.parse(req.body);
    const result = processOrder({
      sourceInput: body.source_input,
      sourceChannel: body.source_channel,
      workflowId: body.workflow_id
    });

    if (result.order?.payment_status === "paid") {
      saveOrder(result.order, { placedByUsername: req.zorderAuth.username });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/agent/chat", requireAuth(["user"]), (req, res, next) => {
  try {
    const body = agentMessageSchema.parse(req.body);
    const result = handleAgentMessage({
      message: body.message,
      state: body.state,
      sourceChannel: body.source_channel,
      workflowId: body.workflow_id
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/agent/setup-workflow", requireAuth(["admin"]), async (req, res, next) => {
  try {
    const body = workflowGenerateSchema.parse(req.body);
    const result = await handleWorkflowSetupMessage({
      businessDescription: body.business_description,
      commonOrderMessages: body.common_order_messages,
      paidPhrases: body.paid_phrases,
      payLaterPhrases: body.pay_later_phrases,
      requiredFields: body.required_fields,
      workflowId: body.workflow_id,
      workflowName: body.workflow_name
    });

    const saved = body.save ? saveGeneratedWorkflow(result.result.workflow) : null;

    res.json({
      ...result,
      saved
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "Invalid request",
      issues: error.issues
    });
    return;
  }

  res.status(error.statusCode ?? 500).json({
    error: error.message ?? "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`zorder API listening on http://localhost:${port}`);
});
