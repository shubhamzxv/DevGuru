import type { CommandResult } from './types';

/**
 * A small Bash interpreter for the Linux simulator's scripts and one-liners:
 * if / elif / else / fi, for ... in ... do / done, while and until loops,
 * functions with $1.. arguments, local, return, exit, break, continue, set -e.
 * Simple commands (pipes, &&, ||, redirects) are handed back to the shell.
 */

export interface BashHost {
  /** Runs one simple command line (may contain | && || > >>). Updates host.status. */
  runSimple(line: string): CommandResult;
  status: number;
  positional: string[];
  readonly functions: Map<string, Statement[]>;
  readonly env: Map<string, string>;
}

export type Statement =
  | { kind: 'simple'; line: string }
  | { kind: 'if'; branches: { condition: string; body: Statement[] }[]; otherwise: Statement[] }
  | { kind: 'for'; variable: string; words: string; body: Statement[] }
  | { kind: 'while'; condition: string; until: boolean; body: Statement[] }
  | { kind: 'function'; name: string; body: Statement[] };

class Signal {
  constructor(
    readonly type: 'return' | 'exit' | 'break' | 'continue',
    readonly code = 0,
  ) {}
}

const MAX_LOOP = 1000;

/** Splits one line on ; (outside quotes, not ;;) and separates leading then/do/else/{ keywords. */
function pieces(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (quote) {
      if (c === quote) quote = null;
      current += c;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === '#' && depth === 0 && (i === 0 || /\s/.test(line[i - 1] ?? ''))) break; // comment
    if (c === ';' && depth === 0 && line[i + 1] !== ';') {
      out.push(current);
      current = '';
      continue;
    }
    current += c;
  }
  out.push(current);
  const result: string[] = [];
  for (const raw of out) {
    let piece = raw.trim();
    if (!piece) continue;
    // "name() { body" -> "name() {", "body"; "then echo" -> "then", "echo"
    const fn = /^((?:function\s+)?[A-Za-z_][\w-]*\s*(?:\(\))?\s*\{)\s*(.*)$/.exec(piece);
    if (fn && (/\(\)/.test(fn[1] ?? '') || /^function\s/.test(piece))) {
      result.push(fn[1] ?? '');
      piece = (fn[2] ?? '').trim();
      if (!piece) continue;
    }
    const keyword = /^(then|do|else)\s+(.+)$/.exec(piece);
    if (keyword) {
      result.push(keyword[1] ?? '', keyword[2] ?? '');
      continue;
    }
    // "echo hi }" at the end of a one-line function
    const close = /^(.*\S)\s+\}$/.exec(piece);
    if (close && !piece.includes('${')) {
      result.push(close[1] ?? '', '}');
      continue;
    }
    result.push(piece);
  }
  return result;
}

