# One-Push Zo Deployment

## Garden of Zo deployment (sayyidkhan)

This checkout lives at `/home/workspace/Start/garden-of-zo/zo-order-tracker`. Public product URL: `https://public-apps-sayyidkhan.zocomputer.io/zorder/`; customer page: `/zorder/user`; merchant page: `/zorder/admin`.

Garden's router forwards `/zorder` without stripping the prefix to the managed process `zo-order-tracker` on loopback 8836. Its internal API listens on 8837. Build with `APP_BASE_PATH=/zorder npm run build`; run `node deploy-server.js` with `ZORDER_ENV_FILE=/home/workspace/Data/zorder/runtime.env`. Restart through Zo's service management tools after a successful build. Do not run the inherited restart/deploy/reset scripts against this installation: they target the original host or broad process patterns.

Initial setup: install app dependencies, run `node deployment/setup-garden.js`, then build and register the process. Setup is idempotent: it preserves existing credentials and data. Runtime SQLite, users, profiles, workflows and private credentials live outside source under `/home/workspace/Data/zorder`. Owner login details are in that folder's `access.md`; never publish or commit it. Payment details start empty. This deployment retains the MVP PIN login and requires merchant setup before accepting real payments. Optional AI workflow generation remains disabled.

Verify `/zorder/api/health`, customer sign-up/login, merchant login, protected APIs, frontend assets and deep-link refresh through the gateway. Garden catalogue metadata belongs in the sibling platform checkout; route configuration belongs in the sibling router checkout.

## Standalone Zo installations

The sections below describe the inherited standalone deployment scripts, not Garden's managed process. After a standalone installation's one-time env setup, `npm run deploy:zo` can pull, rebuild, restart and verify its service. Set `APP_URL` to that installation's URL; the default health-check target is Garden's `/zorder` URL.

## Problem It Solves

`git pull` updates the repository, but the live Zo service keeps running the old process until it is restarted. That is why the website can stay stale after the latest code has been pulled.

## Normal Deploy

From local:

```bash
git add .
git commit -m "your change"
git push
```

From the repo root:

```bash
npm run deploy:zo
```

That command will:

1. verify the repo is clean
2. fetch and fast-forward the current branch
3. install dependencies
4. build the frontend
5. restart the running Zo service
6. wait for the public health check from `deployment/health-check.sh`

## Useful Variants

Deploy the current checkout without pulling:

```bash
npm run deploy:zo -- --skip-pull
```

Deploy local uncommitted changes for testing:

```bash
npm run deploy:zo -- --skip-pull --allow-dirty
```

Restart the live service only:

```bash
npm run restart:service
```

Run the public health check only:

```bash
npm run health:service
```

AI-facing skills live here:

- `Skills/zo-order-tracker-deploy/SKILL.md`
- `Skills/zo-order-tracker-sync-redeploy/SKILL.md`

Factory reset the app back to demo defaults:

```bash
npm run reset:factory -- --yes
```

Preview the reset without changing anything:

```bash
npm run reset:factory -- --dry-run
```

## Service Startup

The production service should start through `deployment/service-entrypoint.sh`.

That script reuses the existing build when the current commit already has a recorded successful build. If the commit changed, dependencies are installed, the frontend is rebuilt, and then `deploy-server.js` is started.

Runtime env loading is centralized:

- Zo/system env vars take precedence.
- `.env` at the repo root is the canonical local/deployment file.
- `backend/.env` is still read as a legacy fallback.
- `frontend/.env` is not required for production because the frontend defaults to same-origin API paths.
- `PORT` should stay unset in `.env` because Zo injects it.

## Factory Reset Behavior

The factory reset flow lives in `deployment/factory-reset.sh` and `backend/scripts/factory-reset.js`.

It:

1. backs up the current app state into `deployment/backups/factory-reset-<timestamp>/`
2. wipes runtime order, inventory, profile, and signup data
3. removes custom workflow JSON files while preserving the built-in defaults
4. reseeds the demo products, sample orders, and default shop config
5. restarts the live service and waits for health, unless `--skip-restart` is passed

It intentionally preserves repo-root `.env`, legacy `backend/.env`, API keys, and deployment configuration.
