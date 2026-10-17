---
name: zo-order-tracker-sync-redeploy
description: Sync committed zo-order-tracker source from GitHub and redeploy its Garden of Zo process while preserving runtime data and its public URL.
compatibility: Created for Zo Computer
metadata:
  author: shab.zo.computer
---

Use when the task is to get the latest committed code live on Garden.

Checkout: `/home/workspace/Start/garden-of-zo/zo-order-tracker`.
Repository: `sayyidkhan/zo-order-tracker`.
Product: `https://public-apps-sayyidkhan.zocomputer.io/zorder/`.
Health: `https://public-apps-sayyidkhan.zocomputer.io/zorder/api/health`.

Read `AGENTS.md`, `DEPLOYMENT.md` and `Skills/zo-order-tracker-deploy/SKILL.md` for runtime settings and deployment boundaries.

Inspect Git status and fetch the intended branch. Preserve local work; fast-forward only when it can be done without discarding changes. Do not treat a successful pull as a completed deployment.

Install app dependencies and build with `APP_BASE_PATH=/zorder npm run build`. After a successful build, restart only managed process `zo-order-tracker` (`svc_pbxvzCVE9KQ`) through Zo's service tools. Run `npm run health:service`; verify healthy JSON, public assets, customer/merchant deep links and login redirects under `/zorder`.

Do not run the inherited `npm run deploy:zo`, process-matching restart or factory-reset scripts against Garden. Do not change gateway visibility or URLs, restart unrelated services, publish credentials, or overwrite `/home/workspace/Data/zorder`.
