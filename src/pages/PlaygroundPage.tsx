import { useParams } from 'react-router-dom';
import ComingSoon from '../components/layout/ComingSoon';
import PythonPlayground from '../components/playground/PythonPlayground';
import NotFound from './NotFound';

const PYTHON_STARTER = `# Write any Python here and press Run.
fruits = ["mango", "banana", "guava"]

for number, fruit in enumerate(fruits, start=1):
    print(number, fruit.title())

print("Total:", len(fruits))
`;

export default function PlaygroundPage() {
  const { lang } = useParams();

  if (lang === 'python') {
    return (
      <section className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Python playground</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Python runs inside your browser. Nothing is sent to a server. Libraries like numpy and
          pandas are downloaded when your code imports them.
        </p>
        <PythonPlayground initialCode={PYTHON_STARTER} />
      </section>
    );
  }

  if (lang === 'sql') {
    return (
      <ComingSoon title="SQL playground" step="Step 5">
        <p>SQL will run inside your browser using sql.js (SQLite) with a sample database.</p>
      </ComingSoon>
    );
  }

  return <NotFound />;
}
