import { fail, ok, type CommandResult } from './types';

/**
 * Text tools for the Linux simulator: cut, sed, awk, tr, seq.
 * They work on a string (a file or the output of the previous pipe stage)
 * and support the options used in the lessons, not every option of the real tools.
 */

function lines(text: string): string[] {
  return text === '' ? [] : text.replace(/\n$/, '').split('\n');
}

/** Picks fields "1,3" or "2-4" or "3-" (1-based) out of a list. */
function pickRanges<T>(items: T[], spec: string): T[] {
  const out: T[] = [];
  for (const part of spec.split(',')) {
    const [a = '', b] = part.split('-');
    const start = a === '' ? 1 : Number(a);
    const end = b === undefined ? start : b === '' ? items.length : Number(b);
    for (let i = start; i <= end && i <= items.length; i++) {
      const item = items[i - 1];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

export function cut(args: string[], text: string): CommandResult {
  let delimiter = '\t';
  let fields: string | undefined;
  let chars: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg === '-d') delimiter = args[++i] ?? '\t';
    else if (arg.startsWith('-d')) delimiter = arg.slice(2);
    else if (arg === '-f') fields = args[++i];
    else if (arg.startsWith('-f')) fields = arg.slice(2);
    else if (arg === '-c') chars = args[++i];
    else if (arg.startsWith('-c')) chars = arg.slice(2);
  }
  if (!fields && !chars)
    return fail('cut: you must specify a list of fields (-f) or characters (-c)');
  const out = lines(text).map((line) =>
    chars
      ? pickRanges(line.split(''), chars).join('')
      : line.includes(delimiter)
        ? pickRanges(line.split(delimiter), fields ?? '1').join(delimiter)
        : line,
  );
  return ok(out.join('\n'));
}

export function tr(args: string[], text: string): CommandResult {
  const expandSet = (set: string) =>
    set
      .replace('[:lower:]', 'a-z')
      .replace('[:upper:]', 'A-Z')
      .replace('[:digit:]', '0-9')
      .replace(/(.)-(.)/g, (_, a: string, b: string) => {
        let out = '';
        for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) out += String.fromCharCode(c);
        return out;
      })
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
  if (args[0] === '-d') {
    const remove = expandSet(args[1] ?? '');
    return ok([...text].filter((c) => !remove.includes(c)).join(''));
  }
  if (args[0] === '-s') {
    const squeeze = expandSet(args[1] ?? ' ');
    let out = '';
    for (const c of text) if (!(squeeze.includes(c) && out.endsWith(c))) out += c;
    return ok(out);
  }
  const from = expandSet(args[0] ?? '');
  const to = expandSet(args[1] ?? '');
  if (!from) return fail('tr: missing operand. Example: tr a-z A-Z');
  return ok(
    [...text]
      .map((c) => {
        const index = from.indexOf(c);
        return index < 0 ? c : (to[Math.min(index, to.length - 1)] ?? c);
      })
      .join(''),
  );
}

export function seq(args: string[]): CommandResult {
  const nums = args.map(Number);
  if (nums.length === 0 || nums.some(Number.isNaN)) return fail('usage: seq [FIRST [STEP]] LAST');
  const [first, step, last] =
    nums.length === 1
      ? [1, 1, nums[0] ?? 1]
      : nums.length === 2
        ? [nums[0] ?? 1, 1, nums[1] ?? 1]
        : [nums[0] ?? 1, nums[1] ?? 1, nums[2] ?? 1];
  const out: number[] = [];
  for (let n = first; step > 0 ? n <= last : n >= last; n += step) {
    out.push(n);
    if (out.length > 10000) break;
  }
  return ok(out.join('\n'));
}

// ---------- sed ----------

interface SedCommand {
  address?: { line?: number; last?: boolean; regex?: RegExp; to?: number };
  action: 's' | 'd' | 'p';
  find?: RegExp;
  replace?: string;
}

