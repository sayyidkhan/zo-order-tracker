import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const defaultDbPath = path.join(dataDir, "zorder.sqlite");
const dbPath = resolveDatabasePath(process.env.DATABASE_URL ?? `file:${defaultDbPath}`);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

createSchema();

export function listOrders({ username = null } = {}) {
  const orders = db
    .prepare(
      username
        ? `SELECT id, customer_name, customer_handle, source_channel, source_input, order_summary,
                  payment_status, fulfillment_status, total_amount, currency, evidence, created_at, placed_by_username
             FROM orders
            WHERE placed_by_username = ?
            ORDER BY datetime(created_at) DESC`
        : `SELECT id, customer_name, customer_handle, source_channel, source_input, order_summary,
                  payment_status, fulfillment_status, total_amount, currency, evidence, created_at, placed_by_username
             FROM orders
            ORDER BY datetime(created_at) DESC`
    )
    .all(...(username ? [username] : []));

  const itemsByOrder = db
    .prepare(
      `SELECT order_id, item_name, quantity, unit_price, notes
         FROM order_items
        ORDER BY rowid ASC`
    )
    .all()
    .reduce((current, item) => {
      const nextItem = {
        item_name: item.item_name,
        quantity: Number(item.quantity),
        unit_price: nullableNumber(item.unit_price),
        notes: item.notes
      };

      current.set(item.order_id, [...(current.get(item.order_id) ?? []), nextItem]);
      return current;
    }, new Map());

  return orders.map((order) => ({
    id: order.id,
    customer_name: order.customer_name,
    customer_handle: order.customer_handle,
    source_channel: order.source_channel,
    source_input: order.source_input,
    order_summary: order.order_summary,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status ?? "active",
    total_amount: nullableNumber(order.total_amount),
    currency: order.currency,
    items: itemsByOrder.get(order.id) ?? [],
    evidence: order.evidence,
    placed_by_username: order.placed_by_username,
    created_at: order.created_at
  }));
}

export function listActiveMenuProducts() {
  return listInventoryProducts().filter((product) => product.is_active);
}

export function saveOrder(order, { placedByUsername = null } = {}) {
  const orderId = randomUUID();
  const insertOrder = db.prepare(
    `INSERT INTO orders (
       id, customer_name, customer_handle, source_channel, source_input, order_summary,
       payment_status, fulfillment_status, total_amount, currency, evidence, placed_by_username, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (id, order_id, item_name, quantity, unit_price, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  runTransaction(() => {
    insertOrder.run(
      orderId,
      order.customer_name,
      order.customer_handle,
      order.source_channel,
      order.source_input,
      order.order_summary,
      order.payment_status,
      order.fulfillment_status ?? "active",
      order.total_amount,
      order.currency,
      order.evidence,
      placedByUsername,
      order.created_at ?? new Date().toISOString()
    );

    for (const item of order.items) {
      insertItem.run(randomUUID(), orderId, item.item_name, item.quantity, item.unit_price, item.notes);
    }
  });

  return orderId;
}

export function completeOrder(orderId) {
  const result = db
    .prepare(
      `UPDATE orders
          SET fulfillment_status = 'completed'
        WHERE id = ?
          AND fulfillment_status = 'active'`
    )
    .run(orderId);

  if (result.changes === 0) {
    return null;
  }

  return listOrders().find((order) => order.id === orderId) ?? null;
}

export function listInventoryProducts() {
  return db
    .prepare(
      `SELECT id, name, category, unit_price, is_active, updated_at
         FROM products
        ORDER BY category ASC, name ASC`
    )
    .all()
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      unit_price: nullableNumber(product.unit_price),
      is_active: Boolean(product.is_active),
      updated_at: product.updated_at
    }));
}

export function upsertInventoryProducts(products) {
  const upsert = db.prepare(
    `INSERT INTO products (id, name, category, unit_price, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       category = excluded.category,
       unit_price = excluded.unit_price,
       is_active = excluded.is_active,
       updated_at = excluded.updated_at`
  );
  const now = new Date().toISOString();
  runTransaction(() => {
    for (const product of products) {
      upsert.run(
        randomUUID(),
        normalizeProductName(product.name),
        product.category,
        product.unit_price,
        product.is_active ? 1 : 0,
        now,
        now
      );
    }
  });

  return listInventoryProducts();
}

export function updateInventoryProduct(productId, product) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE products
          SET name = ?,
              category = ?,
              unit_price = ?,
              is_active = ?,
              updated_at = ?
        WHERE id = ?`
    )
    .run(
      normalizeProductName(product.name),
      product.category,
      product.unit_price,
      product.is_active ? 1 : 0,
      now,
      productId
    );

  if (result.changes === 0) {
    return null;
  }

  return getInventoryProduct(productId);
}

export function deleteInventoryProduct(productId) {
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(productId);
  return result.changes > 0;
}

export function getInventorySnapshot() {
  return {
    products: listInventoryProducts(),
    orders: listOrders()
  };
}

export function seedDemoData({ reset = false } = {}) {
  if (reset) {
    db.exec("DELETE FROM order_items; DELETE FROM orders; DELETE FROM products;");
  }

  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (productCount === 0) {
    upsertInventoryProducts(seedProducts);
  }

  const orderCount = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  if (orderCount === 0) {
    for (const order of seedOrders) {
      saveOrder(order);
    }
  }

  return getInventorySnapshot();
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      unit_price REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_handle TEXT,
      source_channel TEXT NOT NULL,
      source_input TEXT NOT NULL,
      order_summary TEXT NOT NULL,
      payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'partial', 'unpaid', 'unknown')),
      fulfillment_status TEXT NOT NULL DEFAULT 'active' CHECK (fulfillment_status IN ('active', 'completed')),
      total_amount REAL,
      currency TEXT NOT NULL DEFAULT 'SGD',
      evidence TEXT NOT NULL DEFAULT '',
      placed_by_username TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL,
      notes TEXT
    );
  `);

  ensureOrdersColumn("placed_by_username", "TEXT");
  ensureOrdersColumn("fulfillment_status", "TEXT NOT NULL DEFAULT 'active'");
  db.exec(
    `UPDATE orders
        SET fulfillment_status = 'completed'
      WHERE payment_status = 'paid'
        AND fulfillment_status = 'active'
        AND placed_by_username IS NULL`
  );
}

function ensureOrdersColumn(columnName, columnType) {
  const columns = db.prepare("PRAGMA table_info(orders)").all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE orders ADD COLUMN ${columnName} ${columnType}`);
}

