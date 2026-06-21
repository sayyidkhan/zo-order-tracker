---
name: zo-order-tracker-deploy
description: Deploy the zo-order-tracker app on Zo from one pushed commit by pulling the latest code when appropriate, rebuilding the frontend, restarting the managed service, and verifying the live health check.
compatibility: Created for Zo Computer
metadata:
  author: shab.zo.computer
---

Use this skill when working inside the `zo-order-tracker` repository and the task is about making new code go live on Zo, keeping one-push deployment working, fixing a stale live site after a pull, or checking whether the managed service has restarted correctly.

Repository root:

```text
/home/workspace/projects/zo-order-tracker
```

Primary deployment command:

```bash
cd /home/workspace/projects/zo-order-tracker
npm run deploy:zo
```

Important behavior:

- Keep `README.md` merchant/operator-first: merchant quick start, account setup, inventory, then one-push deployment.
- One pushed commit should contain backend, frontend, env-loading code, service entrypoint, and deploy scripts.
- Zo/system env vars take precedence over `.env`.
- The repo-root `.env` is canonical; `backend/.env` is only a legacy fallback.
- Production should leave `VITE_API_BASE_URL` unset so frontend API calls stay same-origin.
- Production should leave `PORT` unset in `.env` because Zo injects it.
- `git pull` alone is not enough for production deployment.
- The live Zo app is a long-running service.
- New code becomes live only after the service is rebuilt or restarted.
- The canonical deployment overview lives in `DEPLOYMENT.md`; executable scripts live in `deployment/`.

One-push workflow:

1. commit locally
2. push to the remote branch
3. on Zo, run `npm run deploy:zo` from the repo root
4. confirm the health check passes

What `npm run deploy:zo` does:

1. checks for a clean git working tree unless `--allow-dirty` is passed
2. fetches and fast-forwards the current branch unless `--skip-pull` is passed
3. installs dependencies
4. rebuilds the frontend bundle
5. restarts the running Zo service
6. waits for the public health check to pass

Useful commands:

```bash
cd /home/workspace/projects/zo-order-tracker
npm run deploy:zo
npm run deploy:zo -- --skip-pull
npm run deploy:zo -- --skip-pull --allow-dirty
npm run restart:service
npm run health:service
```

When to use each:

- `npm run deploy:zo`: normal deploy of latest committed remote code
- `npm run deploy:zo -- --skip-pull`: deploy the current local checkout as-is
- `npm run deploy:zo -- --skip-pull --allow-dirty`: deploy local uncommitted changes for testing
- `npm run restart:service`: restart only
- `npm run health:service`: verify only

Verification target:

```text
https://zo-order-tracker-shab.zocomputer.io/api/health
```

If the live site looks stale after a pull:

1. run `npm run deploy:zo`
2. if needed, run `npm run health:service`
3. if health fails, inspect the service and build logs before changing code

Files to read first for deployment context:

- `README.md`
- `DEPLOYMENT.md`
- `package.json`
- `deployment/deploy.sh`
- `deployment/service-entrypoint.sh`