function parseSedScript(script: string): SedCommand | string {
  let rest = script.trim();
  let address: SedCommand['address'];
  const lineRange = /^(\d+)(?:,(\d+|\$))?/.exec(rest);
  if (lineRange) {
    address = {
      line: Number(lineRange[1]),
      to: lineRange[2] === '$' ? Infinity : lineRange[2] ? Number(lineRange[2]) : undefined,
    };
    rest = rest.slice(lineRange[0].length);
  } else if (rest.startsWith('$')) {
    address = { last: true };
    rest = rest.slice(1);
  } else if (rest.startsWith('/')) {
    const end = rest.indexOf('/', 1);
    if (end < 0) return 'unterminated address regex';
    address = { regex: new RegExp(rest.slice(1, end)) };
    rest = rest.slice(end + 1);
  }
  if (rest === 'd') return { address, action: 'd' };
  if (rest === 'p') return { address, action: 'p' };
  if (rest.startsWith('s')) {
    const sep = rest[1] ?? '/';
    const parts: string[] = [];
    let current = '';
    for (let i = 2; i < rest.length; i++) {
      const c = rest[i] ?? '';
      if (c === '\\' && rest[i + 1] === sep) {
        current += sep;
        i++;
      } else if (c === sep) {
        parts.push(current);
        current = '';
      } else current += c;
    }
    parts.push(current);
    const [find = '', replace = '', flags = ''] = parts;
    if (parts.length < 3) return `unterminated 's' command`;
    let regex: RegExp;
    try {
      regex = new RegExp(
        find,
        `${flags.includes('g') ? 'g' : ''}${flags.includes('I') || flags.includes('i') ? 'i' : ''}`,
      );
    } catch {
      return `invalid regular expression: ${find}`;
    }
    return {
      address,
      action: 's',
      find: regex,
      replace: replace.replace(/&/g, '$&').replace(/\\(\d)/g, '$$$1'),
    };
  }
  return `unknown command: '${rest.slice(0, 1) || script}'`;
}

function matches(command: SedCommand, line: string, index: number, total: number): boolean {
  const a = command.address;
  if (!a) return true;
  if (a.last) return index === total;
  if (a.regex) return a.regex.test(line);
  if (a.line !== undefined) {
    if (a.to === undefined) return index === a.line;
    return index >= a.line && index <= a.to;
  }
  return true;
}

export interface SedResult {
  result: CommandResult;
  /** With -i: the new content to write back to this file. */
  write?: { file: string; content: string };
}

export function sed(
  args: string[],
  readFile: (path: string) => string | undefined,
  stdin: string,
): SedResult {
  let quiet = false;
  let inPlace = false;
  const scripts: string[] = [];
  const files: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg === '-n') quiet = true;
    else if (arg === '-i' || arg === '-i.bak') inPlace = true;
    else if (arg === '-e') scripts.push(args[++i] ?? '');
    else if (arg === '-E' || arg === '-r') continue;
    else if (scripts.length === 0) scripts.push(arg);
    else files.push(arg);
  }
  if (scripts.length === 0)
    return { result: fail(`usage: sed 's/old/new/g' file   or   sed -n '2,4p' file`) };
  const commands: SedCommand[] = [];
  for (const script of scripts.flatMap((s) => s.split(';'))) {
    const parsed = parseSedScript(script);
    if (typeof parsed === 'string') return { result: fail(`sed: -e expression #1: ${parsed}`) };
    commands.push(parsed);
  }
  let text = stdin;
  if (files.length > 0) {
    const parts: string[] = [];
    for (const file of files) {
      const content = readFile(file);
      if (content === undefined)
        return { result: fail(`sed: can't read ${file}: No such file or directory`) };
      parts.push(content);
    }
    text = parts.join('\n');
  }
  const input = lines(text);
  const out: string[] = [];
  input.forEach((original, i) => {
    let line = original;
    let deleted = false;
    for (const command of commands) {
      if (!matches(command, line, i + 1, input.length)) continue;
      if (command.action === 'd') {
        deleted = true;
        break;
      }
      if (command.action === 'p') out.push(line);
      if (command.action === 's' && command.find)
        line = line.replace(command.find, command.replace ?? '');
    }
    if (!deleted && !quiet) out.push(line);
  });
  const content = out.join('\n');
  if (inPlace && files[0])
    return {
      result: ok('', `sed -i changed ${files[0]} in place (no output). Check it with cat.`),
      write: { file: files[0], content },
    };
  return { result: ok(content) };
}

// ---------- awk ----------

interface AwkRule {
  pattern: string; // '' = every line, 'BEGIN', 'END', or a condition / /regex/
  action: string; // '' = print $0
}

