import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { request as httpRequest } from "node:http";
import type { IncomingMessage, RequestOptions } from "node:http";
import { Hono } from "hono";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { serveStatic } from "hono/bun";
import config from "./zosite.json";
import { loadEnvFiles } from "./env-loader.js";

type Mode = "development" | "production";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFiles([resolve(__dirname, ".env"), resolve(__dirname, "backend/.env")]);

const frontendDir = resolve(__dirname, "app", "frontend");
const backendDir = resolve(__dirname, "app", "backend");
const backendPort = Number(process.env.ZORDER_BACKEND_PORT ?? 4000);
const mode: Mode = process.env.NODE_ENV === "production" ? "production" : "development";
const productionDistDir = resolve(__dirname, "dist");

const app = new Hono();
const backendProcess = startBackend();

app.get("/api/health", async (c) => {
  const backend = await fetch(`http://127.0.0.1:${backendPort}/health`);
  return c.json({
    ok: true,
    service: "zo-order-tracker",
    mode,
    backend_status: backend.status,
    backend_ok: backend.ok
  });
});

app.all("/health", async (c) => proxyToBackend(c.req.raw));
app.all("/auth/*", async (c) => proxyToBackend(c.req.raw));
app.all("/orders*", async (c) => proxyToBackend(c.req.raw));
app.all("/inventory*", async (c) => proxyToBackend(c.req.raw));
app.all("/menu*", async (c) => proxyToBackend(c.req.raw));
app.all("/workflows*", async (c) => proxyToBackend(c.req.raw));
app.all("/agent*", async (c) => proxyToBackend(c.req.raw));
app.all("/config*", async (c) => proxyToBackend(c.req.raw));

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

process.on("exit", () => {
  backendProcess.kill();
});

export default { fetch: app.fetch, port, idleTimeout: 255 };

function startBackend() {
  const child = spawn("bash", ["-lc", `PORT=${backendPort} NODE_ENV=${mode} npm run start`], {
    cwd: backendDir,
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    console.error(`backend exited (${signal ?? code ?? "unknown"})`);
  });

  return child;
}

function configureProduction(app: Hono) {
  app.get("/assets/*", async (c) => {
    const assetPath = c.req.path.replace(/^\//, "");
    const file = Bun.file(resolve(productionDistDir, assetPath));
    if (!(await file.exists())) {
      return c.notFound();
    }
    return new Response(file);
  });
  app.get("/favicon.svg", async (c) => {
    const file = Bun.file(resolve(frontendDir, "public", "favicon.svg"));
    if (!(await file.exists())) {
      return c.notFound();
    }
    return new Response(file);
  });
  app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
  app.get("/", async (c) => {
    const file = Bun.file(resolve(productionDistDir, "index.html"));
    if (!(await file.exists())) {
      return c.notFound();
    }
    return new Response(file);
  });
  app.get("*", async (c) => {
    const path = c.req.path;
    const file = path === "/" ? null : Bun.file(resolve(productionDistDir, path.slice(1)));
    if (file && (await file.exists())) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        return new Response(file);
      }
    }

    return new Response(Bun.file(resolve(productionDistDir, "index.html")), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}

async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    root: frontendDir,
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom"
  });

  app.use("*", async (c, next) => {
    if (isBackendRoute(c.req.path)) return next();
    if (c.req.path === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    const url = c.req.path;
    try {
      if (url === "/" || url === "/index.html") {
        let template = await Bun.file(resolve(frontendDir, "index.html")).text();
        template = await vite.transformIndexHtml(url, template);
        return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
      }

      const publicFile = Bun.file(resolve(frontendDir, "public", url.slice(1)));
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, {
            headers: { "Cache-Control": "no-store, must-revalidate" }
          });
        }
      }

      let result;
      try {
        result = await vite.transformRequest(url);
      } catch {
        result = null;
      }

      if (result) {
        return new Response(result.code, {
          headers: {
            "Content-Type": "application/javascript",
            "Cache-Control": "no-store, must-revalidate"
          }
        });
      }

      let template = await Bun.file(resolve(frontendDir, "index.html")).text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}

function isBackendRoute(path: string) {
  return ["/api/health", "/health", "/auth", "/orders", "/inventory", "/menu", "/workflows", "/agent", "/config"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

async function proxyToBackend(request: Request) {
  const url = new URL(request.url);
  const bodyBuffer = request.method === "GET" || request.method === "HEAD" ? null : Buffer.from(await request.arrayBuffer());

  return new Promise<Response>((resolveResponse, reject) => {
    const headers = Object.fromEntries(request.headers.entries());
    delete headers.host;

    const options: RequestOptions = {
      hostname: "127.0.0.1",
      port: backendPort,
      path: `${url.pathname}${url.search}`,
      method: request.method,
      headers
    };

    const proxyReq = httpRequest(options, (proxyRes: IncomingMessage) => {
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      proxyRes.on("end", () => {
        const responseHeaders = new Headers();
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((entry) => responseHeaders.append(key, entry));
          } else if (value !== undefined) {
            responseHeaders.set(key, value);
          }
        });

        resolveResponse(
          new Response(Buffer.concat(chunks), {
            status: proxyRes.statusCode ?? 500,
            headers: responseHeaders
          })
        );
      });
    });

    proxyReq.on("error", reject);
    if (bodyBuffer) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });
}
