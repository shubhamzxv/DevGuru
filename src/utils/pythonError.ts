/**
 * Pyodide errors start with many lines about Pyodide's own files.
 * Keep only the part about the learner's code: from File "<exec>" down to
 * the last line (error type and message).
 */
export function cleanTraceback(message: string): string {
  const lines = message.trim().split('\n');
  const start = lines.findIndex((line) => line.includes('File "<exec>"'));
  if (start < 0) return message.trim();
  // Drop the line about our own input() replacement; it only confuses learners.
  const own = lines.slice(start).filter((line) => !line.includes('_devguru_input'));
  return ['Traceback (most recent call last):', ...own].join('\n');
}