function parseAwkProgram(program: string): AwkRule[] {
  const rules: AwkRule[] = [];
  let rest = program.trim();
  while (rest) {
    const brace = rest.indexOf('{');
    if (brace < 0) {
      rules.push({ pattern: rest.trim(), action: '' });
      break;
    }
    let depth = 0;
    let end = brace;
    for (let i = brace; i < rest.length; i++) {
      if (rest[i] === '{') depth++;
      if (rest[i] === '}') depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    rules.push({ pattern: rest.slice(0, brace).trim(), action: rest.slice(brace + 1, end).trim() });
    rest = rest.slice(end + 1).trim();
  }
  return rules;
}

type AwkValue = number | string;

/** A tiny, safe evaluator for awk expressions: no eval, works under a strict CSP. */
function awkExpression(expr: string, fields: string[], vars: Map<string, AwkValue>): AwkValue {
  const tokens =
    expr.match(
      /"(?:[^"\\]|\\.)*"|\/(?:[^/\\]|\\.)+\/|\$|\d+(?:\.\d+)?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||!~|[-+*/%<>!~()]/g,
    ) ?? [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++] ?? '';
  const num = (v: AwkValue) => (typeof v === 'number' ? v : Number(v) || 0);
  const field = (n: number): AwkValue => {
    const value = fields[n] ?? '';
    return value !== '' && !Number.isNaN(Number(value)) ? Number(value) : value;
  };
  const truthy = (v: AwkValue) => (typeof v === 'number' ? v !== 0 : v !== '');
  const matchRegex = (value: AwkValue, token: string) =>
    new RegExp(token.startsWith('/') ? token.slice(1, -1) : String(token)).test(String(value));

  function primary(): AwkValue {
    const token = next();
    if (token === '(') {
      const value = or();
      next(); // )
      return value;
    }
    if (token === '!') return truthy(primary()) ? 0 : 1;
    if (token === '-') return -num(primary());
    if (token === '$') {
      const target = peek() === '(' ? primary() : primary();
      return field(num(target));
    }
    if (token.startsWith('"'))
      return token.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    if (token.startsWith('/')) return matchRegex(fields[0] ?? '', token) ? 1 : 0;
    if (/^\d/.test(token)) return Number(token);
    if (/^[A-Za-z_]/.test(token)) {
      if (token === 'length') return String(fields[0] ?? '').length;
      return vars.get(token) ?? '';
    }
    throw new Error(`unexpected ${token}`);
  }
  function term(): AwkValue {
    let left = primary();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const right = num(primary());
      left = op === '*' ? num(left) * right : op === '/' ? num(left) / right : num(left) % right;
    }
    return left;
  }
  function sum(): AwkValue {
    let left = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const right = num(term());
      left = op === '+' ? num(left) + right : num(left) - right;
    }
    return left;
  }
  function compare(): AwkValue {
    const left = sum();
    const op = peek();
    if (op === '~' || op === '!~') {
      next();
      const token = next();
      const hit = matchRegex(left, token.startsWith('"') ? token.slice(1, -1) : token);
      return (op === '~') === hit ? 1 : 0;
    }
    if (op && ['==', '!=', '<', '<=', '>', '>='].includes(op)) {
      next();
      const right = sum();
      const bothNumbers = typeof left === 'number' && typeof right === 'number';
      const a = bothNumbers ? left : String(left);
      const b = bothNumbers ? right : String(right);
      const result =
        op === '=='
          ? a === b
          : op === '!='
            ? a !== b
            : op === '<'
              ? a < b
              : op === '<='
                ? a <= b
                : op === '>'
                  ? a > b
                  : a >= b;
      return result ? 1 : 0;
    }
    return left;
  }
  function and(): AwkValue {
    let left = compare();
    while (peek() === '&&') {
      next();
      const right = compare();
      left = truthy(left) && truthy(right) ? 1 : 0;
    }
    return left;
  }
  function or(): AwkValue {
    let left = and();
    while (peek() === '||') {
      next();
      const right = and();
      left = truthy(left) || truthy(right) ? 1 : 0;
    }
    return left;
  }
  const value = or();
  if (pos < tokens.length) throw new Error('unexpected tokens');
  return value;
}

function awkTrue(expr: string, fields: string[], vars: Map<string, AwkValue>): boolean {
  const value = awkExpression(expr, fields, vars);
  return typeof value === 'number' ? value !== 0 : value !== '';
}

