# Replidraw

A tiny Figma-like multiplayer graphics editor.

Built with [Replicache](https://replicache.dev), [Next.js](https://nextjs.org/),
and [Cloudflare Workers](https://workers.cloudflare.com/).

Running live at [replidraw-do.vercel.app](https://replidraw-do.vercel.app/).

## Hacking Locally

The `dev-worker` command runs the worker using [Miniflare](https://miniflare.dev/), a really nice Cloudflare emulation environment. This is super convenient and doesn't require a CF account. Unfortunately, it also doesn't give you a realistic view of performance since everything is local.

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

## Using Reflect in your own project

1. Copy `reflect-*.tgz`, `reflect-client-*.tgz`, `worker`, and `wrangler.toml` into your project
2. `npm add reflect-*.tgz reflect-client-*.tgz @cloudflare/workers-types esbuild miniflare`
3. Adjust the `mutators` param in `worker/index.ts` to point to your mutators file.
4. Copy the `dev-worker` and `build-worker` scripts from `package.json` into your project
5. Ensure `Replicache` and the client are instantiated correctly, see `[id].tsx` in this project.
6. Have fun 😀.

Note: This will get easier. `reflect-*.tgz` will soon become a standalone npm module, and `reflect-client-*.tgz` will get folded into the existing `replicache` module.

## Authentication and Authorization

Reflect can optionally authenticate users who connect to rooms with your server and authorize their access to the room.

1. Pass some `authToken` to the `Replicache` constructor's `auth` parameter. See: https://github.com/rocicorp/replidraw-do/blob/main/src/pages/d/%5Bid%5D.tsx#L30.
2. Provide Reflect with an `authHandler` function that authenticates the user and returns whether the user should be allowed in the room. See: https://github.com/rocicorp/replidraw-do/blob/main/worker/index.ts#L29.

The signature for the auth handler is as follows:

```ts
/**
 * An `AuthHandler` should validate that the user authenticated by `auth` is
 * authorized to access the room with `roomID`.
 * @return A promise which resolves to `UserData` for the user if authentication
 * and authorization is successful, or rejects if authentication or
 * authorization fail.
 */
export type AuthHandler = (auth: string, roomID: string) => Promise<UserData>;

/**
 * `UserData` must include a `userID` which is unique stable identifier
 * for the user.
 * `UserData` has a size limit of 6 KB.
 * Currently only `userID` is used, but in the future `UserData` may
 * be passed through to mutators which could use it to supplement
 * mutator args and to validate the mutation.
 */
export type UserData = ReadonlyJSONObject & { userID: string };
```

### Auth Revalidation

You can invalidate specific users or rooms using the Server Auth API, below.

## Server Auth API

The server has an HTTP API for authentication tasks.

### Auth API Key

All calls to the Auth API must provide an API Key. Configure the API Key using Wrangler:

```bash
wrangler secret put REFLECT_AUTH_API_KEY
```

Then pass the API Key in each request to the Auth API using the `x-reflect-auth-api-key` HTTP header:

```ts
fetch("https://myapp.workers.dev/api/auth/v0/invalidateForUser", {
  headers: {
    "x-reflect-auth-api-key": "redacted",
  },
  body: JSON.stringify({ userID: "redacted" }),
});
```

### `invalidateForUser`

Invalidates all of a user's sessions. Affected active clients will immediately try to re-connect and auth.

<table>
     <tr>
          <th align="left">Method</th>
          <td><code>POST</code></td>
     </tr>
     <tr>
          <th align="left">URL</th>
          <td><code>https://myapp.workers.dev/api/auth/v0/invalidateForUser</code></td>
     </tr>
     <tr>
          <th align="left">Headers</th>
          <td><code>x-reflect-auth-api-key: string</code></td>
     </tr>
     <tr>
          <th align="left">Body</th>
          <td><code>{ userID: string }</code></td>
     </tr>
</table>

### `invalidateForRoom`

Invalidates all user sessions in a room. Affected active clients will immediately try to re-connect and auth.

<table>
     <tr>
          <th align="left">Method</th>
          <td><code>POST<code></td>
     </tr>
     <tr>
          <th align="left">URL</th>
          <td><code>https://myapp.workers.dev/api/auth/v0/invalidateForRoom</code></td>
     </tr>
     <tr>
          <th align="left">Headers</th>
          <td><code>x-reflect-auth-api-key: string</code></td>
     </tr>
     <tr>
          <th align="left">Body</th>
          <td><code>{ roomID: string }</code></td>
     </tr>
</table>

### `invalidateAll`

Invalidates all user sessions in all rooms. Affected active clients will immediately try to re-connect and auth.

<table>
     <tr>
          <th align="left">Method</th>
          <td><code>POST<code></td>
     </tr>
     <tr>
          <th align="left">URL</th>
          <td><code>https://myapp.workers.dev/api/auth/v0/invalidateAll</code></td>
     </tr>
     <tr>
          <th align="left">Headers</th>
          <td><code>x-reflect-auth-api-key: string</code></td>
     </tr>
     <tr>
          <th align="left">Body</th>
          <td>N/A</td>
     </tr>
</table>

## Recipes

### How to persist logs from the worker

The `BaseServer` class accepts a `logger` argument. You can implement this yourself to send the logs wherever you want. We also provide a `DatadogLogger` implementation of this interface in the package as a convenience, if you have an account there. [See worker/index.ts for an example](https://github.com/rocicorp/replidraw-do/blob/main/worker/index.ts#L17).

### How to list the rooms for your Reps server

Cloudflare doesn't have a UI for this, but there's an API.

First, go to https://dash.cloudflare.com/profile/api-tokens and click "Create Token" then choose the "Read All Resources" template. Click through and then copy the resulting token.

```bash
# Get the account id
curl -X GET "https://api.cloudflare.com/client/v4/accounts" \
     -H "Authorization: Bearer :token" \
     -H "Content-Type:application/json"

# Get namespace for account
curl -X GET "https://api.cloudflare.com/client/v4/accounts/:accountid/workers/durable_objects/namespaces" \
     -H "Authorization: Bearer :token" \
     -H "Content-Type:application/json"

# Get object instances
curl -X GET "https://api.cloudflare.com/client/v4/accounts/:accountid/workers/durable_objects/namespaces/:namespaceid/objects" \
     -H "Authorization: Bearer :token" \
     -H "Content-Type:application/json"
```
