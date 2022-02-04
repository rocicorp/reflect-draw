# Replidraw

A tiny Figma-like multiplayer graphics editor.

Built with [Replicache](https://replicache.dev), [Next.js](https://nextjs.org/),
and [Cloudflare Workers](https://workers.cloudflare.com/).

Running live at [replidraw-do.vercel.com](https://replidraw-do.vercel.com/).

## Hacking Locally

The `dev-worker` command runs the worker using [Miniflare](https://miniflare.dev/), a really nice Cloudflare emulation environment. This is super convenient and doesn't require a CF account but doesn't give you a realistic view of performance.

```bash
npm install

# start the backend
npm run dev-worker &

# start the frontend
NEXT_PUBLIC_WORKER_HOST=ws://localhost:8787 npm run dev
```

## Publishing Worker to Cloudflare

1. Get an account at Cloudflare: https://workers.cloudflare.com/.
2. Install the [Wrangler CLI tool](https://developers.cloudflare.com/workers/cli-wrangler/install-update)

Then:

```
# publish to Cloudflare
wrangler publish

# run frontend
npm run dev
```

## Using reps-do in your own project

1. Copy `reps-do-*.tgz` and `rep-client-*.tgz`
2. Copy the `worker` directory to your project
3. `npm add reps-do-*.tgz reps-client-*.tgz @cloudflare/workers-types esbuild miniflare`
4. Copy the `dev-worker` and `build-worker` scripts from `package.json` into your project
5. Have fun 😀.
