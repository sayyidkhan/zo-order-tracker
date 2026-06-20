import { seedDemoData } from "../src/data-store.js";
import { seedDemoShopConfig } from "../src/shop-config.js";

const snapshot = seedDemoData({ reset: true });
const shopConfig = seedDemoShopConfig();

console.log("Seeded SQLite demo data in backend/data/zorder.sqlite");
console.log(`Products: ${snapshot.products.length}`);
console.log(`Orders: ${snapshot.orders.length}`);
console.log(`PayNow: ${shopConfig.paynow_number}`);
console.log(`Bank transfer: ${shopConfig.bank_name} ${shopConfig.bank_account_number}`);
