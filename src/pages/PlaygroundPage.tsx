import { useLocation, useParams } from 'react-router-dom';
import PythonPlayground from '../components/playground/PythonPlayground';
import SqlPlayground from '../components/playground/SqlPlayground';
import NotFound from './NotFound';

const PYTHON_STARTER = `# Write any Python here and press Run.
fruits = ["mango", "banana", "guava"]

for number, fruit in enumerate(fruits, start=1):
    print(number, fruit.title())

print("Total:", len(fruits))
`;

const SQL_STARTER = `-- Write any SQL here and press Run. Tap "View schema" to see the tables.
SELECT e.name, d.name AS department, e.salary
FROM employees AS e
JOIN departments AS d ON d.id = e.department_id
ORDER BY e.salary DESC
LIMIT 5;
`;

/** Code sent by a "Try it" button on a topic page (see CodeBlock). */
function codeFromState(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const code = (state as { code?: unknown }).code;
  return typeof code === 'string' && code.trim() !== '' ? code : undefined;
}

export default function PlaygroundPage() {
  const { lang } = useParams();
  const location = useLocation();
  const sent = codeFromState(location.state);

  if (lang === 'python') {
    const code = sent ?? PYTHON_STARTER;
    return (
      <section className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Python playground</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Python runs inside your browser. Nothing is sent to a server. Libraries like numpy and
          pandas are downloaded when your code imports them.
        </p>
        {/* key: start a fresh playground when different code arrives */}
        <PythonPlayground key={code} initialCode={code} />
      </section>
    );
  }

  if (lang === 'sql') {
    const code = sent ?? SQL_STARTER;
    return (
      <section className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SQL playground</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          SQL runs inside your browser on a sample shop database with six tables: employees,
          departments, customers, orders, order_items and products. You can change the data freely;
          Reset database brings the original back.
        </p>
        <SqlPlayground key={code} initialCode={code} />
      </section>
    );
  }

  return <NotFound />;
}
