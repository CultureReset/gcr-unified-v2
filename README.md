# gcr-unified-v2

A July 20, 2026 copy of [`gcr-unified`](https://github.com/CultureReset/gcr-unified), the public Gulf Coast Radar web app, made as the starting point for a structured-data rebuild.

React and Vite, reading businesses from the [Gulf Coast Radar API](https://github.com/CultureReset/gcr-api-clean). The app code in `src/` holds no database key. The rebuild did not go further, and `gcr-unified` has moved ahead since: it has the "Claim this business" form, industry facts and the search category tabs, which this copy does not. Use `gcr-unified`; nothing current runs from this repo.

## Run it

```bash
npm install
npm run dev
npm run build     # also prerenders pages (scripts/prerender.mjs)
```

The root `*.mjs` files are one-off data export and import scripts from the copy, not part of the app. `claude/gcr-unified-login-styling-1mmsac` holds the login-styling work that was mirrored from `gcr-unified`.
