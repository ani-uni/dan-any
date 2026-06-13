<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->

## Project Constraints

- In package runtime source, do not import or reference `@electric-sql/pglite`, `@electric-sql/pglite-tools`, or `drizzle-orm/**` outside `src/core/db/**` and `src/core/main-drizzle.ts`.
- Do not re-export drizzle/PGLite-backed code from generic entry points such as `src/core/index.ts`, `src/core/main.ts`, or package root exports. Keep those heavy dependencies isolated so pure TypeScript users can tree-shake away PGLite and drizzle.
