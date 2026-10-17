import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFiles } from "../../env-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");
const rootDir = resolve(backendDir, "..");

loadEnvFiles([process.env.ZORDER_ENV_FILE, resolve(rootDir, ".env"), resolve(backendDir, ".env")]);
