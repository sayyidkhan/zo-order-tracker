# Zo Infrastructure

This document describes how zorder is currently deployed and what Zo is meant to represent in the demo story.

## Current Deployment Shape

The repo deploys as one service:

```text
Zo HTTP service
  -> deployment/service-entrypoint.sh
  -> node deploy-server.js
  -> serves frontend/dist
  -> proxies API routes to backend child process
  -> backend/src/server.js Express API
  -> backend/data/zorder.sqlite
```

The live URL in the README is:

```text
https://zo-order-tracker-shab.zocomputer.io
```

## Runtime Components

| Component | File | Purpose |
| --- | --- | --- |
| Service entrypoint | `deployment/service-entrypoint.sh` | Installs dependencies and builds frontend when current commit is not built. |
| Deploy server | `deploy-server.js` | Serves the frontend bundle and proxies API paths. |
| Backend server | `backend/src/server.js` | Express API. |
| Frontend build | `frontend/dist` | Static Vite build. |
| Database | `backend/data/zorder.sqlite` | Local SQLite data store. |
| Workflows | `backend/workflows/*.json` | Deterministic workflow JSON. |

## API Proxy Paths

`deploy-server.js` proxies these prefixes to the backend:

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

Backend/local:

```env
NODE_ENV=production
PORT=<public service port or local port>
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

Frontend:

```env
VITE_API_BASE_URL=http://localhost:4000
```

For same-origin production, the frontend can use relative API paths by leaving `VITE_API_BASE_URL` unset.

## Deployment Commands

Full deploy:

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

Do not imply that Zo currently provides multi-tenant auth, payment verification, or messaging ingestion for zorder.

## Future Infra Options

Only consider these after the current app is stable:

- scheduled backups/exports
- separate background worker service
- production database migration
- payment provider integration
- messaging-channel ingestion that reuses the same workflow runner
