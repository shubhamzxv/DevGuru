import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl py-10 text-center">
      <p className="text-5xl font-extrabold text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        This page does not exist. The link may be old or typed wrong.
      </p>
      <Link
        to="/"
        className="tap mt-6 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
      >
        Go to Home
      </Link>
    </section>
  );
}
