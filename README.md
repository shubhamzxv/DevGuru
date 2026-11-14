# DevGuru

Interactive tech explainer. Frontend only (React + Vite + TypeScript + Tailwind). Deployed on AWS.

## Run locally

```bash
npm install
npm run dev
```

Other commands: `npm run build`, `npm run test`, `npm run lint`, `npm run format`.

## Add a new technology (track)

1. Create a folder: `src/content/<tech>/`
2. Add `index.json` (copy one from another track and change name, icon, order).

The sidebar, home page and routes pick it up automatically.

The full README (adding topics, Amplify deploy guide, cost) is written in Step 10.
