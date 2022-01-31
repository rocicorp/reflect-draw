# Replidraw (Durable Objects Edition!)

## Development

I typically develop using [Miniflare](https://miniflare.dev/) - a very nice local simulator for CF. I'm not 100% sure if this is still necessary with `wrangler dev` (see below) but it's what I do by habit.

```
npm install

# Run the worker under  - a local Cloudflare simulator. This is very convenient and fast for dev, but not exactly the same as CF all the time.
cd reps
npm run dev

# Run the ui
cd -
npm run dev
```

## Test using `wrangler dev` locally

Another way to run the worker locally is with `wrangler dev`. This didn't used to be possible, but they recently added support for Durable Objects. I'm not sure whether the DO is running on CF when this happens or on your local machine, and I'm not sure what the tradeoffs are with Miniflare.

```
cd reps
wrangler dev
```

## Publish

Publishing to CF is trivial:

```
cd reps
wrangler publish
```
