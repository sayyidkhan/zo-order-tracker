import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(backendDir, "..");
const envPath = path.join(rootDir, ".env");
const legacyEnvPath = path.join(backendDir, ".env");
const examplePath = path.join(rootDir, ".env.example");
const legacyExamplePath = path.join(backendDir, ".env.example");

const args = parseArgs(process.argv.slice(2));
const isCi = Boolean(args.ci);
const deprecatedEnvKeys = [
  "ACTIVE_WORKFLOW_ID",
  "AI_SETUP_ENABLED",
  "GPT-API-KEY",
  "GPT_API_KEY",
  "PORT",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "USE_OPENAI_WORKFLOW_BUILDER"
];

const envFields = [
  {
    key: "NODE_ENV",
    flag: "node-env",
    prompt: "Node environment",
    defaultValue: "development"
  },
  {
    key: "ZORDER_BACKEND_PORT",
    flag: "backend-port",
    prompt: "Internal backend port",
    defaultValue: "4000"
  },
  {
    key: "DATABASE_URL",
    flag: "database-url",
    prompt: "SQLite database URL",
    defaultValue: "file:./data/zorder.sqlite"
  },
  {
    key: "ZORDER_USER_USERNAME",
    flag: "user-username",
    prompt: "Demo user username",
    defaultValue: "user"
  },
  {
    key: "ZORDER_USER_PIN",
    flag: "user-pin",
    prompt: "Demo user 6-digit PIN",
    defaultValue: "123456",
    secret: true,
    validate: validatePin
  },
  {
    key: "ZORDER_USER_EMAIL",
    flag: "user-email",
    prompt: "Demo user email",
    defaultValue: "user@example.com"
  },
  {
    key: "ZORDER_ADMIN_USERNAME",
    flag: "admin-username",
    prompt: "Admin username",
    defaultValue: "admin"
  },
  {
    key: "ZORDER_ADMIN_PIN",
    flag: "admin-pin",
    prompt: "Admin 6-digit PIN",
    defaultValue: "654321",
    secret: true,
    validate: validatePin
  },
  {
    key: "WORKFLOW_BUILDER_MODE",
    flag: "workflow-builder-mode",
    prompt: "Workflow builder mode",
    defaultValue: "local",
    validate: validateWorkflowBuilderMode
  },
  {
    key: "OPENAI_API_KEY",
    flag: "openai-api-key",
    prompt: "OpenAI API key for setup-only workflow generation",
    defaultValue: "",
    secret: true,
    optional: true,
    commentedWhenEmpty: true
  }
];

let envText = readInitialEnv();
for (const key of deprecatedEnvKeys) {
  envText = removeEnvKey(envText, key);
}
const currentEnv = parseEnv(envText);
const rl = isCi ? null : readline.createInterface({ input, output });
const updatedKeys = [];

try {
  for (const field of envFields) {
    const value = await resolveValue(field);
    envText = upsertEnv(envText, field.key, value, { commentedWhenEmpty: field.commentedWhenEmpty });
    updatedKeys.push(`${field.key}=${field.secret ? maskSecret(value) : value}`);
  }

  fs.writeFileSync(envPath, ensureTrailingNewline(envText), "utf8");
  console.log(`Updated ${path.relative(process.cwd(), envPath)}`);
  console.log(updatedKeys.join("\n"));
} finally {
  rl?.close();
}

async function resolveValue(field) {
  const envValue = process.env[field.key];
  const existingValue = currentEnv[field.key];
  const flagValue = args[field.flag] ?? args[field.key];
  const defaultValue = existingValue ?? envValue ?? field.defaultValue ?? "";

  if (flagValue !== undefined) {
    return validateValue(field, flagValue);
  }

  if (isCi) {
    return validateValue(field, defaultValue);
  }

  const suffix = field.optional ? " (optional)" : "";
  const displayDefault = field.secret ? maskSecret(defaultValue) : defaultValue;
  const answer = await rl.question(`${field.prompt}${suffix} [${displayDefault}]: `);
  return validateValue(field, answer.trim() || defaultValue);
}

function validateValue(field, value) {
  if (field.validate) {
    field.validate(value, field.key);
  }

  return value;
}

function validatePin(value, key) {
  if (!/^\d{6}$/.test(value)) {
    throw new Error(`${key} must be exactly 6 digits`);
  }
}

function validateWorkflowBuilderMode(value, key) {
  if (!["local", "openai"].includes(value)) {
    throw new Error(`${key} must be "local" or "openai"`);
  }
}

function readInitialEnv() {
  if (fs.existsSync(envPath)) {
    return fs.readFileSync(envPath, "utf8");
  }

  if (fs.existsSync(legacyEnvPath)) {
    return fs.readFileSync(legacyEnvPath, "utf8");
  }

  if (fs.existsSync(examplePath)) {
    return fs.readFileSync(examplePath, "utf8");
  }

  if (fs.existsSync(legacyExamplePath)) {
    return fs.readFileSync(legacyExamplePath, "utf8");
  }

  return "";
}

function parseArgs(argv) {
  return argv.reduce((current, arg) => {
    if (arg === "--ci") {
      current.ci = true;
      return current;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      current[match[1]] = match[2];
    }

    return current;
  }, {});
}

function parseEnv(text) {
  return text.split("\n").reduce((current, line) => {
    const match = line.match(/^\s*([A-Z0-9_-]+)=(.*)$/);
    if (match) {
      current[match[1]] = unquoteValue(match[2].trim());
    }

    return current;
  }, {});
}

function upsertEnv(text, key, value, options = {}) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = options.commentedWhenEmpty && !value ? "# " : "";
  const line = `${prefix}${key}=${formatEnvValue(value)}`;
  const pattern = new RegExp(`^#?\\s*${escapedKey}=.*$`, "m");

  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }

  return `${ensureTrailingNewline(text)}${line}\n`;
}

function removeEnvKey(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^#?\\s*${escapedKey}=.*\\n?`, "gm"), "");
}

function formatEnvValue(value) {
  if (!/[#\s"'\\]/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function unquoteValue(value) {
  if (!value) {
    return "";
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function maskSecret(value) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}
