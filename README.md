# Replidraw

A tiny Figma-like multiplayer graphics editor built with [Reflect](https://reflect.net/).

Running live at [replidraw-do.vercel.app](https://replidraw-do.vercel.app/).

## Install

```bash
npm install
```

## Develop

```bash
# Run local Reflect server
npx reflect dev reflect/index.ts

# Run UI
npm run dev

NEXT_PUBLIC_WORKER_HOST=ws://127.0.0.1:8080 \
npm run dev
```

## Publish

```bash
# Create a new app on reflect.net
npx reflect init --new

# Publish app
npx reflect publish reflect/index.ts

# Publish UI somewhere, Vercel works
npx vercel

# You'll have to set the environment variable on Vercel:
# NEXT_PUBLIC_WORKER_HOST=<whatever-was-printed-by-reflect-publish>
```

## Building your Own Thing

1. Clone this project
2. `npm install`
3. Adjust the mutators, subscribers, and entities in `datamodel/` to implement your domain objects.
4. Implement your UI by calling the subscribers and mutators. See existing UI in `frontend` for an example.
5. Have fun 😀.
