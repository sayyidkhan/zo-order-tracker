import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const dataDir = path.resolve(__dirname, "..", "data");
const defaultDbPath = path.join(dataDir, "zorder.sqlite");
const dbPath = resolveDatabasePath(process.env.DATABASE_URL ?? `file:${defaultDbPath}`);
const legacyConfigPath = path.resolve(__dirname, "..", "config", "shop.json");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

export const defaultShopConfig = {
  business_name: "zorder",
  mark_letter: "Z",
  tagline: "What would you like to order today?",
  description: "Browse the menu, place your order, and pay by PayNow or bank transfer.",
  payment_instructions:
    "Pay by PayNow or bank transfer. After paying, paste your reference number or receipt note when you place the order.",
  paynow_number: "9123 4567",
  paynow_qr_image: "",
  bank_name: "DBS Bank",
  bank_account_name: "Zorder Dessert Stall",
  bank_account_number: "001-234567-8",
  footer_note: ""
};

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
  bank_account_number: z.string().trim().max(80).default(""),
  footer_note: z.string().trim().max(200).default("")
});

createShopConfigSchema();

export function loadShopConfig() {
  const row = db
    .prepare(
      `SELECT business_name, mark_letter, tagline, description, payment_instructions,
              paynow_number, paynow_qr_image, bank_name, bank_account_name, bank_account_number,
              footer_note
         FROM shop_config
        WHERE id = 'default'`
    )
    .get();

  if (row) {
    return parseShopConfig(row);
  }

  const migrated = loadLegacyConfig();
  return saveShopConfig(migrated ?? defaultShopConfig);
}

export function saveShopConfig(config) {
  const parsed = parseShopConfig(config);
  db.prepare(
    `INSERT INTO shop_config (
       id, business_name, mark_letter, tagline, description, payment_instructions,
       paynow_number, paynow_qr_image, bank_name, bank_account_name, bank_account_number,
       footer_note, updated_at
     )
     VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       business_name = excluded.business_name,
       mark_letter = excluded.mark_letter,
       tagline = excluded.tagline,
       description = excluded.description,
       payment_instructions = excluded.payment_instructions,
       paynow_number = excluded.paynow_number,
       paynow_qr_image = excluded.paynow_qr_image,
       bank_name = excluded.bank_name,
       bank_account_name = excluded.bank_account_name,
       bank_account_number = excluded.bank_account_number,
       footer_note = excluded.footer_note,
       updated_at = excluded.updated_at`
  ).run(
    parsed.business_name,
    parsed.mark_letter,
    parsed.tagline,
    parsed.description,
    parsed.payment_instructions,
    parsed.paynow_number,
    parsed.paynow_qr_image,
    parsed.bank_name,
    parsed.bank_account_name,
    parsed.bank_account_number,
    parsed.footer_note,
    new Date().toISOString()
  );

  return parsed;
}

export function seedDemoShopConfig() {
  return saveShopConfig(defaultShopConfig);
}

export function getAcceptedPaymentMethods(config) {
  const methods = [];

  if (config.paynow_number || config.paynow_qr_image) {
    methods.push("PayNow");
  }

  if (config.bank_name || config.bank_account_name || config.bank_account_number) {
    methods.push("Bank transfer");
  }

  return methods.length ? methods : ["PayNow", "Bank transfer"];
}

function createShopConfigSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_config (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      mark_letter TEXT NOT NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      payment_instructions TEXT NOT NULL,
      paynow_number TEXT NOT NULL DEFAULT '',
      paynow_qr_image TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      bank_account_name TEXT NOT NULL DEFAULT '',
      bank_account_number TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);

  ensureShopConfigColumn("paynow_number", "TEXT NOT NULL DEFAULT ''");
  ensureShopConfigColumn("paynow_qr_image", "TEXT NOT NULL DEFAULT ''");
  ensureShopConfigColumn("bank_name", "TEXT NOT NULL DEFAULT ''");
  ensureShopConfigColumn("bank_account_name", "TEXT NOT NULL DEFAULT ''");
  ensureShopConfigColumn("bank_account_number", "TEXT NOT NULL DEFAULT ''");
  ensureShopConfigColumn("footer_note", "TEXT NOT NULL DEFAULT ''");
}

function ensureShopConfigColumn(columnName, columnType) {
  const columns = db.prepare("PRAGMA table_info(shop_config)").all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE shop_config ADD COLUMN ${columnName} ${columnType}`);
}

function parseShopConfig(config) {
  return shopConfigSchema.parse({
    ...defaultShopConfig,
    ...config
  });
}

function loadLegacyConfig() {
  try {
    if (fs.existsSync(legacyConfigPath)) {
      return parseShopConfig(JSON.parse(fs.readFileSync(legacyConfigPath, "utf8")));
    }
  } catch {
    // Fall back to seeded defaults when the old JSON config is missing or invalid.
  }

  return null;
}

function resolveDatabasePath(databaseUrl) {
  if (databaseUrl.startsWith("file:")) {
    return resolveBackendPath(databaseUrl.replace(/^file:/, ""));
  }

  return resolveBackendPath(databaseUrl);
}

function resolveBackendPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(backendDir, filePath);
}
