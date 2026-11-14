# DevGuru

Interactive tech explainer. Frontend only (React + Vite + TypeScript + Tailwind). Deployed on AWS.

## Run locally

```bash
npm install
npm run dev
```

Other commands: `npm run build`, `npm run test`, `npm run lint`, `npm run format`,
`npm run validate`.

## Add a new topic

```bash
npm run new:topic -- python decorators "Decorators" "Functions"
```

This creates `src/content/python/decorators.mdx` with every block of the topic template and
adds the topic to `src/content/python/index.json`. Write the content, then run
`npm run validate`.

A topic listed in `index.json` without an MDX file is shown as "Coming soon".

## Add a new technology (track)

```bash
npm run new:track -- kubernetes "Kubernetes" "☸️"
```

The sidebar, home page and routes pick it up automatically.

## Update a topic

Edit the MDX file and change `updated:` at the top to today's date.
Never change a topic's `id`: saved progress is stored against it.

The full README (Amplify deploy guide, cost) is written in Step 10.