function resolveDatabasePath(databaseUrl) {
  if (databaseUrl.startsWith("file:")) {
    return path.resolve(databaseUrl.replace(/^file:/, ""));
  }

  return path.resolve(databaseUrl);
}

function nullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function getInventoryProduct(productId) {
  const product = db
    .prepare(
      `SELECT id, name, category, unit_price, is_active, updated_at
         FROM products
        WHERE id = ?`
    )
    .get(productId);

  if (!product) {
    return null;
  }

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    unit_price: nullableNumber(product.unit_price),
    is_active: Boolean(product.is_active),
    updated_at: product.updated_at
  };
}

function runTransaction(callback) {
  db.exec("BEGIN");
  try {
    callback();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function normalizeProductName(name) {
  return name.trim().toLowerCase();
}

const seedProducts = [
  {
    name: "egg tarts",
    category: "pastry",
    unit_price: 2,
    is_active: true
  },
  {
    name: "bandung",
    category: "sweet drink",
    unit_price: 3,
    is_active: true
  },
  {
    name: "lemonade",
    category: "sweet drink",
    unit_price: 3,
    is_active: true
  }
];

const seedOrders = [
  {
    customer_name: "Maya Tan",
    customer_handle: "@maya",
    source_channel: "manual",
    source_input: "Maya wants 12 egg tarts and 2 bandung, paid by PayNow",
    order_summary: "12 egg tarts, 2 bandung",
    payment_status: "paid",
    total_amount: 30,
    currency: "SGD",
    items: [
      { item_name: "egg tarts", quantity: 12, unit_price: 2, notes: null },
      { item_name: "bandung", quantity: 2, unit_price: 3, notes: "sweet drink" }
    ],
    evidence: "paid by PayNow",
    created_at: "2026-06-20T02:15:00.000Z"
  },
  {
    customer_name: "Nurul",
    customer_handle: "@nurul",
    source_channel: "manual",
    source_input: "Nurul wants 6 egg tarts and 1 lemonade, bank transfer done",
    order_summary: "6 egg tarts, 1 lemonade",
    payment_status: "paid",
    total_amount: 15,
    currency: "SGD",
    items: [
      { item_name: "egg tarts", quantity: 6, unit_price: 2, notes: null },
      { item_name: "lemonade", quantity: 1, unit_price: 3, notes: "sweet drink" }
    ],
    evidence: "bank transfer done",
    created_at: "2026-06-20T05:00:00.000Z"
  },
  {
    customer_name: "Afiq",
    customer_handle: "@afiq",
    source_channel: "manual",
    source_input: "Afiq wants 4 egg tarts and 2 lemonades, bank transfer done",
    order_summary: "4 egg tarts, 2 lemonades",
    payment_status: "paid",
    total_amount: 14,
    currency: "SGD",
    items: [
      { item_name: "egg tarts", quantity: 4, unit_price: 2, notes: null },
      { item_name: "lemonade", quantity: 2, unit_price: 3, notes: "sweet drink" }
    ],
    evidence: "bank transfer done",
    created_at: "2026-06-19T10:30:00.000Z"
  },
  {
    customer_name: "Jia Wen",
    customer_handle: "@jiawen",
    source_channel: "manual",
    source_input: "Jia Wen wants 3 bandung for pickup, PayNow receipt sent",
    order_summary: "3 bandung",
    payment_status: "paid",
    total_amount: 9,
    currency: "SGD",
    items: [{ item_name: "bandung", quantity: 3, unit_price: 3, notes: "sweet drink" }],
    evidence: "PayNow receipt sent",
    created_at: "2026-06-18T11:20:00.000Z"
  }
];
