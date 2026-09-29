# gcr-unified-v2

The public Gulf Coast Radar consumer web app (React + Vite; the app source in `src/` holds no
database key and reads `gcr-api-clean`), as it stood on 2026-07-20. **A starting copy of
`gcr-unified`** (see `git log`: "Initial copy from gcr-unified — starting point for
structured-data rebuild"). `package.json`, `vercel.json`, `scripts/prerender.mjs`, the
route table in `src/App.jsx` and the set of files in `src/pages/` are the same as in
`gcr-unified`; read that README for what the site is and how to run it (`npm install`,
`npm run dev`, `npm run build`). It is not part of the Ghost box.

It is behind `gcr-unified`, which has changed since the copy: 11 source files differ
(App, Auth, Building, BusinessDetail, Group, Privacy, Search, Setup, Swipe, Terms,
`services/gcrApi.js`), and this copy lacks `components/ClaimBusiness.jsx` (the "Claim
this business" form), `components/IndustryFacts.jsx` and `data/catTabs.js` (Search
category tabs and autocomplete). Here `Auth.jsx` still signs in from a `?token=` link;
`gcr-unified` has that disabled. It has no `docs/images` screenshots.

The Vercel project `gcr-unified2` looks like its deployment, but the git link is
not visible from here.

> **Secrets.** `.env.vercel` (a `VERCEL_OIDC_TOKEN`) used to be tracked in git.
> It is now untracked and ignored, but it is still in earlier commits: those
> tokens are short-lived, but rotate it if it is still valid. `.env.production`
> holds only public client-side settings.
>
> **More secrets.** `dump-entire-db.mjs` and `export-supabase-complete.mjs` contain a
> Supabase `service_role` key, and `convert-db-to-organized-json.mjs`,
> `convert-sql-to-json.mjs` and `export-complete-all-data.mjs` contain a database
> connection string with its password, in plain text and tracked in git (the same
> files as in `gcr-unified`). Rotate them and move them to environment variables.

---

# React + Vite

*(Leftover create-vite text. This repo has no `vite.config.*` and no `eslint.config.*`,
so `npm run lint` has no config to load and the React plugin is not configured.)*

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
