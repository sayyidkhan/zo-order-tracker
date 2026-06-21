import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const dataDir = path.resolve(__dirname, "..", "data");
const defaultDbPath = path.join(dataDir, "zorder.sqlite");
const dbPath = resolveDatabasePath(process.env.DATABASE_URL ?? `file:${defaultDbPath}`);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

const seedProducts = [
  {
    name: "egg tarts",
    category: "pastry",
    unit_price: 2,
    image_url: seedProductImage("egg tarts"),
    is_active: true
  },
  {
    name: "bandung",
    category: "sweet drink",
    unit_price: 3,
    image_url: seedProductImage("bandung"),
    is_active: true
  },
  {
    name: "lemonade",
    category: "sweet drink",
    unit_price: 3,
    image_url: seedProductImage("lemonade"),
    is_active: true
  }
];

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
      `SELECT id, name, category, unit_price, image_url, is_active, updated_at
         FROM products
        ORDER BY category ASC, name ASC`
    )
    .all()
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      unit_price: nullableNumber(product.unit_price),
      image_url: product.image_url ?? "",
      is_active: Boolean(product.is_active),
      updated_at: product.updated_at
    }));
}

export function upsertInventoryProducts(products) {
  const upsert = db.prepare(
    `INSERT INTO products (id, name, category, unit_price, image_url, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       category = excluded.category,
       unit_price = excluded.unit_price,
       image_url = CASE
         WHEN excluded.image_url = '' THEN products.image_url
         ELSE excluded.image_url
       END,
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
        product.image_url ?? "",
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
              image_url = ?,
              is_active = ?,
              updated_at = ?
        WHERE id = ?`
    )
    .run(
      normalizeProductName(product.name),
      product.category,
      product.unit_price,
      product.image_url ?? "",
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
      image_url TEXT NOT NULL DEFAULT '',
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
  ensureProductsColumn("image_url", "TEXT NOT NULL DEFAULT ''");
  backfillSeedProductImages();
  db.exec(
    `UPDATE orders
        SET fulfillment_status = 'completed'
      WHERE payment_status = 'paid'
        AND fulfillment_status = 'active'
        AND placed_by_username IS NULL`
  );
}

function ensureProductsColumn(columnName, columnType) {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE products ADD COLUMN ${columnName} ${columnType}`);
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
    return resolveBackendPath(databaseUrl.replace(/^file:/, ""));
  }

  return resolveBackendPath(databaseUrl);
}

function resolveBackendPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(backendDir, filePath);
}

function nullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function getInventoryProduct(productId) {
  const product = db
    .prepare(
      `SELECT id, name, category, unit_price, image_url, is_active, updated_at
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
    image_url: product.image_url ?? "",
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

function backfillSeedProductImages() {
  const update = db.prepare("UPDATE products SET image_url = ? WHERE name = ? AND COALESCE(image_url, '') = ''");
  for (const product of seedProducts) {
    update.run(product.image_url, normalizeProductName(product.name));
  }
}

function seedProductImage(productName) {
  const image = {
    "egg tarts": {
      label: "Egg Tarts",
      bg: "#fff3d7",
      plate: "#f9c86c",
      accent: "#a16207",
      shapes: `
        <circle cx="96" cy="122" r="39" fill="#f8d27c"/>
        <circle cx="96" cy="122" r="27" fill="#fff1a8"/>
        <circle cx="166" cy="102" r="37" fill="#f8d27c"/>
        <circle cx="166" cy="102" r="25" fill="#fff1a8"/>
        <circle cx="168" cy="164" r="34" fill="#f8d27c"/>
        <circle cx="168" cy="164" r="23" fill="#fff1a8"/>
      `
    },
    bandung: {
      label: "Bandung",
      bg: "#ffe4ef",
      plate: "#f472b6",
      accent: "#9d174d",
      shapes: `
        <rect x="94" y="54" width="78" height="146" rx="22" fill="#f9a8d4"/>
        <rect x="104" y="80" width="58" height="102" rx="16" fill="#fb7185"/>
        <rect x="116" y="38" width="34" height="28" rx="9" fill="#fff7ed"/>
        <path d="M149 42 C184 16 202 28 194 60" fill="none" stroke="#9d174d" stroke-width="8" stroke-linecap="round"/>
        <circle cx="120" cy="103" r="7" fill="#ffe4ef"/>
        <circle cx="146" cy="142" r="8" fill="#ffe4ef"/>
      `
    },
    lemonade: {
      label: "Lemonade",
      bg: "#ecfccb",
      plate: "#facc15",
      accent: "#3f6212",
      shapes: `
        <rect x="88" y="62" width="86" height="140" rx="24" fill="#fde047"/>
        <rect x="99" y="92" width="64" height="83" rx="16" fill="#fef08a"/>
        <path d="M108 56 C134 28 164 35 184 65" fill="none" stroke="#84cc16" stroke-width="9" stroke-linecap="round"/>
        <circle cx="133" cy="132" r="25" fill="#facc15"/>
        <path d="M133 108 L133 156 M109 132 H157 M116 115 L150 149 M150 115 L116 149" stroke="#fff7ad" stroke-width="4" stroke-linecap="round"/>
      `
    }
  }[productName] ?? {
    label: productName,
    bg: "#eef2ff",
    plate: "#818cf8",
    accent: "#3730a3",
    shapes: `<rect x="80" y="70" width="112" height="112" rx="28" fill="#c7d2fe"/>`
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" rx="44" fill="${image.bg}"/>
    <ellipse cx="132" cy="178" rx="82" ry="20" fill="${image.plate}" opacity="0.3"/>
    ${image.shapes}
    <text x="128" y="228" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="${image.accent}">${image.label}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

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
