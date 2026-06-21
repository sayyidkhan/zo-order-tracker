import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../../env-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendDir, "..");
const envPath = path.join(repoRoot, ".env");
const legacyEnvPath = path.join(backendDir, ".env");

loadEnvFiles([envPath, legacyEnvPath]);

const args = parseArgs(process.argv.slice(2));
const protectedWorkflowFiles = new Set(["default-order-flow.json", "workflow-schema.json"]);

const dataDir = path.resolve(backendDir, "data");
const workflowDir = path.resolve(backendDir, "workflows");
const databasePath = resolveDatabasePath(process.env.DATABASE_URL ?? "file:./data/zorder.sqlite");
const databaseSidecars = [`${databasePath}-shm`, `${databasePath}-wal`];
const usersPath = path.join(dataDir, "users.json");
const profilesPath = path.join(dataDir, "user-profiles.json");
const backupRoot = path.join(repoRoot, "deployment", "backups");
const backupDir = path.join(backupRoot, `factory-reset-${timestampSlug()}`);

const generatedWorkflowPaths = fs.existsSync(workflowDir)
  ? fs
      .readdirSync(workflowDir)
      .filter((name) => name.endsWith(".json") && !protectedWorkflowFiles.has(name))
      .map((name) => path.join(workflowDir, name))
  : [];

const backupTargets = [databasePath, ...databaseSidecars, usersPath, profilesPath, ...generatedWorkflowPaths].filter((target) =>
  fs.existsSync(target)
);

const resetTargets = [
  {
    label: "SQLite order and inventory data",
    target: databasePath
  },
  {
    label: "signed-up users",
    target: usersPath
  },
  {
    label: "saved user profiles",
    target: profilesPath
  },
  ...generatedWorkflowPaths.map((target) => ({
    label: "published custom workflow",
    target
  }))
];

if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args.yes && !args.dryRun) {
  console.error("Refusing to factory reset without --yes. Use --dry-run to preview changes.");
  process.exit(1);
}

console.log("Factory reset plan for zo-order-tracker");
for (const item of resetTargets) {
  console.log(`- reset ${item.label}: ${path.relative(repoRoot, item.target)}`);
}
console.log(`- preserve environment and secrets: ${path.relative(repoRoot, envPath)}`);
console.log(`- preserve legacy backend env if present: ${path.relative(repoRoot, legacyEnvPath)}`);
console.log(`- reseed demo products, sample orders, and default shop config`);

if (args.dryRun) {
  console.log("Dry run only. No files or data were changed.");
  process.exit(0);
}

if (backupTargets.length > 0) {
  fs.mkdirSync(backupDir, { recursive: true });
  for (const target of backupTargets) {
    const relativePath = path.relative(repoRoot, target);
    const backupPath = path.join(backupDir, relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(target, backupPath);
  }

  fs.writeFileSync(
    path.join(backupDir, "manifest.json"),
    `${JSON.stringify(
      {
        created_at: new Date().toISOString(),
        repo_root: repoRoot,
        backup_targets: backupTargets.map((target) => path.relative(repoRoot, target))
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  console.log(`Backup created at ${path.relative(repoRoot, backupDir)}`);
}

const { seedDemoData } = await import("../src/data-store.js");
const { seedDemoShopConfig } = await import("../src/shop-config.js");

for (const filePath of [usersPath, profilesPath]) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

for (const workflowPath of generatedWorkflowPaths) {
  if (fs.existsSync(workflowPath)) {
    fs.rmSync(workflowPath, { force: true });
  }
}

fs.mkdirSync(dataDir, { recursive: true });

const snapshot = seedDemoData({ reset: true });
const shopConfig = seedDemoShopConfig();

console.log("Factory reset complete.");
console.log(`Products: ${snapshot.products.length}`);
console.log(`Orders: ${snapshot.orders.length}`);
console.log(`Business name: ${shopConfig.business_name}`);
console.log(`Custom workflows removed: ${generatedWorkflowPaths.length}`);

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    yes: false,
    help: false
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--yes") {
      parsed.yes = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      parsed.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage: node backend/scripts/factory-reset.js [--dry-run] [--yes]

Options:
  --dry-run  Show what would be reset without changing data.
  --yes      Confirm the destructive reset.
`);
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function resolveDatabasePath(databaseUrl) {
  const rawPath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : databaseUrl;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(backendDir, rawPath);
}
