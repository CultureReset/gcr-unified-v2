# gcr-unified-v2

**A starting copy of `gcr-unified`** (see `git log`: "Initial copy from gcr-unified
— starting point for structured-data rebuild"). It has the same pages and build as
`gcr-unified`; read that README for what the site is and how to run it
(`npm install`, `npm run dev`, `npm run build`). It is not part of the Ghost box.

The Vercel project `gcr-unified2` looks like its deployment, but the git link is
not visible from here.

> **Secrets.** `.env.vercel` (a `VERCEL_OIDC_TOKEN`) used to be tracked in git.
> It is now untracked and ignored, but it is still in earlier commits: those
> tokens are short-lived, but rotate it if it is still valid. `.env.production`
> holds only public client-side settings.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
