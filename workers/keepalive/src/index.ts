type D1Value = string | number | boolean | null;

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface Env {
  BASE_URL?: string;
  LOG_DB?: D1Database;
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

type EndpointType = "page" | "api";

type StoredPingResult = PingResult & {
  endpointType: EndpointType;
};

type RunMetadata = {
  trigger: "manual" | "scheduled";
  scheduledAt?: string;
  cron?: string;
};

type KeepaliveRun = {
  id: string;
  trigger: RunMetadata["trigger"];
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  scheduledAt?: string;
  cron?: string;
  ok: boolean;
  checked: number;
  failed: number;
  durationMs: number;
  failures: StoredPingResult[];
  results: StoredPingResult[];
  storage: {
    stored: boolean;
    error?: string;
  };
};

type RunRow = {
  id: string;
  trigger: string;
  base_url: string;
  started_at: string;
  finished_at: string;
  scheduled_at: string | null;
  cron: string | null;
  ok: number;
  checked: number;
  failed: number;
  duration_ms: number;
  error: string | null;
  created_at: string;
};

type ResultRow = {
  id: number;
  run_id: string;
  idx: number;
  endpoint_type: EndpointType;
  path: string;
  ok: number;
  status: number | null;
  duration_ms: number;
  error: string | null;
  created_at: string;
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

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");

  return Response.json(data, {
    ...init,
    headers,
  });
}

function getBoundStatement(db: D1Database, sql: string, values: D1Value[]) {
  const statement = db.prepare(sql);
  return values.length > 0 ? statement.bind(...values) : statement;
}

function toRun(row: RunRow) {
  return {
    id: row.id,
    trigger: row.trigger,
    baseUrl: row.base_url,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    scheduledAt: row.scheduled_at,
    cron: row.cron,
    ok: row.ok === 1,
    checked: row.checked,
    failed: row.failed,
    durationMs: row.duration_ms,
    error: row.error,
    createdAt: row.created_at,
  };
}

function toResult(row: ResultRow) {
  return {
    id: row.id,
    runId: row.run_id,
    index: row.idx,
    endpointType: row.endpoint_type,
    path: row.path,
    ok: row.ok === 1,
    status: row.status,
    durationMs: row.duration_ms,
    error: row.error,
    createdAt: row.created_at,
  };
}

function parseLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.trunc(parsed)));
}

function parseHours(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(168, Math.max(1, Math.trunc(parsed)));
}

function parseOkFilter(value: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  if (["ok", "success", "healthy", "true", "1"].includes(normalized)) {
    return 1;
  }
  if (["fail", "failed", "error", "unhealthy", "false", "0"].includes(normalized)) {
    return 0;
  }

  return undefined;
}

function isEndpointType(value: string | null): value is EndpointType {
  return value === "page" || value === "api";
}

