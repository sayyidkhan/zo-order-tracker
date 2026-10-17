# zorder on Garden of Zo

- Read README.md and DEPLOYMENT.md. This checkout is `sayyidkhan/zo-order-tracker`, independent of Garden's router and platform repositories.
- Garden public route `/zorder` forwards unchanged to loopback 8836; the internal API uses 8837. `APP_BASE_PATH=/zorder` must be set both when building Vite and at runtime. All navigation and same-origin API requests must retain that prefix.
- Managed process `zo-order-tracker` (`svc_pbxvzCVE9KQ`) runs `node deploy-server.js`, with `ZORDER_ENV_FILE=/home/workspace/Data/zorder/runtime.env`. Restart only this app after building changes. Use Zo service tools; inherited restart scripts target the original deployment on another host and must not be used here.
- Authoritative SQLite, profiles, users, workflows and credentials live under `/home/workspace/Data/zorder`, outside Git. Do not reset, seed over, publish or commit these files. `deployment/setup-garden.js` initialises a fresh deployment without overwriting existing state.
- The public app uses MVP six-digit PIN authentication. Demo credential disclosure is disabled and initial credentials are in the owner's private data folder. Payment details start empty and must be configured before live trading. Workflow generation uses local templates, without AI API calls.
- Verify backend tests, frontend build, prefixed browser navigation and API authorization. Keep temporary work in `_scratch/` or the conversation workspace.
