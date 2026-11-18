# Zo Infrastructure

This document describes how zorder is currently deployed and what Zo is meant to represent in the demo story.

## Current Deployment Shape

The Garden deployment uses the existing public gateway and one managed app process:

```text
Garden public gateway /zorder
  -> zo-order-tracker process on 127.0.0.1:8836
  -> node deploy-server.js
  -> serves frontend/dist
  -> proxies API routes to backend child process
  -> backend/src/server.js Express API on 127.0.0.1:8837
  -> /home/workspace/Start/garden-of-zo/zo-order-tracker/zorder-data/zorder.sqlite
```

The live URL in the README is:

```text
https://public-apps-sayyidkhan.zocomputer.io/zorder/
```

## Runtime Components

| Component | File | Purpose |
| --- | --- | --- |
| Service entrypoint | `node deploy-server.js` | Starts the Garden managed process using the prepared frontend build. |
| Deploy server | `deploy-server.js` | Serves the frontend bundle and proxies API paths. |
| Backend server | `backend/src/server.js` | Express API. |
| Frontend build | `frontend/dist` | Static Vite build. |
| Database | `/home/workspace/Start/garden-of-zo/zo-order-tracker/zorder-data/zorder.sqlite` | Private SQLite in the gitignored project data folder. |
| Workflows | `/home/workspace/Start/garden-of-zo/zo-order-tracker/zorder-data/workflows/*.json` | Runtime workflows, initially copied from repository templates. |

## API Proxy Paths

The gateway preserves `/zorder`; `deploy-server.js` removes that prefix and proxies these app-relative paths to the backend:

- `/health`
- `/auth`
- `/orders`
- `/inventory`
- `/menu`
- `/workflows`
- `/agent`
- `/config`

Everything else falls back to the SPA frontend.

## Environment Variables

Garden runtime settings are stored in `/home/workspace/Start/garden-of-zo/zo-order-tracker/zorder-data/runtime.env`, selected using `ZORDER_ENV_FILE`. Both app listeners bind to loopback. `APP_BASE_PATH=/zorder` is also required when building Vite. See [DEPLOYMENT.md](../DEPLOYMENT.md) for the current deployment.

For standalone backend/local installations:

```env
# Zo injects PORT for the public service. Leave it unset in `.env`.
# PORT=<public service port or local port>
NODE_ENV=production
ZORDER_BACKEND_PORT=4000
DATABASE_URL=file:./data/zorder.sqlite
ZORDER_USER_USERNAME=<demo user>
ZORDER_USER_PIN=<6-digit user PIN>
ZORDER_USER_EMAIL=<demo user email>
ZORDER_ADMIN_USERNAME=<admin user>
ZORDER_ADMIN_PIN=<6-digit admin PIN>
WORKFLOW_BUILDER_MODE=local
# OPENAI_API_KEY=<optional setup-only drafting>
```

Rules:

- Zo/system env vars take precedence, followed by `ZORDER_ENV_FILE`, repo-root `.env`, then legacy `backend/.env`.
- `backend/.env` is still read as a legacy fallback.
- Keep deployment secrets in `.env` on Zo or in Zo env config, not in git.
- Leave `VITE_API_BASE_URL` unset in deployment so API calls stay same-origin.

## Deployment Commands

Garden: build with `APP_BASE_PATH=/zorder npm run build`, then restart only the managed `zo-order-tracker` service (`svc_pbxvzCVE9KQ`) through Zo's service tools. Verify `https://public-apps-sayyidkhan.zocomputer.io/zorder/api/health`. Do not use the inherited process-matching restart or factory-reset scripts for Garden.

The commands and flow below apply to standalone installations. Set `APP_URL` to that installation's URL when running a health check.

Standalone deploy:

```bash
npm run deploy:zo
```

Useful variants:

```bash
npm run deploy:zo -- --skip-pull
npm run deploy:zo -- --skip-pull --allow-dirty
npm run restart:service
npm run health:service
```

Deployment flow:

1. require clean worktree unless `--allow-dirty`
2. fetch/pull current branch unless `--skip-pull`
3. install backend/frontend dependencies
4. build frontend
5. write deployment build stamp
6. restart Zo service
7. run health check

## Zo Demo Narrative

For the hackathon narrative, Zo is not only a host:

- it hosts the live demo
- it can keep the owner's SQLite data and workflow files close to the app
- it provides a practical place for future automation jobs
- it fits the story of a small owner-operated workflow system

Do not imply that Zo currently provides multi-tenant auth, payment verification, or messaging ingestion for zorder. Messaging ingestion is only a future enhancement for users who still prefer to send or receive orders through chat.

## Future Infra Options

Only consider these after the current app is stable:

- scheduled backups/exports
- separate background worker service
- production database migration
- payment provider integration
- chat/message-channel ingestion that reuses the same workflow runner after the core tracker is stable