async function persistRun(env: Env, run: Omit<KeepaliveRun, "storage">) {
  if (!env.LOG_DB) {
    return {
      stored: false,
      error: "LOG_DB binding is not configured.",
    };
  }

  const db = env.LOG_DB;

  try {
    await db
      .prepare(`
        INSERT INTO keepalive_runs (
          id,
          trigger,
          base_url,
          started_at,
          finished_at,
          scheduled_at,
          cron,
          ok,
          checked,
          failed,
          duration_ms,
          error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        run.id,
        run.trigger,
        run.baseUrl,
        run.startedAt,
        run.finishedAt,
        run.scheduledAt ?? null,
        run.cron ?? null,
        run.ok ? 1 : 0,
        run.checked,
        run.failed,
        run.durationMs,
        null,
      )
      .run();

    const resultStatements = run.results.map((result, index) => db
      .prepare(`
        INSERT INTO keepalive_results (
          run_id,
          idx,
          endpoint_type,
          path,
          ok,
          status,
          duration_ms,
          error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        run.id,
        index,
        result.endpointType,
        result.path,
        result.ok ? 1 : 0,
        result.status ?? null,
        result.durationMs,
        result.error ?? null,
      ));

    if (resultStatements.length > 0) {
      await db.batch(resultStatements);
    }

    return {
      stored: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to persist keepalive run", { runId: run.id, error: message });

    return {
      stored: false,
      error: message,
    };
  }
}

async function queryRuns(requestUrl: URL, env: Env) {
  if (!env.LOG_DB) {
    return json({
      ok: false,
      error: "LOG_DB binding is not configured.",
    }, { status: 503 });
  }

  const params = requestUrl.searchParams;
  const limit = parseLimit(params.get("limit"), 20, 100);
  const where: string[] = [];
  const values: D1Value[] = [];

  const ok = parseOkFilter(params.get("status") ?? params.get("ok"));
  if (ok !== undefined) {
    where.push("ok = ?");
    values.push(ok);
  }

  const trigger = params.get("trigger");
  if (trigger === "manual" || trigger === "scheduled") {
    where.push("trigger = ?");
    values.push(trigger);
  }

  const from = params.get("from");
  if (from) {
    where.push("started_at >= ?");
    values.push(from);
  }

  const to = params.get("to");
  if (to) {
    where.push("started_at <= ?");
    values.push(to);
  }

  const path = params.get("path");
  if (path) {
    where.push("EXISTS (SELECT 1 FROM keepalive_results r WHERE r.run_id = keepalive_runs.id AND r.path = ?)");
    values.push(path);
  }

  const endpointType = params.get("endpointType") ?? params.get("type");
  if (isEndpointType(endpointType)) {
    where.push("EXISTS (SELECT 1 FROM keepalive_results r WHERE r.run_id = keepalive_runs.id AND r.endpoint_type = ?)");
    values.push(endpointType);
  }

  values.push(limit);

  const sql = `
    SELECT *
    FROM keepalive_runs
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY started_at DESC
    LIMIT ?
  `;

  const result = await getBoundStatement(env.LOG_DB, sql, values).all<RunRow>();

  return json({
    ok: true,
    filters: {
      limit,
      status: params.get("status") ?? params.get("ok"),
      trigger,
      from,
      to,
      path,
      endpointType,
    },
    runs: result.results.map(toRun),
  });
}

async function queryRunDetails(runId: string, env: Env) {
  if (!env.LOG_DB) {
    return json({
      ok: false,
      error: "LOG_DB binding is not configured.",
    }, { status: 503 });
  }

  const run = await env.LOG_DB
    .prepare("SELECT * FROM keepalive_runs WHERE id = ?")
    .bind(runId)
    .first<RunRow>();

  if (!run) {
    return json({
      ok: false,
      error: "Run not found.",
    }, { status: 404 });
  }

  const result = await env.LOG_DB
    .prepare("SELECT * FROM keepalive_results WHERE run_id = ? ORDER BY idx ASC")
    .bind(runId)
    .all<ResultRow>();

  return json({
    ok: true,
    run: toRun(run),
    results: result.results.map(toResult),
  });
}

async function querySummary(requestUrl: URL, env: Env) {
  if (!env.LOG_DB) {
    return json({
      ok: false,
      error: "LOG_DB binding is not configured.",
    }, { status: 503 });
  }

  const hours = parseHours(requestUrl.searchParams.get("hours"), 24);
  const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const runs = await env.LOG_DB
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_count,
        SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS failed_count,
        AVG(duration_ms) AS avg_duration_ms,
        MAX(started_at) AS latest_started_at
      FROM keepalive_runs
      WHERE started_at >= ?
    `)
    .bind(from)
    .first<{
      total: number;
      ok_count: number | null;
      failed_count: number | null;
      avg_duration_ms: number | null;
      latest_started_at: string | null;
    }>();

  const failures = await env.LOG_DB
    .prepare(`
      SELECT
        path,
        endpoint_type,
        COUNT(*) AS failures,
        MAX(created_at) AS latest_failure_at
      FROM keepalive_results
      WHERE created_at >= ? AND ok = 0
      GROUP BY path, endpoint_type
      ORDER BY failures DESC, latest_failure_at DESC
      LIMIT 20
    `)
    .bind(from)
    .all<{
      path: string;
      endpoint_type: EndpointType;
      failures: number;
      latest_failure_at: string;
    }>();

  return json({
    ok: true,
    hours,
    from,
    totalRuns: runs?.total ?? 0,
    okRuns: runs?.ok_count ?? 0,
    failedRuns: runs?.failed_count ?? 0,
    avgDurationMs: runs?.avg_duration_ms ?? null,
    latestStartedAt: runs?.latest_started_at ?? null,
    failureHotspots: failures.results.map((row) => ({
      path: row.path,
      endpointType: row.endpoint_type,
      failures: row.failures,
      latestFailureAt: row.latest_failure_at,
    })),
  });
}

async function runKeepalive(env: Env, metadata: RunMetadata): Promise<KeepaliveRun> {
  const id = crypto.randomUUID();
  const baseUrl = env.BASE_URL ?? DEFAULT_BASE_URL;
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const results: StoredPingResult[] = [];

  console.log(`Starting paced keepalive sweep against ${baseUrl}`);

  for (const path of PAGE_ENDPOINTS) {
    const result = await pingEndpoint(baseUrl, path, "text/html,application/xhtml+xml");
    results.push({ ...result, endpointType: "page" });
    console.log(`${result.ok ? "OK" : "FAIL"} page ${path}`, result);
    await sleep(randomDelay(2, 6));
  }

  await sleep(randomDelay(8, 15));

  for (const path of API_ENDPOINTS) {
    const result = await pingEndpoint(baseUrl, path, "application/json");
    results.push({ ...result, endpointType: "api" });
    console.log(`${result.ok ? "OK" : "FAIL"} api ${path}`, result);
    await sleep(randomDelay(1, 4));
  }

  const failures = results.filter((result) => !result.ok);
  const finishedAt = new Date().toISOString();
  const run = {
    id,
    trigger: metadata.trigger,
    baseUrl,
    startedAt,
    finishedAt,
    scheduledAt: metadata.scheduledAt,
    cron: metadata.cron,
    ok: failures.length === 0,
    checked: results.length,
    failed: failures.length,
    durationMs: Date.now() - started,
    failures,
    results,
  };

  const storage = await persistRun(env, run);

  console.log(`Keepalive sweep complete: ${results.length - failures.length}/${results.length} OK`);
  console.log(`Keepalive run ${id} storage ${storage.stored ? "stored" : "not stored"}`, storage);

  return {
    ...run,
    storage,
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/run") {
      if (url.searchParams.get("wait") === "1") {
        const result = await runKeepalive(env, { trigger: "manual" });

        return json(result, {
          status: result.ok ? 200 : 502,
        });
      }

      ctx.waitUntil(runKeepalive(env, { trigger: "manual" }));

      return json({
        accepted: true,
        message: "Keepalive sweep started in the background.",
      }, {
        status: 202,
      });
    }

    if (url.pathname === "/probe") {
      const baseUrl = env.BASE_URL ?? DEFAULT_BASE_URL;
      const result = await pingEndpoint(baseUrl, "/api/health", "application/json");

      return json(result, {
        status: result.ok ? 200 : 502,
      });
    }

    if (url.pathname === "/logs") {
      return queryRuns(url, env);
    }

    if (url.pathname === "/logs/summary") {
      return querySummary(url, env);
    }

    if (url.pathname.startsWith("/logs/")) {
      return queryRunDetails(decodeURIComponent(url.pathname.slice("/logs/".length)), env);
    }

    return json({
      ok: true,
      worker: "zo-order-tracker-keepalive",
      baseUrl: env.BASE_URL ?? DEFAULT_BASE_URL,
      schedule: "*/5 * * * *",
      manualRunPath: "/run",
      manualRunAndWaitPath: "/run?wait=1",
      probePath: "/probe",
      logsPath: "/logs",
      logSummaryPath: "/logs/summary",
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runKeepalive(env, {
      trigger: "scheduled",
      scheduledAt: new Date(event.scheduledTime).toISOString(),
      cron: event.cron,
    }));
  },
};
