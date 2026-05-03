Developer quickstart

1) Install dependencies

```bash
# run as your normal user (no sudo)
npm install
```

2) (optional) Prepare husky hooks

If you want to enable Git hooks locally (recommended for teams), run:

```bash
npm run prepare
```
3) Run checks

```bash
npm run typecheck
npm run lint
npm run build
```

4) Format code

```bash
npm run format
```

Notes
- If you hit permission errors during `npm install`, fix ownership of `~/.npm` and `node_modules` then retry.
- CI runs typecheck, lint and build on push/PR to `main`.
