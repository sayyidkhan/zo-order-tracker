---
name: zo-order-tracker-deploy
description: Deploy the zo-order-tracker app on Zo by pulling the latest code when appropriate, rebuilding the frontend, restarting the managed service, and verifying the live health check.
compatibility: Created for Zo Computer
metadata:
  author: shab.zo.computer
---

Use this skill when working inside the `zo-order-tracker` repository and the task is about making new code go live on Zo, fixing a stale live site after a pull, or checking whether the managed service has restarted correctly.

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

- `git pull` alone is not enough for production deployment.
- The live Zo app is a long-running service.
- New code becomes live only after the service is rebuilt or restarted.
- The canonical deployment flow lives in `deployment/`.

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
- `deployment/README.md`
- `package.json`
- `deployment/deploy.sh`
- `deployment/service-entrypoint.sh`
