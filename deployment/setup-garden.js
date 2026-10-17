import { randomInt, randomBytes } from "node:crypto";
import { mkdirSync, existsSync, writeFileSync, copyFileSync, readdirSync, constants } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFiles } from "../env-loader.js";

const dataDir = process.env.ZORDER_DATA_DIR || "/home/workspace/Data/zorder";
const envFile = resolve(dataDir, "runtime.env");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
mkdirSync(resolve(dataDir, "workflows"), { recursive: true, mode: 0o700 });
if (!existsSync(envFile)) {
  const admin = `owner-${randomBytes(5).toString("hex")}`;
  const adminPin = String(randomInt(100000, 1000000));
  const userPin = String(randomInt(100000, 1000000));
  const values = {
    APP_BASE_PATH: "/zorder", HOST: "127.0.0.1", PORT: "8836", ZORDER_BACKEND_PORT: "8837",
    ZORDER_DATA_DIR: dataDir, ZORDER_WORKFLOW_DIR: resolve(dataDir, "workflows"),
    ZORDER_ADMIN_USERNAME: admin, ZORDER_ADMIN_PIN: adminPin,
    ZORDER_USER_USERNAME: "customer", ZORDER_USER_PIN: userPin,
    ZORDER_USER_EMAIL: "", ZORDER_SHOW_DEMO_CREDENTIALS: "false", WORKFLOW_BUILDER_MODE: "local"
  };
  writeFileSync(envFile, Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n", { mode: 0o600, flag: "wx" });
  writeFileSync(resolve(dataDir, "access.md"), `# zorder access\n\nMerchant: https://public-apps-sayyidkhan.zocomputer.io/zorder/admin\n\nUsername: ${admin}\n\nPIN: ${adminPin}\n\nCustomer: https://public-apps-sayyidkhan.zocomputer.io/zorder/user\n\nTest customer username: customer\n\nTest customer PIN: ${userPin}\n\nCustomers can also sign up. This deployment uses the app's MVP PIN authentication. Configure real products and payment details before accepting orders.\n`, { mode: 0o600, flag: "wx" });
}
for (const name of readdirSync(new URL("../backend/workflows/", import.meta.url))) {
  const destination = resolve(dataDir, "workflows", name);
  if (!existsSync(destination)) copyFileSync(new URL(`../backend/workflows/${name}`, import.meta.url), destination, constants.COPYFILE_EXCL);
}
loadEnvFiles([envFile]);
if (!existsSync(resolve(dataDir, "zorder.sqlite"))) {
  const { saveShopConfig, defaultShopConfig } = await import("../backend/src/shop-config.js");
  saveShopConfig({ ...defaultShopConfig, paynow_number: "", paynow_qr_image: "", bank_name: "", bank_account_name: "", bank_account_number: "", payment_instructions: "Preview only. Payments are not configured; do not transfer money.", footer_note: "Garden preview — merchant setup pending." });
}
console.log(`Garden runtime prepared in ${dataDir}; credentials were not printed.`);