function runAwkStatements(
  action: string,
  fields: string[],
  vars: Map<string, AwkValue>,
  ofs: string,
  out: string[],
): void {
  for (const raw of action.split(';')) {
    const statement = raw.trim();
    if (!statement) continue;
    const print = /^print(?:\s+(.*))?$/.exec(statement);
    const printf = /^printf\s+"([^"]*)"\s*,?\s*(.*)$/.exec(statement);
    const assign = /^([a-zA-Z_]\w*)\s*(\+=|-=|=|\+\+)\s*(.*)$/.exec(statement);
    if (print) {
      const list = print[1]?.trim();
      if (!list) {
        out.push(fields[0] ?? '');
        continue;
      }
      const parts = list.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((part) =>
        part
          .trim()
          .split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/)
          .map((piece) =>
            /^".*"$/.test(piece) ? piece.slice(1, -1) : String(awkExpression(piece, fields, vars)),
          )
          .join(''),
      );
      out.push(parts.join(ofs));
    } else if (printf) {
      const values = (printf[2] ?? '')
        .split(',')
        .filter((v) => v.trim())
        .map((v) => awkExpression(v.trim(), fields, vars));
      let i = 0;
      out.push(
        (printf[1] ?? '')
          .replace(
            /%(-?\d*)(?:\.(\d+))?([sdf])/g,
            (_, width: string, precision: string | undefined, type: string) => {
              const value = values[i++];
              let text =
                type === 'd'
                  ? String(Math.trunc(Number(value)))
                  : type === 'f'
                    ? Number(value).toFixed(precision ? Number(precision) : 6)
                    : String(value);
              const w = Number(width);
              if (w > 0) text = text.padStart(w);
              if (w < 0) text = text.padEnd(-w);
              return text;
            },
          )
          .replace(/\\n$/, ''),
      );
    } else if (assign) {
      const [, name = '', op, expr = ''] = assign;
      const current = Number(vars.get(name) ?? 0);
      if (op === '++') vars.set(name, current + 1);
      else {
        const value = awkExpression(expr, fields, vars);
        if (op === '+=') vars.set(name, current + Number(value));
        else if (op === '-=') vars.set(name, current - Number(value));
        else vars.set(name, value);
      }
    } else if (/^[a-zA-Z_]\w*\+\+$/.test(statement)) {
      const name = statement.slice(0, -2);
      vars.set(name, Number(vars.get(name) ?? 0) + 1);
    }
  }
}

export function awk(
  args: string[],
  readFile: (path: string) => string | undefined,
  stdin: string,
): CommandResult {
  let separator: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg === '-F') separator = args[++i];
    else if (arg.startsWith('-F')) separator = arg.slice(2);
    else rest.push(arg);
  }
  const [program, ...files] = rest;
  if (!program) return fail(`usage: awk '{print $1}' file   or   awk -F, '{print $2}' file.csv`);
  let text = stdin;
  if (files.length > 0) {
    const parts: string[] = [];
    for (const file of files) {
      const content = readFile(file);
      if (content === undefined)
        return fail(`awk: cannot open "${file}" (No such file or directory)`);
      parts.push(content);
    }
    text = parts.join('\n');
  }
  const rules = parseAwkProgram(program);
  const vars = new Map<string, AwkValue>();
  const out: string[] = [];
  const ofs = ' ';
  try {
    for (const rule of rules.filter((r) => r.pattern === 'BEGIN'))
      runAwkStatements(rule.action, [''], vars, ofs, out);
    lines(text).forEach((line, index) => {
      const split =
        separator === undefined
          ? line.trim().split(/\s+/).filter(Boolean)
          : line.split(separator === '\\t' ? '\t' : separator);
      const fields = [line, ...split];
      vars.set('NR', index + 1);
      vars.set('NF', split.length);
      for (const rule of rules) {
        if (rule.pattern === 'BEGIN' || rule.pattern === 'END') continue;
        if (rule.pattern && !awkTrue(rule.pattern, fields, vars)) continue;
        runAwkStatements(rule.action || 'print', fields, vars, ofs, out);
      }
    });
    for (const rule of rules.filter((r) => r.pattern === 'END'))
      runAwkStatements(rule.action, [''], vars, ofs, out);
  } catch {
    return fail(
      `awk: syntax error in program: ${program}`,
      "The simulator's awk knows print, printf, $1..$NF, NR, NF, -F, conditions like $3 > 100, /regex/, sum += $2 and BEGIN/END.",
    );
  }
  return ok(out.join('\n'));
}
