import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const envPath = path.join(backendDir, ".env");
const examplePath = path.join(backendDir, ".env.example");

const args = parseArgs(process.argv.slice(2));
const useRandom = Boolean(args.random);

if (!fs.existsSync(envPath)) {
  const template = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, "utf8") : "";
  fs.writeFileSync(envPath, template, "utf8");
}

let envText = fs.readFileSync(envPath, "utf8");
const existingEnv = parseEnv(envText);
const userUsername = args["user-username"] ?? existingEnv.ZORDER_USER_USERNAME ?? process.env.ZORDER_USER_USERNAME ?? "user";
const adminUsername =
  args["admin-username"] ?? existingEnv.ZORDER_ADMIN_USERNAME ?? process.env.ZORDER_ADMIN_USERNAME ?? "admin";
const userPin = normalizePin(
  args["user-pin"] ?? args["user-passcode"] ?? existingEnv.ZORDER_USER_PIN ?? process.env.ZORDER_USER_PIN ?? defaultPin("user"),
  "user"
);
const adminPin = normalizePin(
  args["admin-pin"] ??
    args["admin-passcode"] ??
    existingEnv.ZORDER_ADMIN_PIN ??
    process.env.ZORDER_ADMIN_PIN ??
    defaultPin("admin"),
  "admin"
);

envText = upsertEnv(envText, "ZORDER_USER_USERNAME", userUsername);
envText = upsertEnv(envText, "ZORDER_USER_PIN", userPin);
envText = upsertEnv(envText, "ZORDER_ADMIN_USERNAME", adminUsername);
envText = upsertEnv(envText, "ZORDER_ADMIN_PIN", adminPin);
envText = removeEnv(envText, "ZORDER_USER_PASSCODE");
envText = removeEnv(envText, "ZORDER_ADMIN_PASSCODE");
fs.writeFileSync(envPath, ensureTrailingNewline(envText), "utf8");

console.log("Seeded MVP auth users in backend/.env");
console.log(`User login: ${userUsername} / ${userPin}`);
console.log(`Admin login: ${adminUsername} / ${adminPin}`);

function parseArgs(argv) {
  return argv.reduce((current, arg) => {
    if (arg === "--random") {
      current.random = true;
      return current;
    }

    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      current[match[1]] = match[2];
    }

    return current;
  }, {});
}

function upsertEnv(text, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${escapedKey}=.*$`, "m");

  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }

  return `${ensureTrailingNewline(text)}${line}\n`;
}

function removeEnv(text, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedKey}=.*\\n?`, "m");

  return text.replace(pattern, "");
}

function parseEnv(text) {
  return text.split("\n").reduce((current, line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      current[match[1]] = match[2];
    }

    return current;
  }, {});
}

function defaultPin(role) {
  if (useRandom) {
    return randomPin();
  }

  return role === "admin" ? "654321" : "123456";
}

function normalizePin(pin, role) {
  if (/^\d{6}$/.test(pin)) {
    return pin;
  }

  throw new Error(`${role} PIN must be exactly 6 digits`);
}

function randomPin() {
  return String(crypto.randomInt(100000, 1000000));
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}
