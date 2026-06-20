import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { z } from "zod";
import { handleAgentMessage, handleWorkflowSetupMessage } from "./agent-chat.js";
import { generateWorkflow, saveGeneratedWorkflow } from "./workflow-builder.js";
import { loadWorkflow, processOrder, runWorkflow } from "./workflow-runner.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(__dirname, "..", "workflows");
const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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
  paid_phrases: z.array(z.string()).default([]),
  pay_later_phrases: z.array(z.string()).default([]),
  required_fields: z.array(z.string()).default([]),
  workflow_id: z.string().default("generated-order-flow"),
  workflow_name: z.string().default("Generated Order Flow"),
  save: z.boolean().default(false)
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "zorder-api",
    runtime: "express",
    workflow_engine: "deterministic-json"
  });
});

app.get("/workflows/schema", (_req, res, next) => {
  try {
    const schema = JSON.parse(fs.readFileSync(path.join(workflowDir, "workflow-schema.json"), "utf8"));
    res.json(schema);
  } catch (error) {
    next(error);
  }
});

app.get("/workflows/:workflowId", (req, res, next) => {
  try {
    res.json(loadWorkflow(req.params.workflowId));
  } catch (error) {
    next(error);
  }
});

app.post("/workflows/run", (req, res, next) => {
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

app.post("/workflows/generate", async (req, res, next) => {
  try {
    const body = workflowGenerateSchema.parse(req.body);
    const generated = await generateWorkflow({
      businessDescription: body.business_description,
      commonOrderMessages: body.common_order_messages,
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

app.post("/orders/process", (req, res, next) => {
  try {
    const body = orderProcessSchema.parse(req.body);
    const result = processOrder({
      sourceInput: body.source_input,
      sourceChannel: body.source_channel,
      workflowId: body.workflow_id
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/agent/chat", (req, res, next) => {
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

app.post("/agent/setup-workflow", async (req, res, next) => {
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
