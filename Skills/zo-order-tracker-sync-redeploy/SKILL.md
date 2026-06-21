---
name: zo-order-tracker-sync-redeploy
description: Sync the latest committed code for zo-order-tracker from the remote branch and redeploy it on Zo so the live site actually updates.
compatibility: Created for Zo Computer
metadata:
  author: shab.zo.computer
---

Use this skill when the task is specifically to get the newest committed code live on the Zo-hosted `zo-order-tracker` app.

Repository root:

```text
/home/workspace/projects/zo-order-tracker
```

Default command:

```bash
cd /home/workspace/projects/zo-order-tracker
npm run deploy:zo
```

Why this is the correct sync-and-redeploy command:

- it checks that the repo is clean
- it fetches and fast-forwards the current branch
- it installs dependencies
- it rebuilds the frontend bundle
- it restarts the managed Zo service
- it waits for the public health check to pass

Important rule:

- do not treat `git pull` by itself as deployment
- the live app is a long-running service, so pulled code is not live until the service is rebuilt and restarted

When to use variants:

```bash
cd /home/workspace/projects/zo-order-tracker
npm run deploy:zo -- --skip-pull
npm run deploy:zo -- --skip-pull --allow-dirty
npm run health:service
```

- `npm run deploy:zo -- --skip-pull`: use when the latest code is already checked out locally and the goal is only to redeploy it
- `npm run deploy:zo -- --skip-pull --allow-dirty`: use only for local uncommitted testing
- `npm run health:service`: use to verify the public app after deploy

Verification target:

```text
https://zo-order-tracker-shab.zocomputer.io/api/health
```

Read these files first if the deploy does not behave as expected:

- `README.md`
- `deployment/README.md`
- `deployment/deploy.sh`
- `deployment/restart-service.sh`
- `deployment/service-entrypoint.sh`