export function isCompound(line: string): boolean {
  return pieces(line).some(
    (piece) =>
      /^(if|for|while|until|function)\s/.test(piece) ||
      /^[A-Za-z_][\w-]*\s*\(\)\s*\{?$/.test(piece),
  );
}

export function parse(lines: string[]): Statement[] | string {
  const tokens = lines.flatMap(pieces);
  let pos = 0;

  function block(stop: string[]): Statement[] | string {
    const statements: Statement[] = [];
    while (pos < tokens.length) {
      const token = tokens[pos] ?? '';
      const word = token.split(/\s+/)[0] ?? '';
      if (stop.includes(word)) return statements;
      pos++;
      if (word === 'if') {
        const branches: { condition: string; body: Statement[] }[] = [];
        let condition = token.slice(2).trim();
        let otherwise: Statement[] = [];
        for (;;) {
          if ((tokens[pos] ?? '') !== 'then')
            return `syntax error: expected "then" after if ${condition}`;
          pos++;
          const body = block(['elif', 'else', 'fi']);
          if (typeof body === 'string') return body;
          branches.push({ condition, body });
          const next = tokens[pos] ?? '';
          if (next.startsWith('elif')) {
            condition = next.slice(4).trim();
            pos++;
            continue;
          }
          if (next === 'else') {
            pos++;
            const rest = block(['fi']);
            if (typeof rest === 'string') return rest;
            otherwise = rest;
          }
          if ((tokens[pos] ?? '') !== 'fi') return 'syntax error: missing "fi"';
          pos++;
          break;
        }
        statements.push({ kind: 'if', branches, otherwise });
      } else if (word === 'for') {
        const match = /^for\s+([A-Za-z_]\w*)(?:\s+in\s+(.*))?$/.exec(token);
        if (!match) return 'syntax error: use for NAME in WORDS; do ...; done';
        if ((tokens[pos] ?? '') !== 'do') return 'syntax error: expected "do"';
        pos++;
        const body = block(['done']);
        if (typeof body === 'string') return body;
        if ((tokens[pos] ?? '') !== 'done') return 'syntax error: missing "done"';
        pos++;
        statements.push({
          kind: 'for',
          variable: match[1] ?? 'i',
          words: match[2] ?? '"$@"',
          body,
        });
      } else if (word === 'while' || word === 'until') {
        const condition = token.slice(word.length).trim();
        if ((tokens[pos] ?? '') !== 'do') return 'syntax error: expected "do"';
        pos++;
        const body = block(['done']);
        if (typeof body === 'string') return body;
        if ((tokens[pos] ?? '') !== 'done') return 'syntax error: missing "done"';
        pos++;
        statements.push({ kind: 'while', condition, until: word === 'until', body });
      } else if (/\{$/.test(token) && (/\(\)/.test(token) || word === 'function')) {
        const name = token.replace(/^function\s+/, '').replace(/\s*(\(\))?\s*\{$/, '');
        const body = block(['}']);
        if (typeof body === 'string') return body;
        if ((tokens[pos] ?? '') !== '}') return `syntax error: missing "}" for function ${name}`;
        pos++;
        statements.push({ kind: 'function', name, body });
      } else if (['then', 'do', 'done', 'fi', 'else', '}'].includes(word)) {
        return `syntax error near unexpected token \`${word}'`;
      } else {
        statements.push({ kind: 'simple', line: token });
      }
    }
    return statements;
  }

  const program = block([]);
  return program;
}

/** Integer arithmetic for $(( )) and (( )): + - * / % ** comparisons, ++ and += on variables. */
export function arithmetic(expr: string, env: Map<string, string>): number {
  const assign = /^\s*([A-Za-z_]\w*)\s*(\+\+|--|\+=|-=|\*=|=)\s*(.*)$/.exec(expr);
  if (assign && !/^==/.test(assign[2] ?? '')) {
    const [, name = '', op, rest = ''] = assign;
    const current = Number(env.get(name) ?? 0) || 0;
    const value = op === '++' ? current + 1 : op === '--' ? current - 1 : arithmetic(rest, env);
    const result =
      op === '+='
        ? current + value
        : op === '-='
          ? current - value
          : op === '*='
            ? current * value
            : value;
    env.set(name, String(result));
    return result;
  }
  const tokens = expr.match(/\d+|[A-Za-z_]\w*|\*\*|==|!=|<=|>=|&&|\|\||[-+*/%()<>!]/g) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++] ?? '0';
  const primary = (): number => {
    const t = next();
    if (t === '(') {
      const v = or();
      next();
      return v;
    }
    if (t === '-') return -primary();
    if (t === '!') return primary() ? 0 : 1;
    if (/^\d/.test(t)) return Number(t);
    return Number(env.get(t) ?? 0) || 0;
  };
  const power = (): number => {
    const base = primary();
    if (peek() === '**') {
      next();
      return base ** power();
    }
    return base;
  };
  const term = (): number => {
    let v = power();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const r = power();
      v = op === '*' ? v * r : op === '/' ? Math.trunc(v / (r || 1)) : v % (r || 1);
    }
    return v;
  };
  const sum = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + term() : v - term();
    return v;
  };
  const compare = (): number => {
    const left = sum();
    const op = peek();
    if (op && ['<', '>', '<=', '>=', '==', '!='].includes(op)) {
      next();
      const right = sum();
      const r =
        op === '<'
          ? left < right
          : op === '>'
            ? left > right
            : op === '<='
              ? left <= right
              : op === '>='
                ? left >= right
                : op === '=='
                  ? left === right
                  : left !== right;
      return r ? 1 : 0;
    }
    return left;
  };
  const and = (): number => {
    let v = compare();
    while (peek() === '&&') {
      next();
      const r = compare();
      v = v && r ? 1 : 0;
    }
    return v;
  };
  const or = (): number => {
    let v = and();
    while (peek() === '||') {
      next();
      const r = and();
      v = v || r ? 1 : 0;
    }
    return v;
  };
  return or();
}

export class BashRunner {
  private outputs: string[] = [];
  private errored = false;
  private exitedWithCode = false;
  private exitOnError = false;
  private explanations = new Set<string>();

  constructor(private readonly host: BashHost) {}

  /** Runs a parsed program and returns everything it printed. */
  run(program: Statement[]): CommandResult {
    let code = 0;
    try {
      this.block(program);
      code = this.host.status;
    } catch (error) {
      if (!(error instanceof Signal)) throw error;
      code = error.code;
      this.exitedWithCode = error.type === 'exit' && code !== 0;
      this.host.status = code;
    }
    return {
      output: this.outputs.join('\n'),
      error: this.errored || this.exitedWithCode || undefined,
      exitCode: code,
      explanation: [...this.explanations].join(' ') || undefined,
    };
  }

