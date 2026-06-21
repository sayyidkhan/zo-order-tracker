# Deployment

This folder gives `zo-order-tracker` one stable deployment path on Zo.

## Problem It Solves

`git pull` updates the repository, but the live Zo service keeps running the old process until it is restarted. That is why the website can stay stale after the latest code has been pulled.

## Normal Deploy

From the repo root:

```bash
npm run deploy:zo
```

That command will:

1. verify the repo is clean
2. fetch and fast-forward `main`
3. install dependencies
4. build the frontend
5. restart the running Zo service
6. wait for `https://zo-order-tracker-shab.zocomputer.io/api/health`

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

## Factory Reset Behavior

The factory reset flow lives in `deployment/factory-reset.sh` and `backend/scripts/factory-reset.js`.

It:

1. backs up the current app state into `deployment/backups/factory-reset-<timestamp>/`
2. wipes runtime order, inventory, profile, and signup data
3. removes custom workflow JSON files while preserving the built-in defaults
4. reseeds the demo products, sample orders, and default shop config
5. restarts the live service and waits for health, unless `--skip-restart` is passed

It intentionally preserves `backend/.env`, API keys, and deployment configuration.
