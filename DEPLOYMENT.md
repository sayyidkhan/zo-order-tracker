# One-Push Zo Deployment

This repo gives `zo-order-tracker` one stable deployment path on Zo. After the one-time env setup, a pushed commit should be enough for `npm run deploy:zo` on Zo to pull, rebuild, restart, and verify the live service.

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

## Service Startup

The production service should start through `deployment/service-entrypoint.sh`.

That script reuses the existing build when the current commit already has a recorded successful build. If the commit changed, dependencies are installed, the frontend is rebuilt, and then `deploy-server.js` is started.

Runtime env loading is centralized:

- Zo/system env vars take precedence.
- `.env` at the repo root is the canonical local/deployment file.
- `backend/.env` is still read as a legacy fallback.
- `frontend/.env` is not required for production because the frontend defaults to same-origin API paths.
- `PORT` should stay unset in `.env` because Zo injects it.
