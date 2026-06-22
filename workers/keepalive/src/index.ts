interface Env {
  BASE_URL?: string;
}

const DEFAULT_BASE_URL = "https://zo-order-tracker-shab.zocomputer.io";
const USER_AGENT = "zo-order-tracker-keepalive/1.0";

const PAGE_ENDPOINTS = [
  "/",
  "/user",
  "/user/login",
  "/login?role=user",
  "/login?role=admin",
  "/admin",
  "/intro",
  "/tech-stack",
  "/why-zo-computer",
];

const API_ENDPOINTS = [
  "/api/health",
  "/health",
  "/auth/demo-credentials",
  "/config/shop",
  "/menu/preview",
];

type PingResult = {
  ok: boolean;
  path: string;
  status?: number;
  durationMs: number;
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function randomDelay(minSeconds: number, maxSeconds: number) {
  const span = Math.max(0, maxSeconds - minSeconds);
  return (minSeconds + Math.floor(Math.random() * (span + 1))) * 1000;
}

async function pingEndpoint(baseUrl: string, path: string, accept: string): Promise<PingResult> {
  const started = Date.now();
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: accept,
          "Cache-Control": "no-cache",
          "User-Agent": USER_AGENT,
        },
      });

      await response.body?.cancel();

      if (response.ok) {
        return {
          ok: true,
          path,
          status: response.status,
          durationMs: Date.now() - started,
        };
      }

      if (attempt === 3) {
        return {
          ok: false,
          path,
          status: response.status,
          durationMs: Date.now() - started,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      if (attempt === 3) {
        return {
          ok: false,
          path,
          durationMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    await sleep(3_000);
  }

  return {
    ok: false,
    path,
    durationMs: Date.now() - started,
    error: "Unexpected retry exit",
  };
}

async function runKeepalive(env: Env) {
  const baseUrl = env.BASE_URL ?? DEFAULT_BASE_URL;
  const results: PingResult[] = [];

  console.log(`Starting paced keepalive sweep against ${baseUrl}`);

  for (const path of PAGE_ENDPOINTS) {
    const result = await pingEndpoint(baseUrl, path, "text/html,application/xhtml+xml");
    results.push(result);
    console.log(`${result.ok ? "OK" : "FAIL"} page ${path}`, result);
    await sleep(randomDelay(2, 6));
  }

  await sleep(randomDelay(8, 15));

  for (const path of API_ENDPOINTS) {
    const result = await pingEndpoint(baseUrl, path, "application/json");
    results.push(result);
    console.log(`${result.ok ? "OK" : "FAIL"} api ${path}`, result);
    await sleep(randomDelay(1, 4));
  }

  const failures = results.filter((result) => !result.ok);
  console.log(`Keepalive sweep complete: ${results.length - failures.length}/${results.length} OK`);

  return {
    ok: failures.length === 0,
    checked: results.length,
    failures,
    results,
  };
}

export default {
  async fetch(_request: Request, env: Env) {
    const result = await runKeepalive(env);

    return Response.json(result, {
      status: result.ok ? 200 : 502,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runKeepalive(env));
  },
};
