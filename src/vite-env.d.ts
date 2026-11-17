/// <reference types="vite/client" />

// Data modules made at build time by src/build/contentPlugin.ts
declare module 'virtual:devguru-search' {
  const entries: import('./build/contentIndex').SearchEntry[];
  export default entries;
}

declare module 'virtual:devguru-cheatsheets' {
  const sheets: import('./build/contentIndex').CheatSheetEntry[];
  export default sheets;
}

declare module 'virtual:devguru-interview' {
  /** Number of interview questions per track slug. */
  export const counts: Record<string, number>;
  /** loaders[track]() loads that track's questions and answers (a separate chunk). */
  export const loaders: Record<
    string,
    () => Promise<{ default: import('./build/contentIndex').InterviewEntry[] }>
  >;
}
