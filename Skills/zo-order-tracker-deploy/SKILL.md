---
name: zo-order-tracker-deploy
description: Deploy zo-order-tracker on Garden of Zo by building its prefixed frontend, restarting the managed app process and checking the public health endpoint.
compatibility: Created for Zo Computer
metadata:
  author: shab.zo.computer
---

Use for deployment, stale builds or health checks of this repository's Garden instance.

Read `AGENTS.md` and the Garden section of `DEPLOYMENT.md` first.

- Checkout: `/home/workspace/Start/garden-of-zo/zo-order-tracker`.
- Public product: `https://public-apps-sayyidkhan.zocomputer.io/zorder/`.
- Customer: `/zorder/user`; merchant: `/zorder/admin`.
- Health: `https://public-apps-sayyidkhan.zocomputer.io/zorder/api/health`.
- Managed process: `zo-order-tracker` (`svc_pbxvzCVE9KQ`), running `node deploy-server.js`.
- Runtime: loopback app port 8836 and internal API port 8837, loaded through `ZORDER_ENV_FILE=/home/workspace/Data/zorder/runtime.env`.
- All live data, workflow files and credentials remain under `/home/workspace/Data/zorder`, outside Git.

Install dependencies with `npm run install:app`. Build with `APP_BASE_PATH=/zorder npm run build`, then restart only the app through Zo's managed service tools. Run `npm run health:service` and confirm the JSON reports a healthy backend; verify customer and merchant navigation stays under `/zorder`.

Preserve the gateway URL, visibility, prefix, runtime data and credentials. Garden catalogue metadata and routing live in separate sibling repositories. Do not use the inherited standalone restart/deploy/reset scripts against this instance: their process matching and data paths do not implement the Garden deployment.

`deployment/setup-garden.js` prepares a new installation without overwriting existing state. Run it only for initial setup or a deliberately scoped recovery. Keep demo credential disclosure disabled and payment details unconfigured until the merchant supplies them.
