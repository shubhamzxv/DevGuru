// Order matters: the global must exist before the language files run.
import './prismGlobal';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-git';
import 'prismjs/components/prism-http';

// Python, JSON, YAML, Markdown and JS/TS are already built into prism-react-renderer.
export { Prism } from 'prism-react-renderer';
