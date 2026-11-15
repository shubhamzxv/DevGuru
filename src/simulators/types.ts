/**
 * Shared pieces for the command-line simulators (Git, Linux, Docker).
 * Every simulator is a plain class with state and a run(line) method, so it
 * can be tested without React and used by the same <FakeTerminal> component.
 */

export interface CommandResult {
  /** Text printed by the command (may be empty). */
  output: string;
  /** One or two plain sentences: what the command did and why. */
  explanation?: string;
  /** true = the command failed (shown in red). */
  error?: boolean;
  /** true = clear the screen (the `clear` command). */
  clear?: boolean;
}

export interface Simulator {
  /** Text before the cursor, for example "guru@devguru:~/app$". */
  prompt(): string;
  run(line: string): CommandResult;
}

export function ok(output: string, explanation?: string): CommandResult {
  return { output, explanation };
}

export function fail(output: string, explanation?: string): CommandResult {
  return { output, explanation, error: true };
}

/**
 * Splits a command line into words the way a shell does for simple cases:
 * spaces separate words, "double" and 'single' quotes keep spaces together.
 */
export function splitWords(line: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let inWord = false;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      inWord = true;
    } else if (/\s/.test(char)) {
      if (inWord) words.push(current);
      current = '';
      inWord = false;
    } else {
      current += char;
      inWord = true;
    }
  }
  if (inWord) words.push(current);
  return words;
}

/** Reads `-x value` / `--long value` / `--long=value` style options. */
export function takeOption(words: string[], names: string[]): string | undefined {
  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? '';
    for (const name of names) {
      if (word === name) {
        const value = words[i + 1];
        words.splice(i, 2);
        return value;
      }
      if (name.startsWith('--') && word.startsWith(`${name}=`)) {
        words.splice(i, 1);
        return word.slice(name.length + 1);
      }
    }
  }
  return undefined;
}

/** Removes a flag such as -d or --all if present and says whether it was there. */
export function takeFlag(words: string[], names: string[]): boolean {
  const index = words.findIndex((word) => names.includes(word));
  if (index < 0) return false;
  words.splice(index, 1);
  return true;
}

/** Starter commands from a playground code block: one per line, "$ " and # comments removed. */
export function starterCommands(code: string): string[] {
  return code
    .split('\n')
    .map((line) => line.trim().replace(/^\$\s+/, ''))
    .filter((line) => line !== '' && !line.startsWith('#'));
}
