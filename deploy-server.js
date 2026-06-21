import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadEnvFiles } from "./env-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFiles([resolve(__dirname, ".env"), resolve(__dirname, "backend/.env")]);

const frontendDist = resolve(__dirname, "frontend/dist");
const backendDir = resolve(__dirname, "backend");
const port = Number(process.env.PORT || 8080);
const backendPort = Number(process.env.ZORDER_BACKEND_PORT || 4001);

const backend = spawn("bash", ["-lc", `PORT=${backendPort} NODE_ENV=production npm run start`], {
  cwd: backendDir,
  stdio: "inherit"
});

backend.on("exit", (code, signal) => {
  console.error(`zorder backend exited: ${signal ?? code ?? "unknown"}`);
});

const backendPrefixes = ["/health", "/auth", "/orders", "/inventory", "/menu", "/workflows", "/agent", "/config"];

function isBackendPath(pathname) {
  return backendPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".json": return "application/json; charset=utf-8";
    default: return "application/octet-stream";
  }
}

function serveFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentType(filePath) });
  createReadStream(filePath).pipe(res);
}

function proxyToBackend(req, res) {
  const headers = { ...req.headers };
  delete headers.host;

  const proxyReq = httpRequest({
    hostname: "127.0.0.1",
    port: backendPort,
    path: req.url,
    method: req.method,
    headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Backend unavailable", detail: error.message }));
  });

  req.pipe(proxyReq);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/health") {
    const healthReq = httpRequest({ hostname: "127.0.0.1", port: backendPort, path: "/health", method: "GET" }, (healthRes) => {
      const chunks = [];
      healthRes.on("data", (chunk) => chunks.push(chunk));
      healthRes.on("end", () => {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          ok: healthRes.statusCode === 200,
          service: "zo-order-tracker",
          backend_status: healthRes.statusCode,
          backend: chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null
        }));
      });
    });
    healthReq.on("error", (error) => {
      res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, service: "zo-order-tracker", error: error.message }));
    });
    healthReq.end();
    return;
  }

  if (isBackendPath(url.pathname)) {
    proxyToBackend(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const candidate = resolve(join(frontendDist, requested));

  if (candidate.startsWith(frontendDist) && existsSync(candidate) && statSync(candidate).isFile()) {
    serveFile(res, candidate);
    return;
  }

  serveFile(res, join(frontendDist, "index.html"));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`zo-order-tracker listening on http://0.0.0.0:${port}`);
  console.log(`proxying backend on http://127.0.0.1:${backendPort}`);
});

process.on("SIGTERM", () => {
  backend.kill("SIGTERM");
  server.close(() => process.exit(0));
});
