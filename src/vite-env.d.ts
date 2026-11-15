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
