# zo-order-tracker keepalive worker

Cloudflare Worker that keeps the deployed app warm and stores each sweep in D1 for queryable history.

## Endpoints

- `GET /` - worker metadata and available paths.
- `GET /probe` - quick `/api/health` check without storing a run.
- `GET /run` - starts a manual keepalive sweep in the background.
- `GET /run?wait=1` - runs a manual sweep synchronously and stores the result.
- `GET /logs` - lists stored runs.
- `GET /logs/{runId}` - returns one run with all endpoint results.
- `GET /logs/summary?hours=24` - summarizes recent run health.

## Log filters

`/logs` supports:

- `limit=20` - max 100.
- `status=ok` or `status=fail`.
- `trigger=manual` or `trigger=scheduled`.
- `from=2026-06-23T00:00:00.000Z`.
- `to=2026-06-23T23:59:59.999Z`.
- `path=/api/health`.
- `type=page` or `type=api`.

Example:

```sh
curl 'https://zo-order-tracker-keepalive.shab-hacks.workers.dev/logs?status=ok&trigger=scheduled&limit=10'
```
