import { Prism } from 'prism-react-renderer';

// Extra Prism languages (SQL, Bash, ...) are plain scripts that expect a
// global called "Prism". This file must be imported BEFORE them.
(globalThis as { Prism?: typeof Prism }).Prism = Prism;
