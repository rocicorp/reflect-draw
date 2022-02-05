# Replidraw

A tiny Figma-like multiplayer graphics editor.

Built with [Replicache](https://replicache.dev), [Next.js](https://nextjs.org/),
and [Cloudflare Workers](https://workers.cloudflare.com/).

Running live at [replidraw-do.vercel.app](https://replidraw-do.vercel.app/).

## Hacking Locally

The `dev-worker` command runs the worker using [Miniflare](https://miniflare.dev/), a really nice Cloudflare emulation environment. This is super convenient and doesn't require a CF account but doesn't give you a realistic view of performance.

```bash
npm install

# start the backend
npm run dev-worker

# (in another shell) start the frontend
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

## Developing against Cloudflare

It is possible to develop using the Cloudflare network without destabilizing the production copy of a worker. This provides a more realistic idea of latency than Miniflare.

```
# Must have published at least once prior
wrangler dev

# (In another shell) Run frontend
npm run dev
```

## Using reps-do in your own project

1. Copy `reps-do-*.tgz`, `rep-client-*.tgz`, `worker`, and `wrangler.toml` into your project
2. `npm add reps-do-*.tgz reps-client-*.tgz @cloudflare/workers-types esbuild miniflare`
3. Adjust the `mutators` param in `worker/index.ts` to point to your mutators file.
4. Copy the `dev-worker` and `build-worker` scripts from `package.json` into your project
5. Ensure `Replicache` and the client are instantiated correctly, see `[id].tsx` in this project.
6. Have fun 😀.

Note: This will get easier. `reps-do-*.tgz` will soon become a standalone npm module, and `reps-client-*.tgz` will get folded into the existing `replicache` module.