  private block(statements: Statement[]): void {
    for (const statement of statements) this.statement(statement);
  }

  private statement(statement: Statement): void {
    switch (statement.kind) {
      case 'function':
        this.host.functions.set(statement.name, statement.body);
        this.host.status = 0;
        return;
      case 'if': {
        for (const branch of statement.branches) {
          if (this.condition(branch.condition)) {
            this.block(branch.body);
            return;
          }
        }
        this.block(statement.otherwise);
        return;
      }
      case 'for': {
        const words = this.expandWords(statement.words);
        for (const word of words) {
          this.host.env.set(statement.variable, word);
          try {
            this.block(statement.body);
          } catch (error) {
            if (error instanceof Signal && error.type === 'break') break;
            if (error instanceof Signal && error.type === 'continue') continue;
            throw error;
          }
        }
        return;
      }
      case 'while': {
        let count = 0;
        while (this.condition(statement.condition) !== statement.until) {
          if (++count > MAX_LOOP) {
            this.print(`(stopped after ${MAX_LOOP} loops: is the condition ever false?)`);
            this.explanations.add(
              'An endless loop runs forever in real Bash: press Ctrl+C to stop it.',
            );
            return;
          }
          try {
            this.block(statement.body);
          } catch (error) {
            if (error instanceof Signal && error.type === 'break') break;
            if (error instanceof Signal && error.type === 'continue') continue;
            throw error;
          }
        }
        return;
      }
      case 'simple':
        this.simple(statement.line);
    }
  }

  private condition(text: string): boolean {
    let line = text.trim();
    let negate = false;
    if (line.startsWith('! ')) {
      negate = true;
      line = line.slice(2);
    }
    this.simple(line);
    const success = this.host.status === 0;
    return negate ? !success : success;
  }

  /** Expands the words of a for loop: variables, globs are left to the shell, brace ranges {1..5}. */
  private expandWords(text: string): string[] {
    if (text === '"$@"' || text === '$@') return [...this.host.positional];
    const result = this.host.runSimple(`__words ${text}`);
    return result.output ? result.output.split('\n') : [];
  }

  private simple(line: string): void {
    const [word = '', ...rest] = line.split(/\s+/);
    if (word === 'return') throw new Signal('return', Number(rest[0] ?? this.host.status) || 0);
    if (word === 'exit') throw new Signal('exit', Number(rest[0] ?? this.host.status) || 0);
    if (word === 'break') throw new Signal('break');
    if (word === 'continue') throw new Signal('continue');
    if (word === 'set' && rest[0] === '-e') {
      this.exitOnError = true;
      this.host.status = 0;
      this.explanations.add('set -e: the script stops at the first command that fails.');
      return;
    }
    if (
      word === 'set' &&
      (rest[0] === '-u' || rest[0] === '-x' || rest[0] === '-euo' || rest[0] === '-o')
    ) {
      if (rest[0]?.includes('e')) this.exitOnError = true;
      this.host.status = 0;
      return;
    }
    if (word === 'local') {
      if (rest.length) this.host.runSimple(rest.join(' '));
      this.host.status = 0;
      return;
    }
    if (word === 'shift') {
      this.host.positional = this.host.positional.slice(Number(rest[0] ?? 1) || 1);
      this.host.status = 0;
      return;
    }
    const fn = /\|\||&&|\||;/.test(line) ? undefined : this.host.functions.get(word);
    if (fn) {
      const args = this.host.runSimple(`__words ${rest.join(' ')}`).output;
      const saved = this.host.positional;
      this.host.positional = args ? args.split('\n') : [];
      try {
        this.block(fn);
      } catch (error) {
        if (!(error instanceof Signal) || error.type !== 'return') throw error;
        this.host.status = error.code;
      } finally {
        this.host.positional = saved;
      }
      return;
    }
    const result = this.host.runSimple(line);
    if (result.output) this.print(result.output);
    if (result.explanation && !result.error) this.explanations.add(result.explanation);
    if (result.error) {
      this.errored = true;
      if (result.explanation) this.explanations.add(result.explanation);
      if (this.exitOnError) throw new Signal('exit', this.host.status || 1);
    }
  }

  private print(text: string): void {
    this.outputs.push(text);
  }

  get failed(): boolean {
    return this.errored;
  }
}

/** Convenience: parse and run a script or one-liner. */
export function runBash(host: BashHost, lines: string[]): CommandResult {
  const program = parse(lines);
  if (typeof program === 'string') {
    host.status = 2;
    return { output: `bash: ${program}`, error: true, exitCode: 2 };
  }
  return new BashRunner(host).run(program);
}
