import { useParams } from 'react-router-dom';
import ComingSoon from '../components/layout/ComingSoon';
import NotFound from './NotFound';

const PLAYGROUNDS: Record<string, { title: string; step: string; note: string }> = {
  python: {
    title: 'Python playground',
    step: 'Step 4',
    note: 'Python will run inside your browser using Pyodide (WebAssembly) in a Web Worker.',
  },
  sql: {
    title: 'SQL playground',
    step: 'Step 5',
    note: 'SQL will run inside your browser using sql.js (SQLite) with a sample database.',
  },
};

export default function PlaygroundPage() {
  const { lang } = useParams();
  const playground = lang ? PLAYGROUNDS[lang] : undefined;
  if (!playground) return <NotFound />;

  return (
    <ComingSoon title={playground.title} step={playground.step}>
      <p>{playground.note}</p>
    </ComingSoon>
  );
}
