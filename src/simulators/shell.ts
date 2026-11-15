import { arithmetic, isCompound, runBash, type BashHost, type Statement } from './bash';
import { DockerEngine } from './docker';
import { du, SystemState } from './system';
import { awk, cut, sed, seq, tr } from './textTools';
import { fail, ok, splitWords, type CommandResult, type Simulator } from './types';

/**
 * A pretend Linux machine for the Linux and Docker tracks.
 * - a small file system in memory (your home folder has a project to explore)
 * - pipes (a | b), redirects (> and >>), && and ; chains, $VARIABLES, sudo
 * - permissions: ls -l, chmod, running ./script.sh needs the x bit,
 *   writing outside /home/guru and /tmp needs sudo
 * - docker commands are handled by DockerEngine, and curl localhost:<port>
 *   reaches containers that publish that port
 * Nothing touches the real computer.
 */

type FsNode =
  | { type: 'dir'; children: Map<string, FsNode>; mode: number; owner: string }
  | { type: 'file'; content: string; mode: number; owner: string };

const HOME = '/home/guru';

const SEED: Record<string, string> = {
  [`${HOME}/notes.txt`]: 'Learn Linux basics\nPractise grep and pipes\nTry Docker next',
  [`${HOME}/app/app.py`]:
    'from flask import Flask\n\napp = Flask(__name__)\n\n@app.get("/")\ndef home():\n    return "Hello from my app!"',
  [`${HOME}/app/requirements.txt`]: 'flask==3.0.3\ngunicorn==23.0.0',
  [`${HOME}/app/Dockerfile`]:
    'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]',
  [`${HOME}/app/compose.yaml`]:
    'services:\n  web:\n    build: .\n    ports:\n      - "8000:8000"\n    depends_on:\n      - redis\n  redis:\n    image: redis:7',
  [`${HOME}/logs/app.log`]: [
    '2026-11-15 09:00:01 INFO  Server started on port 8000',
    '2026-11-15 09:00:05 INFO  GET / 200 12ms',
    '2026-11-15 09:01:10 WARN  Slow query: 950ms',
    '2026-11-15 09:02:42 ERROR Database connection lost',
    '2026-11-15 09:02:43 INFO  Reconnected to database',
    '2026-11-15 09:05:17 ERROR Payment service timeout',
    '2026-11-15 09:06:00 INFO  GET /health 200 2ms',
  ].join('\n'),
  [`${HOME}/logs/access.log`]: [
    '192.168.1.10 - - [15/Nov/2026:09:00:01] "GET / HTTP/1.1" 200 512',
    '192.168.1.11 - - [15/Nov/2026:09:00:03] "GET /products HTTP/1.1" 200 2048',
    '10.0.0.5 - - [15/Nov/2026:09:00:04] "POST /login HTTP/1.1" 401 64',
    '192.168.1.10 - - [15/Nov/2026:09:00:07] "GET /products/7 HTTP/1.1" 200 1024',
    '10.0.0.5 - - [15/Nov/2026:09:00:09] "POST /login HTTP/1.1" 401 64',
    '203.0.113.9 - - [15/Nov/2026:09:00:12] "GET /admin HTTP/1.1" 403 128',
    '192.168.1.12 - - [15/Nov/2026:09:00:15] "GET /cart HTTP/1.1" 500 256',
    '10.0.0.5 - - [15/Nov/2026:09:00:16] "POST /login HTTP/1.1" 200 96',
    '192.168.1.11 - - [15/Nov/2026:09:00:20] "GET / HTTP/1.1" 200 512',
    '192.168.1.10 - - [15/Nov/2026:09:00:25] "GET /orders HTTP/1.1" 200 768',
  ].join('\n'),
  [`${HOME}/scripts/backup.sh`]:
    '#!/bin/bash\necho "Backing up notes..."\ncp notes.txt notes.bak\necho "Done"',
  '/etc/hostname': 'devguru',
  '/etc/hosts': '127.0.0.1   localhost\n127.0.1.1   devguru',
  '/etc/nginx/nginx.conf':
    'user www-data;\nworker_processes auto;\nhttp {\n    server {\n        listen 80;\n        server_name shop.example.com;\n        location / {\n            proxy_pass http://127.0.0.1:8000;\n        }\n    }\n}',
  '/etc/ssh/sshd_config':
    'Port 22\nPermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes',
  '/var/log/auth.log':
    'Nov 15 08:58:01 devguru sshd[2201]: Failed password for invalid user admin from 203.0.113.9 port 51122 ssh2\nNov 15 08:58:04 devguru sshd[2203]: Failed password for root from 203.0.113.9 port 51130 ssh2\nNov 15 09:01:12 devguru sshd[2210]: Accepted publickey for guru from 192.168.1.10 port 50311 ssh2\nNov 15 09:05:40 devguru sudo:     guru : TTY=pts/0 ; PWD=/home/guru ; USER=root ; COMMAND=/usr/bin/apt update',
  '/etc/os-release': 'NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu',
  '/var/log/syslog': 'Nov 15 09:00:00 devguru systemd[1]: Started Daily apt download activities.',
};

const EXPLAIN: Record<string, string> = {
  pwd: 'pwd = print working directory: the folder you are in now.',
  cd: 'cd = change directory. cd .. goes up one level, cd ~ goes home, cd - goes back.',
  ls: 'ls lists a folder. -l shows details (permissions, owner, size), -a shows hidden files too.',
  mkdir: 'mkdir makes a folder. -p makes parent folders too and does not complain if it exists.',
  rmdir: 'rmdir removes an EMPTY folder.',
  touch: 'touch creates an empty file (or updates the time of an existing one).',
  cat: 'cat prints the whole file.',
  echo: 'echo prints text. With > it writes the text into a file (replacing it), >> adds to the end.',
  rm: 'rm deletes files. -r deletes folders with everything inside. There is no recycle bin!',
  cp: 'cp copies. cp -r copies a folder.',
  mv: 'mv moves or renames.',
  head: 'head shows the first lines (default 10). -n 3 shows 3 lines.',
  tail: 'tail shows the last lines. tail -f keeps showing new lines as a log grows.',
  wc: 'wc counts. -l lines, -w words, -c bytes.',
  grep: 'grep keeps only lines that contain a pattern. -i ignore case, -n line numbers, -c count, -v invert.',
  sort: 'sort puts lines in order. -r reverse, -n numbers.',
  uniq: 'uniq removes repeated neighbouring lines (sort first). -c counts them.',
  find: 'find searches folders for files by name: find . -name "*.py"',
  chmod:
    'chmod changes permissions. r=4 w=2 x=1 for owner, group, others. 755 = rwxr-xr-x. +x adds execute.',
  chown: 'chown changes the owner of a file (needs sudo).',
  whoami: 'whoami prints your user name.',
  id: 'id shows your user id and the groups you belong to.',
  sudo: 'sudo runs one command as root (the admin user). Use it only when needed.',
  ps: 'ps lists running processes. Each has a PID (process id).',
  top: 'top shows live CPU and memory use per process (this is a snapshot).',
  kill: 'kill sends a signal to a process. kill PID asks it to stop; kill -9 PID forces it.',
  df: 'df -h shows free disk space in human sizes (G, M).',
  free: 'free -h shows RAM: total, used and available.',
  uname: 'uname -a shows the kernel and machine type.',
  history: 'history lists the commands you typed.',
  env: 'env lists environment variables: settings that programs read, such as PATH.',
  export:
    'export NAME=value sets an environment variable for this shell and the programs it starts.',
  which: 'which shows where a command program is stored.',
  curl: 'curl sends an HTTP request from the terminal and prints the response.',
  apt: 'apt installs software from Ubuntu’s package repositories. It needs sudo.',
  ip: 'ip a shows the network interfaces and their IP addresses.',
  ping: 'ping checks that another machine answers, and how long the round trip takes.',
  tree: 'tree draws the folder structure.',
  man: 'man shows the manual of a command. In the simulator it shows a short explanation.',
  date: 'date prints the current date and time.',
  uptime: 'uptime shows how long the machine has been running and the load average.',
  hostname: 'hostname prints the machine name.',
  ln: 'ln -s makes a shortcut (symbolic link) to a file.',
};

const COMMANDS = Object.keys(EXPLAIN);

function newDir(owner = 'root', mode = 0o755): FsNode {
  return { type: 'dir', children: new Map(), mode, owner };
}

function modeString(node: FsNode): string {
  const bits = node.mode;
  const part = (shift: number) =>
    `${bits & (4 << shift) ? 'r' : '-'}${bits & (2 << shift) ? 'w' : '-'}${bits & (1 << shift) ? 'x' : '-'}`;
  return `${node.type === 'dir' ? 'd' : '-'}${part(6)}${part(3)}${part(0)}`;
}

/** Turns a glob such as *.py into a regular expression. */
function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

/** Splits on a separator (such as | or &&) but not inside quotes. */
function splitOutsideQuotes(text: string, separators: string[]): { part: string; sep: string }[] {
  const parts: { part: string; sep: string }[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0; // inside $( ... ) or (( ... ))
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') depth++;
    if (char === ')' && depth > 0) depth--;
    const sep = depth > 0 ? undefined : separators.find((s) => text.startsWith(s, i));
    if (sep && !(sep === '|' && (text[i + 1] === '|' || text[i - 1] === '|'))) {
      parts.push({ part: current, sep });
      current = '';
      i += sep.length - 1;
      continue;
    }
    current += char;
  }
  parts.push({ part: current, sep: '' });
  return parts;
}

/** Index of the last `char` that is not inside quotes, or -1. */
function lastOutsideQuotes(text: string, char: string): number {
  let quote: string | null = null;
  let found = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === char) found = i;
  }
  return found;
}

export interface ShellContext {
  sudo: boolean;
  stdin: string | null;
}

export class ShellSimulator implements Simulator, BashHost {
  readonly root: FsNode = newDir();
  cwd = HOME;
  private previous = HOME;
  readonly env = new Map<string, string>([
    ['HOME', HOME],
    ['USER', 'guru'],
    ['SHELL', '/bin/bash'],
    ['PATH', '/usr/local/bin:/usr/bin:/bin'],
    ['LANG', 'en_IN.UTF-8'],
  ]);
  readonly typed: string[] = [];
  readonly docker: DockerEngine;
  readonly system = new SystemState();
  readonly functions = new Map<string, Statement[]>();
  /** Exit status of the last command ($?). */
  status = 0;
  /** $1, $2 ... inside a script or function. */
  positional: string[] = [];
  private scriptName = 'bash';
  private processes = [
    { pid: 1, user: 'root', cmd: '/sbin/init' },
    { pid: 412, user: 'root', cmd: '/usr/sbin/sshd -D' },
    { pid: 977, user: 'guru', cmd: '-bash' },
    { pid: 1204, user: 'guru', cmd: 'python3 -m http.server 9000' },
  ];
  private installed = new Set<string>(['curl', 'git', 'python3']);

  constructor() {
    for (const dir of ['/bin', '/etc', '/tmp', '/usr/bin', '/var/log', HOME])
      this.mkdirp(dir, dir === '/tmp' ? 'root' : undefined);
    const home = this.node(HOME);
    if (home) home.owner = 'guru';
    for (const [path, content] of Object.entries(SEED)) {
      const dir = path.slice(0, path.lastIndexOf('/'));
      this.mkdirp(dir);
      this.writeFile(path, content, path.startsWith(HOME) ? 'guru' : 'root');
    }
    const tmp = this.node('/tmp');
    if (tmp) tmp.mode = 0o777;
    this.docker = new DockerEngine(this);
    this.syncUsers();
  }

  prompt(): string {
    const where =
      this.cwd === HOME
        ? '~'
        : this.cwd.startsWith(`${HOME}/`)
          ? `~${this.cwd.slice(HOME.length)}`
          : this.cwd;
    return `guru@devguru:${where}$`;
  }

  // ---------- file system helpers (also used by DockerEngine) ----------

  resolvePath(path: string): string {
    let full = path;
    if (path === '~' || path.startsWith('~/')) full = HOME + path.slice(1);
    else if (!path.startsWith('/')) full = `${this.cwd}/${path}`;
    const out: string[] = [];
    for (const part of full.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    return `/${out.join('/')}`;
  }

  node(path: string): FsNode | undefined {
    let current: FsNode | undefined = this.root;
    for (const part of path.split('/').filter(Boolean)) {
      if (current?.type !== 'dir') return undefined;
      current = current.children.get(part);
    }
    return current;
  }

  readFile(path: string): string | undefined {
    const found = this.node(this.resolvePath(path));
    return found?.type === 'file' ? found.content : undefined;
  }

  /** Files directly or deeply inside a folder, as path -> content. */
  filesUnder(path: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (node: FsNode, prefix: string) => {
      if (node.type === 'file') out[prefix] = node.content;
      else
        for (const [name, child] of node.children) walk(child, prefix ? `${prefix}/${name}` : name);
    };
    const start = this.node(this.resolvePath(path));
    if (start) walk(start, '');
    return out;
  }

  private mkdirp(path: string, owner?: string): void {
    let current = this.root;
    for (const part of path.split('/').filter(Boolean)) {
      if (current.type !== 'dir') return;
      let next = current.children.get(part);
      if (!next) {
        next = newDir(owner ?? (path.startsWith(HOME) ? 'guru' : 'root'));
        current.children.set(part, next);
      }
      current = next;
    }
  }

  private parentOf(path: string): { dir: FsNode | undefined; name: string } {
    const index = path.lastIndexOf('/');
    return { dir: this.node(path.slice(0, index) || '/'), name: path.slice(index + 1) };
  }

  private writeFile(path: string, content: string, owner = 'guru'): void {
    const { dir, name } = this.parentOf(path);
    if (dir?.type !== 'dir') return;
    const existing = dir.children.get(name);
    if (existing?.type === 'file') existing.content = content;
    else dir.children.set(name, { type: 'file', content, mode: 0o644, owner });
  }

  private canWrite(path: string, sudo: boolean): boolean {
    return sudo || path === HOME || path.startsWith(`${HOME}/`) || path.startsWith('/tmp');
  }

  // ---------- running a command line ----------

  run(line: string): CommandResult {
    const trimmed = line.trim();
    if (trimmed === '') return ok('');
    this.typed.push(trimmed);
    const first = trimmed.split(/[\s;|&]/)[0] ?? '';
    if (isCompound(trimmed) || this.functions.has(first)) return runBash(this, [trimmed]);
    return this.runSimple(trimmed);
  }

  /** Runs a command line with ; && || chains (used by run() and by the Bash interpreter). */
  runSimple(line: string): CommandResult {
    const chain = splitOutsideQuotes(line.trim(), ['&&', '||', ';']);
    const outputs: string[] = [];
    let last: CommandResult = ok('');
    let previousSep = '';
    for (const { part, sep } of chain) {
      const runIt =
        previousSep === '' ||
        previousSep === ';' ||
        (previousSep === '&&' && this.status === 0) ||
        (previousSep === '||' && this.status !== 0);
      previousSep = sep;
      if (!runIt || !part.trim()) continue;
      const text = part.trim();
      const firstWord = text.split(/\s+/)[0] ?? '';
      last = /^\(\(.*\)\)$/.test(text)
        ? this.arithmeticCommand(text.slice(2, -2))
        : this.functions.has(firstWord) && !text.includes('|')
          ? runBash(this, [text])
          : this.pipeline(text);
      this.status = last.exitCode ?? (last.error ? 1 : 0);
      if (last.clear) return last;
      if (last.output) outputs.push(last.output);
    }
    return { ...last, output: outputs.join('\n') };
  }

  private arithmeticCommand(expr: string): CommandResult {
    const value = arithmetic(this.expand(expr), this.env);
    return { output: '', exitCode: value === 0 ? 1 : 0 };
  }

  /** Expands $VAR, ${VAR}, ${VAR:-default}, ${#VAR}, $1 $# $@ $? $(command) and $((arithmetic)); nothing inside 'single quotes'. */
  private expand(text: string): string {
    let out = '';
    let quote: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i] ?? '';
      if (quote === "'") {
        out += c;
        if (c === "'") quote = null;
        continue;
      }
      if (c === "'" && !quote) {
        quote = "'";
        out += c;
        continue;
      }
      if (c === '"') {
        quote = quote === '"' ? null : '"';
        out += c;
        continue;
      }
      if (c === '\\' && text[i + 1] === '$') {
        out += '$';
        i++;
        continue;
      }
      if (c !== '$') {
        out += c;
        continue;
      }
      if (text.startsWith('$((', i)) {
        const end = this.closing(text, i + 1, '(', ')');
        if (end > 0) {
          out += String(arithmetic(this.expand(text.slice(i + 3, end - 1)), this.env));
          i = end;
          continue;
        }
      }
      if (text[i + 1] === '(') {
        const end = this.closing(text, i + 1, '(', ')');
        if (end > 0) {
          const inner = text.slice(i + 2, end);
          const saved = this.status;
          const result = this.runSimple(inner);
          this.status = result.error ? 1 : saved;
          out += result.output.replace(/\n+$/, '');
          i = end;
          continue;
        }
      }
      if (text[i + 1] === '{') {
        const end = text.indexOf('}', i);
        if (end > 0) {
          const inner = text.slice(i + 2, end);
          if (inner.startsWith('#')) out += String(this.variable(inner.slice(1)).length);
          else {
            const [name = '', fallback] = inner.split(':-');
            const value = this.variable(name);
            out += value === '' && fallback !== undefined ? fallback : value;
          }
          i = end;
          continue;
        }
      }
      const match = /^\$([A-Za-z_]\w*|[0-9]|[?#@*$])/.exec(text.slice(i));
      if (match) {
        out += this.variable(match[1] ?? '');
        i += (match[0]?.length ?? 1) - 1;
        continue;
      }
      out += c;
    }
    return out;
  }

  private variable(name: string): string {
    if (name === '?') return String(this.status);
    if (name === '#') return String(this.positional.length);
    if (name === '@' || name === '*') return this.positional.join(' ');
    if (name === '$') return '4242';
    if (name === '0') return this.scriptName;
    if (/^\d$/.test(name)) return this.positional[Number(name) - 1] ?? '';
    return this.env.get(name) ?? '';
  }

  /** Index of the bracket that closes the one at `start`, or -1. */
  private closing(text: string, start: number, open: string, close: string): number {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === open) depth++;
      if (text[i] === close) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  private pipeline(text: string): CommandResult {
    const stages = splitOutsideQuotes(text, ['|']).map((s) => s.part.trim());
    let stdin: string | null = null;
    let result: CommandResult = ok('');
    const explanations: string[] = [];
    for (let i = 0; i < stages.length; i++) {
      let stage = (stages[i] ?? '').replace(/\s+2>&1/g, '').replace(/\s+2>\s*\/dev\/null/g, '');
      if (/\s(&>|>)\s*\/dev\/null$/.test(stage)) {
        result = this.command(
          splitWords(this.expand(stage.replace(/\s(&>|>)\s*\/dev\/null$/, ''))),
          { sudo: false, stdin },
        );
        if (result.error) return { ...result, output: '' };
        stdin = '';
        result = { ...result, output: '' };
        continue;
      }
      let redirect: { file: string; append: boolean } | null = null;
      if (i === stages.length - 1) {
        const at = lastOutsideQuotes(stage, '>');
        const match = at >= 0 ? /^\s*(\S+)$/.exec(stage.slice(at + 1)) : null;
        const append = at > 0 && stage[at - 1] === '>';
        const before = stage.slice(0, append ? at - 1 : at);
        if (match && !/^\s*$/.test(before)) {
          stage = before.trimEnd();
          redirect = { file: match[1] ?? '', append };
        }
      }
      result = this.command(splitWords(this.expand(stage)), { sudo: false, stdin });
      if (result.explanation) explanations.push(result.explanation);
      if (result.error) return result;
      stdin = result.output;
      if (redirect) {
        const path = this.resolvePath(redirect.file);
        if (!this.canWrite(path, false)) {
          return fail(
            `bash: ${redirect.file}: Permission denied`,
            'Files outside your home folder belong to root. Use sudo tee for those.',
          );
        }
        const before = this.readFile(path);
        const content =
          redirect.append && before !== undefined ? `${before}\n${result.output}` : result.output;
        const { dir } = this.parentOf(path);
        if (dir?.type !== 'dir') return fail(`bash: ${redirect.file}: No such file or directory`);
        this.writeFile(path, content);
        result = { ...result, output: '' };
        if (!result.explanation)
          explanations.push(
            redirect.append
              ? '>> added the output to the end of the file.'
              : '> wrote the output into the file (replacing what was there).',
          );
      }
    }
    if (stages.length > 1)
      explanations.push('| (pipe) sends the output of one command into the next one.');
    return { ...result, explanation: [...new Set(explanations)].join(' ') || undefined };
  }

  /** Runs one command. Exposed so DockerEngine can run commands "inside" a container. */
  command(words: string[], ctx: ShellContext): CommandResult {
    const [name, ...args] = words;
    if (!name) return ok('');
    if (/^\w+=/.test(name) && args.length === 0) {
      const [key = '', ...value] = name.split('=');
      this.env.set(key, value.join('='));
      return ok('', 'Set a shell variable. Use export to pass it to programs you start.');
    }
    const result = this.dispatch(name, args, ctx);
    if (result.explanation === undefined && EXPLAIN[name])
      return { ...result, explanation: EXPLAIN[name] };
    return result;
  }

  private dispatch(name: string, args: string[], ctx: ShellContext): CommandResult {
    switch (name) {
      case 'sudo':
        return this.sudo(args, ctx);
      case 'docker':
        return this.docker.run(args);
      case 'pwd':
        return ok(this.cwd);
      case 'cd':
        return this.cd(args[0]);
      case 'ls':
        return this.ls(args);
      case 'tree':
        return this.tree(args[0] ?? '.');
      case 'mkdir':
        return this.mkdir(args, ctx);
      case 'rmdir':
        return this.rmdir(args, ctx);
      case 'touch':
        return this.touch(args, ctx);
      case 'cat':
      case 'less':
      case 'more':
        return this.cat(args, ctx);
      case 'echo': {
        const text = args.filter((a) => a !== '-e' && a !== '-n').join(' ');
        return ok(args.includes('-e') ? text.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : text);
      }
      case 'rm':
        return this.rm(args, ctx);
      case 'cp':
      case 'mv':
        return this.copyMove(name, args, ctx);
      case 'head':
      case 'tail':
        return this.headTail(name, args, ctx);
      case 'wc':
        return this.wc(args, ctx);
      case 'grep':
        return this.grep(args, ctx);
      case 'sort':
        return this.sort(args, ctx);
      case 'uniq':
        return this.uniq(args, ctx);
      case 'find':
        return this.find(args, ctx);
      case 'chmod':
        return this.chmod(args, ctx);
      case 'chown':
        return ctx.sudo
          ? ok('')
          : fail(
              `chown: changing ownership of '${args[1] ?? ''}': Operation not permitted`,
              'Changing the owner needs sudo.',
            );
      case 'whoami':
        return ok(ctx.sudo ? 'root' : 'guru');
      case 'id':
        return ctx.sudo && args.length === 0
          ? ok('uid=0(root) gid=0(root) groups=0(root)')
          : this.system.id(args, 'guru');
      case 'hostname':
        return ok('devguru');
      case 'uname':
        return ok(
          args.includes('-a')
            ? 'Linux devguru 6.8.0-48-generic #48-Ubuntu SMP x86_64 GNU/Linux'
            : 'Linux',
        );
      case 'date': {
        const format = args.find((a) => a.startsWith('+'));
        if (!format) return ok('Sun Nov 15 09:30:00 IST 2026');
        return ok(
          format
            .slice(1)
            .replace(/%F/g, '2026-11-15')
            .replace(/%Y/g, '2026')
            .replace(/%m/g, '11')
            .replace(/%d/g, '15')
            .replace(/%H/g, '09')
            .replace(/%M/g, '30')
            .replace(/%S/g, '00')
            .replace(/%T/g, '09:30:00'),
        );
      }
      case 'uptime':
        return ok(' 09:30:00 up 3 days,  4:12,  1 user,  load average: 0.15, 0.10, 0.05');
      case 'df':
        return ok(
          'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        40G   18G   20G  48% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm',
        );
      case 'free':
        return ok(
          '               total        used        free      shared  buff/cache   available\nMem:           3.8Gi       1.2Gi       1.1Gi        12Mi       1.5Gi       2.4Gi\nSwap:          2.0Gi          0B       2.0Gi',
        );
      case 'ps':
        return this.ps();
      case 'top':
        return this.top();
      case 'kill':
        return this.kill(args, ctx);
      case 'history':
        return ok(this.typed.map((t, i) => `${String(i + 1).padStart(5)}  ${t}`).join('\n'));
      case 'env':
      case 'printenv':
        if (name === 'printenv' && args[0])
          return this.env.has(args[0])
            ? ok(this.env.get(args[0]) ?? '')
            : { output: '', exitCode: 1 };
        return ok([...this.env].map(([k, v]) => `${k}=${v}`).join('\n'));
      case 'export':
        for (const pair of args) {
          const [key = '', ...value] = pair.split('=');
          if (key) this.env.set(key, value.join('='));
        }
        return ok('');
      case 'which':
        return args[0] &&
          (COMMANDS.includes(args[0]) || this.installed.has(args[0]) || args[0] === 'docker')
          ? ok(`/usr/bin/${args[0]}`)
          : fail('');
      case 'man':
      case 'help':
        return this.help(args[0]);
      case 'curl':
        return this.curl(args);
      case 'apt':
      case 'apt-get':
        return this.apt(args, ctx);
      case 'ip':
      case 'ifconfig':
        return ok(
          '1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 172.31.5.20/20 brd 172.31.15.255 scope global eth0\n3: docker0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 172.17.0.1/16 scope global docker0',
        );
      case 'ping':
        return ok(
          `PING ${args.find((a) => !a.startsWith('-')) ?? 'localhost'}: 56 data bytes\n64 bytes: icmp_seq=1 ttl=117 time=21.4 ms\n64 bytes: icmp_seq=2 ttl=117 time=20.9 ms\n--- 2 packets transmitted, 2 received, 0% packet loss`,
          'ping checks that another machine answers. (The simulator shows a sample reply.)',
        );
      case 'clear':
        return { output: '', clear: true };
      case 'nano':
      case 'vim':
      case 'vi':
        return fail(
          `${name}: editors do not run in the simulator`,
          'Write files with echo "text" > file or add lines with echo "text" >> file.',
        );
      case 'ssh':
        return ok(
          `(simulator) ssh connects to a remote server: ssh -i key.pem ubuntu@<server-ip>`,
          'ssh opens a secure terminal on another machine. The simulator cannot connect anywhere.',
        );
      case 'ln':
        return ok('');
      case 'exit':
        return ok('logout (the simulator stays open)');
      case '[':
      case '[[':
      case 'test':
        return this.test(name === 'test' ? args : args.slice(0, -1));
      case 'true':
        return ok('');
      case 'false':
        return { output: '', exitCode: 1 };
      case 'sleep':
        return ok('', 'sleep N waits N seconds (the simulator does not really wait).');
      case '__words':
        return ok(this.words(args).join('\n'));
      case 'basename':
        return ok(
          (args[0] ?? '')
            .replace(/\/$/, '')
            .split('/')
            .pop()
            ?.replace(args[1] ?? '\u0000', '') ?? '',
        );
      case 'dirname': {
        const path = (args[0] ?? '').replace(/\/$/, '');
        return ok(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) || '/' : '.');
      }
      case 'cut':
      case 'tr': {
        const files = name === 'cut' ? this.fileArgs(args, ['-d', '-f', '-c']) : [];
        const text = this.input(files, ctx, name);
        if (typeof text !== 'string') return text;
        const options = args.filter((a) => !files.includes(a));
        return name === 'cut' ? cut(options, text) : tr(options, text);
      }
      case 'sed': {
        const { result, write } = sed(args, (path) => this.readFile(path), ctx.stdin ?? '');
        if (write) {
          const path = this.resolvePath(write.file);
          if (!this.canWrite(path, ctx.sudo))
            return fail(`sed: couldn't open ${write.file}: Permission denied`);
          this.writeFile(path, write.content);
        }
        return result;
      }
      case 'awk':
        return awk(args, (path) => this.readFile(path), ctx.stdin ?? '');
      case 'seq':
        return seq(args);
      case 'tee': {
        const append = args.includes('-a');
        for (const file of args.filter((a) => !a.startsWith('-'))) {
          const path = this.resolvePath(file);
          if (!this.canWrite(path, ctx.sudo))
            return fail(
              `tee: ${file}: Permission denied`,
              'Use sudo tee to write files that belong to root.',
            );
          const before = this.readFile(path);
          this.writeFile(
            path,
            append && before !== undefined ? `${before}\n${ctx.stdin ?? ''}` : (ctx.stdin ?? ''),
          );
        }
        return ok(
          ctx.stdin ?? '',
          'tee writes its input to the file AND prints it, like a T-junction in a pipe.',
        );
      }
      case 'du': {
        const target = args.find((a) => !a.startsWith('-')) ?? '.';
        if (!this.node(this.resolvePath(target)))
          return fail(`du: cannot access '${target}': No such file or directory`);
        return du(args, this.filesUnder(target), target);
      }
      case 'systemctl':
        return this.system.systemctl(args, ctx.sudo);
      case 'service':
        return this.system.systemctl([args[1] ?? 'status', args[0] ?? ''], ctx.sudo);
      case 'journalctl':
        return this.system.journalctl(args);
      case 'useradd':
      case 'adduser': {
        const result = this.system.useradd(args, ctx.sudo);
        if (!result.error)
          this.syncUsers(
            args.includes('-m') || name === 'adduser'
              ? args.filter((a) => !a.startsWith('-')).pop()
              : undefined,
          );
        return result;
      }
      case 'usermod':
      case 'groupadd': {
        const result =
          name === 'usermod'
            ? this.system.usermod(args, ctx.sudo)
            : this.system.groupadd(args, ctx.sudo);
        if (!result.error) this.syncUsers();
        return result;
      }
      case 'groups':
        return this.system.groups(args, 'guru');
      case 'passwd':
        return args[0] && !ctx.sudo
          ? fail(
              'passwd: You may not view or modify password information for ' + args[0] + '.',
              "Changing another user's password needs sudo.",
            )
          : ok(
              'New password: \nRetype new password: \npasswd: password updated successfully',
              'In a real terminal passwd asks for the password twice and shows nothing while you type.',
            );
      case 'su':
        return ok(
          '',
          `su switches to another user (su - ${args[args.length - 1] ?? 'root'}). In the simulator you stay guru; use sudo for admin commands.`,
        );
      case 'crontab':
        return this.system.crontabCommand(args, ctx.stdin);
      case 'ss':
      case 'netstat':
        return this.system.ss(this.docker.publishedPorts());
      case 'scp':
        return ok(
          `${(args.find((a) => !a.startsWith('-') && !a.includes(':') && !a.endsWith('.pem')) ?? 'file').split('/').pop() ?? 'file'}                100%   12KB   1.1MB/s   00:00`,
          'scp copies files over SSH: scp file user@server:/path uploads, scp user@server:/path . downloads. (Simulated.)',
        );
      case 'wget':
        return ok(
          `--2026-11-15 09:30:00--  ${args.find((a) => !a.startsWith('-')) ?? ''}\nHTTP request sent, awaiting response... 200 OK\nSaving to: '${(args.find((a) => !a.startsWith('-')) ?? 'index.html').split('/').pop() || 'index.html'}'`,
          'wget downloads a file from a URL. (The simulator does not reach the internet.)',
        );
      case 'bash':
      case 'sh':
      case 'source':
      case '.':
        if (!args[0]) return ok('', 'Opens a new shell. In the simulator you are already in Bash.');
        return this.runScript(args[0], args.slice(1), ctx, true);
      default:
        if (name.startsWith('./') || name.startsWith('/') || name.startsWith('~/'))
          return this.runScript(name, args, ctx);
        if (name === 'python3' || name === 'python')
          return ok(
            'Python 3.12.3',
            'Python runs in the Python track playground. Here: python3 --version',
          );
        return {
          ...fail(
            `${name}: command not found`,
            `Type help to see the commands this simulator knows.`,
          ),
          exitCode: 127,
        };
    }
  }

  private help(topic?: string): CommandResult {
    if (topic) {
      const text =
        EXPLAIN[topic] ??
        (topic === 'docker' ? 'docker manages containers. Try docker help.' : undefined);
      return text ? ok(text) : fail(`No manual entry for ${topic}`);
    }
    return ok(
      [
        'Folders:  pwd  ls [-la]  cd <dir>  mkdir [-p]  rmdir  tree',
        'Files:    cat  touch  echo "text" > file  cp  mv  rm [-r]  head  tail  find . -name "*.py"',
        'Text:     grep [-i -n -c -v]  wc -l  sort  uniq -c   (join with |)',
        'Rights:   ls -l  chmod 755 file  chmod +x file  ./script.sh  sudo  whoami  id',
        "Text+:    cut -d, -f2  sed 's/a/b/g'  awk '{print $1}'  tr a-z A-Z  tee  seq",
        'System:   ps  top  kill  df -h  du -sh  free -h  uname -a  env  export NAME=value  history',
        'Services: systemctl status|start|stop|restart|enable nginx  journalctl -u nginx',
        'Users:    sudo useradd -m name  sudo usermod -aG docker name  groups  id  passwd',
        'Scripts:  bash file.sh  ./file.sh  if/elif/else/fi  for/while ... do/done  name() { }  $? $1 $#',
        'Cron:     crontab -l   echo "0 2 * * * cmd" | crontab -',
        'Network:  curl localhost:8000  ip a  ping  ss -tulpn  ssh  scp  wget',
        'Docker:   docker help',
      ].join('\n'),
    );
  }

  private sudo(args: string[], ctx: ShellContext): CommandResult {
    const [name, ...rest] = args;
    if (!name) return fail('usage: sudo <command>');
    const result = this.dispatch(name, rest, { ...ctx, sudo: true });
    return {
      ...result,
      explanation: `${EXPLAIN.sudo} ${result.explanation ?? EXPLAIN[name] ?? ''}`.trim(),
    };
  }

  private cd(target?: string): CommandResult {
    const dest =
      target === undefined ? HOME : target === '-' ? this.previous : this.resolvePath(target);
    const found = this.node(dest);
    if (!found) return fail(`bash: cd: ${target}: No such file or directory`);
    if (found.type !== 'dir') return fail(`bash: cd: ${target}: Not a directory`);
    this.previous = this.cwd;
    this.cwd = dest;
    return ok(target === '-' ? dest : '');
  }

  private ls(args: string[]): CommandResult {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const long = flags.includes('l');
    const all = flags.includes('a');
    const paths = args.filter((a) => !a.startsWith('-'));
    const outputs: string[] = [];
    for (const path of paths.length > 0 ? paths : ['.']) {
      const full = this.resolvePath(path);
      const found = this.node(full);
      if (!found) return fail(`ls: cannot access '${path}': No such file or directory`);
      const entries: [string, FsNode][] =
        found.type === 'dir'
          ? [...found.children].sort(([a], [b]) => a.localeCompare(b))
          : [[path, found]];
      const visible = entries.filter(([n]) => all || !n.startsWith('.'));
      if (paths.length > 1) outputs.push(`${path}:`);
      if (long) {
        const rows = visible.map(([n, node]) => {
          const size = node.type === 'file' ? node.content.length : 4096;
          return `${modeString(node)} 1 ${node.owner.padEnd(5)} ${node.owner.padEnd(5)} ${String(size).padStart(5)} Nov 15 09:00 ${n}${node.type === 'dir' ? '/' : ''}`;
        });
        if (all)
          rows.unshift(
            `drwxr-xr-x 1 guru  guru   4096 Nov 15 09:00 ./`,
            `drwxr-xr-x 1 root  root   4096 Nov 15 09:00 ../`,
          );
        outputs.push(`total ${visible.length * 4}`, ...rows);
      } else {
        outputs.push(visible.map(([n, node]) => (node.type === 'dir' ? `${n}/` : n)).join('  '));
      }
    }
    return ok(outputs.join('\n'));
  }

  private tree(path: string): CommandResult {
    const start = this.node(this.resolvePath(path));
    if (start?.type !== 'dir') return fail(`${path} [error opening dir]`);
    const lines = [path];
    const walk = (node: FsNode, prefix: string) => {
      if (node.type !== 'dir') return;
      const items = [...node.children].sort(([a], [b]) => a.localeCompare(b));
      items.forEach(([n, child], i) => {
        const last = i === items.length - 1;
        lines.push(`${prefix}${last ? '└── ' : '├── '}${n}`);
        walk(child, prefix + (last ? '    ' : '│   '));
      });
    };
    walk(start, '');
    return ok(lines.join('\n'));
  }

  private mkdir(args: string[], ctx: ShellContext): CommandResult {
    const parents = args.includes('-p');
    for (const path of args.filter((a) => !a.startsWith('-'))) {
      const full = this.resolvePath(path);
      if (!this.canWrite(full, ctx.sudo))
        return fail(`mkdir: cannot create directory '${path}': Permission denied`);
      if (this.node(full)) {
        if (parents) continue;
        return fail(`mkdir: cannot create directory '${path}': File exists`);
      }
      if (!parents && this.parentOf(full).dir?.type !== 'dir') {
        return fail(
          `mkdir: cannot create directory '${path}': No such file or directory`,
          'The parent folder does not exist. mkdir -p creates the whole path.',
        );
      }
      this.mkdirp(full);
    }
    return ok('');
  }

  private rmdir(args: string[], ctx: ShellContext): CommandResult {
    for (const path of args) {
      const full = this.resolvePath(path);
      const found = this.node(full);
      if (found?.type !== 'dir')
        return fail(`rmdir: failed to remove '${path}': No such directory`);
      if (found.children.size > 0)
        return fail(
          `rmdir: failed to remove '${path}': Directory not empty`,
          'rmdir only removes empty folders. rm -r removes a folder with its contents.',
        );
      if (!this.canWrite(full, ctx.sudo))
        return fail(`rmdir: failed to remove '${path}': Permission denied`);
      const { dir, name } = this.parentOf(full);
      if (dir?.type === 'dir') dir.children.delete(name);
    }
    return ok('');
  }

  private touch(args: string[], ctx: ShellContext): CommandResult {
    for (const path of args) {
      const full = this.resolvePath(path);
      if (this.node(full)) continue;
      if (!this.canWrite(full, ctx.sudo))
        return fail(`touch: cannot touch '${path}': Permission denied`);
      if (this.parentOf(full).dir?.type !== 'dir')
        return fail(`touch: cannot touch '${path}': No such file or directory`);
      this.writeFile(full, '', ctx.sudo ? 'root' : 'guru');
    }
    return ok('');
  }

  /** Text from the named files, or from the pipe when no file is named. */
  private input(files: string[], ctx: ShellContext, command: string): string | CommandResult {
    if (files.length === 0) return ctx.stdin ?? '';
    const parts: string[] = [];
    for (const path of files) {
      const found = this.node(this.resolvePath(path));
      if (!found) return fail(`${command}: ${path}: No such file or directory`);
      if (found.type === 'dir') return fail(`${command}: ${path}: Is a directory`);
      if (!(found.mode & 0o444)) return fail(`${command}: ${path}: Permission denied`);
      parts.push(found.content);
    }
    return parts.join('\n');
  }

  private cat(args: string[], ctx: ShellContext): CommandResult {
    const numbered = args.includes('-n');
    const text = this.input(
      args.filter((a) => a !== '-n'),
      ctx,
      'cat',
    );
    if (typeof text !== 'string') return text;
    return ok(
      numbered
        ? text
            .split('\n')
            .map((l, i) => `${String(i + 1).padStart(6)}\t${l}`)
            .join('\n')
        : text,
    );
  }

  private rm(args: string[], ctx: ShellContext): CommandResult {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const recursive = flags.includes('r') || flags.includes('R');
    const force = flags.includes('f');
    for (const path of args.filter((a) => !a.startsWith('-'))) {
      const full = this.resolvePath(path);
      const found = this.node(full);
      if (!found) {
        if (force) continue;
        return fail(`rm: cannot remove '${path}': No such file or directory`);
      }
      if (found.type === 'dir' && !recursive)
        return fail(
          `rm: cannot remove '${path}': Is a directory`,
          'Use rm -r to delete a folder and everything inside it.',
        );
      if (!this.canWrite(full, ctx.sudo) || full === HOME || full === '/')
        return fail(`rm: cannot remove '${path}': Permission denied`);
      const { dir, name } = this.parentOf(full);
      if (dir?.type === 'dir') dir.children.delete(name);
    }
    return ok('');
  }

  private clone(node: FsNode): FsNode {
    if (node.type === 'file') return { ...node };
    return { ...node, children: new Map([...node.children].map(([n, c]) => [n, this.clone(c)])) };
  }

  private copyMove(command: 'cp' | 'mv', args: string[], ctx: ShellContext): CommandResult {
    const recursive = args.some((a) => /^-\w*r/i.test(a));
    const paths = args.filter((a) => !a.startsWith('-'));
    const destArg = paths.pop();
    if (!destArg || paths.length === 0) return fail(`${command}: missing file operand`);
    let dest = this.resolvePath(destArg);
    for (const path of paths) {
      const full = this.resolvePath(path);
      const found = this.node(full);
      if (!found) return fail(`${command}: cannot stat '${path}': No such file or directory`);
      if (found.type === 'dir' && command === 'cp' && !recursive)
        return fail(`cp: -r not specified; omitting directory '${path}'`);
      let target = dest;
      if (this.node(dest)?.type === 'dir') target = `${dest}/${full.split('/').pop()}`;
      if (!this.canWrite(target, ctx.sudo))
        return fail(`${command}: cannot create '${destArg}': Permission denied`);
      const { dir, name } = this.parentOf(target);
      if (dir?.type !== 'dir')
        return fail(`${command}: cannot create '${destArg}': No such file or directory`);
      dir.children.set(name, this.clone(found));
      if (command === 'mv') {
        const from = this.parentOf(full);
        if (from.dir?.type === 'dir') from.dir.children.delete(from.name);
        if (this.cwd === full) this.cwd = target;
      }
      dest = this.node(dest)?.type === 'dir' ? dest : target;
    }
    return ok('');
  }

  private headTail(command: 'head' | 'tail', args: string[], ctx: ShellContext): CommandResult {
    let count = 10;
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i] ?? '';
      if (arg === '-n') count = Number(args[++i] ?? 10);
      else if (/^-\d+$/.test(arg)) count = Number(arg.slice(1));
      else if (arg === '-f') continue;
      else files.push(arg);
    }
    const text = this.input(files, ctx, command);
    if (typeof text !== 'string') return text;
    const lines = text.split('\n');
    const picked = command === 'head' ? lines.slice(0, count) : lines.slice(-count);
    const followNote = args.includes('-f')
      ? 'tail -f would keep waiting for new lines; the simulator stops here.'
      : undefined;
    return ok(picked.join('\n'), followNote);
  }

  private wc(args: string[], ctx: ShellContext): CommandResult {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const files = args.filter((a) => !a.startsWith('-'));
    const text = this.input(files, ctx, 'wc');
    if (typeof text !== 'string') return text;
    const lines = text === '' ? 0 : text.split('\n').length;
    const words = text.split(/\s+/).filter(Boolean).length;
    const bytes = text.length + (text ? 1 : 0);
    const name = files.length === 1 ? ` ${files[0]}` : '';
    if (flags.includes('l')) return ok(`${lines}${name}`);
    if (flags.includes('w')) return ok(`${words}${name}`);
    if (flags.includes('c')) return ok(`${bytes}${name}`);
    return ok(
      `${String(lines).padStart(3)} ${String(words).padStart(3)} ${String(bytes).padStart(4)}${name}`,
    );
  }

  private grep(args: string[], ctx: ShellContext): CommandResult {
    const flags = args.filter((a) => /^-[a-zA-Z]+$/.test(a)).join('');
    const rest = args.filter((a) => !/^-[a-zA-Z]+$/.test(a));
    const [pattern, ...files] = rest;
    if (pattern === undefined) return fail('usage: grep [-i -n -c -v -r] PATTERN [FILE...]');
    let regex: RegExp;
    try {
      regex = new RegExp(
        flags.includes('w') ? `\\b${pattern}\\b` : pattern,
        flags.includes('i') ? 'i' : '',
      );
    } catch {
      regex = new RegExp(
        pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        flags.includes('i') ? 'i' : '',
      );
    }
    const invert = flags.includes('v');
    const collect = (text: string, label?: string) =>
      text
        .split('\n')
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => regex.test(l) !== invert)
        .map(
          ({ l, i }) => `${label ? `${label}:` : ''}${flags.includes('n') ? `${i + 1}:` : ''}${l}`,
        );

    let matches: string[] = [];
    if (flags.includes('r') || flags.includes('R')) {
      const base = files[0] ?? '.';
      for (const [path, content] of Object.entries(this.filesUnder(base))) {
        matches.push(
          ...collect(content, base === '.' ? path : `${base.replace(/\/$/, '')}/${path}`),
        );
      }
    } else {
      const text = this.input(files, ctx, 'grep');
      if (typeof text !== 'string') return text;
      matches = collect(text);
    }
    if (flags.includes('q')) return { output: '', exitCode: matches.length ? 0 : 1 };
    if (flags.includes('c'))
      return { output: String(matches.length), exitCode: matches.length ? 0 : 1 };
    if (matches.length === 0)
      return {
        output: '',
        exitCode: 1,
        explanation: 'No line matched, so grep printed nothing (exit status 1).',
      };
    return ok(matches.join('\n'));
  }

  private sort(args: string[], ctx: ShellContext): CommandResult {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const text = this.input(
      args.filter((a) => !a.startsWith('-')),
      ctx,
      'sort',
    );
    if (typeof text !== 'string') return text;
    const lines = text.split('\n');
    lines.sort(
      flags.includes('n') ? (a, b) => parseFloat(a) - parseFloat(b) : (a, b) => a.localeCompare(b),
    );
    if (flags.includes('r')) lines.reverse();
    return ok((flags.includes('u') ? [...new Set(lines)] : lines).join('\n'));
  }

  private uniq(args: string[], ctx: ShellContext): CommandResult {
    const count = args.includes('-c');
    const text = this.input(
      args.filter((a) => !a.startsWith('-')),
      ctx,
      'uniq',
    );
    if (typeof text !== 'string') return text;
    const groups: { line: string; n: number }[] = [];
    for (const line of text.split('\n')) {
      const last = groups[groups.length - 1];
      if (last && last.line === line) last.n++;
      else groups.push({ line, n: 1 });
    }
    return ok(
      groups.map((g) => (count ? `${String(g.n).padStart(7)} ${g.line}` : g.line)).join('\n'),
    );
  }

  private find(args: string[], ctx: ShellContext): CommandResult {
    const start = args[0] && !args[0].startsWith('-') ? args[0] : '.';
    const option = (name: string) => {
      const index = args.indexOf(name);
      return index >= 0 ? args[index + 1] : undefined;
    };
    const name = option('-name');
    const iname = option('-iname');
    const pattern = name
      ? globToRegex(name)
      : iname
        ? new RegExp(globToRegex(iname).source, 'i')
        : null;
    const kind = option('-type');
    const maxDepth = option('-maxdepth') !== undefined ? Number(option('-maxdepth')) : Infinity;
    const size = option('-size');
    const mtime = option('-mtime');
    const empty = args.includes('-empty');
    const execIndex = args.indexOf('-exec');
    const exec =
      execIndex >= 0
        ? args.slice(
            execIndex + 1,
            args.findIndex((a, i) => i > execIndex && (a === ';' || a === '\\;' || a === '+')),
          )
        : null;
    const remove = args.includes('-delete');
    const base = this.node(this.resolvePath(start));
    if (!base) return fail(`find: '${start}': No such file or directory`);
    const sizeOk = (node: FsNode) => {
      if (!size) return true;
      const match = /^([+-]?)(\d+)([ckMG]?)$/.exec(size);
      if (!match) return true;
      const unit = { c: 1, k: 1024, M: 1048576, G: 1073741824, '': 512 }[match[3] ?? ''] ?? 1;
      const bytes = node.type === 'file' ? node.content.length : 4096;
      const limit = Number(match[2]) * unit;
      return match[1] === '+'
        ? bytes > limit
        : match[1] === '-'
          ? bytes < limit
          : Math.ceil(bytes / unit) === Number(match[2]);
    };
    // every simulator file was "modified today": -mtime -N matches, +N does not
    const mtimeOk = !mtime || !mtime.startsWith('+');
    const out: string[] = [];
    const walk = (node: FsNode, path: string, fileName: string, depth: number) => {
      const typeOk = !kind || (kind === 'f' ? node.type === 'file' : node.type === 'dir');
      const isEmpty = node.type === 'file' ? node.content === '' : node.children.size === 0;
      if (
        typeOk &&
        (!pattern || pattern.test(fileName)) &&
        sizeOk(node) &&
        mtimeOk &&
        (!empty || isEmpty)
      )
        out.push(path);
      if (node.type === 'dir' && depth < maxDepth) {
        for (const [child, childNode] of [...node.children].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          walk(childNode, `${path}/${child}`, child, depth + 1);
        }
      }
    };
    walk(
      base,
      start.startsWith('~') ? this.resolvePath(start) : start.replace(/\/$/, ''),
      start,
      0,
    );
    if (exec && exec.length > 0) {
      const outputs: string[] = [];
      for (const path of out) {
        const result = this.command(
          exec.map((w) => w.replace('{}', path)),
          ctx,
        );
        if (result.output) outputs.push(result.output);
      }
      return ok(
        outputs.join('\n'),
        '-exec ran the command once for each file found ({} is replaced by the path).',
      );
    }
    if (remove) {
      for (const path of [...out].reverse()) {
        const full = this.resolvePath(path);
        if (!this.canWrite(full, ctx.sudo))
          return fail(`find: cannot delete '${path}': Permission denied`);
        const { dir, name: base2 } = this.parentOf(full);
        if (dir?.type === 'dir') dir.children.delete(base2);
      }
      return ok(
        '',
        `-delete removed ${out.length} item(s). Run the same find without -delete first to check the list!`,
      );
    }
    return ok(
      out.join('\n'),
      mtime
        ? 'In the simulator every file was modified today, so -mtime -N matches and -mtime +N does not.'
        : undefined,
    );
  }

  private chmod(args: string[], ctx: ShellContext): CommandResult {
    const [mode, ...paths] = args.filter((a) => a !== '-R');
    if (!mode || paths.length === 0) return fail('usage: chmod MODE FILE');
    for (const path of paths) {
      const full = this.resolvePath(path);
      const found = this.node(full);
      if (!found) return fail(`chmod: cannot access '${path}': No such file or directory`);
      if (!this.canWrite(full, ctx.sudo))
        return fail(`chmod: changing permissions of '${path}': Operation not permitted`);
      if (/^[0-7]{3}$/.test(mode)) {
        found.mode = parseInt(mode, 8);
        continue;
      }
      const match = /^([ugoa]*)([+-=])([rwx]+)$/.exec(mode);
      if (!match) return fail(`chmod: invalid mode: '${mode}'`);
      const [, who = '', op, perms = ''] = match;
      const targets = who === '' || who.includes('a') ? 'ugo' : who;
      let bits = 0;
      for (const t of targets) {
        const shift = t === 'u' ? 6 : t === 'g' ? 3 : 0;
        for (const p of perms) bits |= (p === 'r' ? 4 : p === 'w' ? 2 : 1) << shift;
      }
      if (op === '+') found.mode |= bits;
      else if (op === '-') found.mode &= ~bits;
      else found.mode = bits;
    }
    const sample = this.node(this.resolvePath(paths[0] ?? ''));
    return ok('', `${EXPLAIN.chmod} Now: ${sample ? modeString(sample) : ''}`);
  }

  private runScript(
    path: string,
    args: string[],
    ctx: ShellContext,
    viaBash = false,
  ): CommandResult {
    const full = this.resolvePath(path);
    const found = this.node(full);
    if (!found) return fail(`bash: ${path}: No such file or directory`);
    if (found.type !== 'file') return fail(`bash: ${path}: Is a directory`);
    if (!viaBash && !(found.mode & 0o100) && !ctx.sudo) {
      return {
        ...fail(
          `bash: ${path}: Permission denied`,
          'The file has no x (execute) permission. Run chmod +x on it first (or run it with bash script.sh).',
        ),
        exitCode: 126,
      };
    }
    const saved = { positional: this.positional, name: this.scriptName };
    this.positional = args;
    this.scriptName = path;
    try {
      const result = runBash(this, found.content.split('\n'));
      return {
        ...result,
        explanation:
          result.explanation ?? 'Ran the script line by line, as if you typed each line.',
      };
    } finally {
      this.positional = saved.positional;
      this.scriptName = saved.name;
    }
  }

  /** Test expressions for [ ], [[ ]] and test. */
  private test(args: string[]): CommandResult {
    const yes = (value: boolean): CommandResult => ({ output: '', exitCode: value ? 0 : 1 });
    if (args[0] === '!') {
      const inner = this.test(args.slice(1));
      return yes(inner.exitCode !== 0);
    }
    const andIndex = args.findIndex((a) => a === '&&' || a === '-a');
    if (andIndex > 0)
      return yes(
        this.test(args.slice(0, andIndex)).exitCode === 0 &&
          this.test(args.slice(andIndex + 1)).exitCode === 0,
      );
    const orIndex = args.findIndex((a) => a === '||' || a === '-o');
    if (orIndex > 0)
      return yes(
        this.test(args.slice(0, orIndex)).exitCode === 0 ||
          this.test(args.slice(orIndex + 1)).exitCode === 0,
      );
    if (args.length === 0) return yes(false);
    if (args.length === 1) return yes((args[0] ?? '') !== '');
    if (args.length === 2) {
      const [op, value = ''] = args;
      const node = this.node(this.resolvePath(value));
      switch (op) {
        case '-z':
          return yes(value === '');
        case '-n':
          return yes(value !== '');
        case '-f':
          return yes(node?.type === 'file');
        case '-d':
          return yes(node?.type === 'dir');
        case '-e':
          return yes(node !== undefined);
        case '-s':
          return yes(node?.type === 'file' && node.content.length > 0);
        case '-x':
          return yes(node !== undefined && (node.mode & 0o100) !== 0);
        case '-r':
          return yes(node !== undefined && (node.mode & 0o400) !== 0);
        case '-w':
          return yes(node !== undefined && (node.mode & 0o200) !== 0);
      }
      return fail(`bash: [: ${op}: unary operator expected`);
    }
    const [a = '', op, b = ''] = args;
    const numbers = (): [number, number] | null =>
      /^-?\d+$/.test(a) && /^-?\d+$/.test(b) ? [Number(a), Number(b)] : null;
    switch (op) {
      case '=':
      case '==':
        return yes(op === '==' && /[*?]/.test(b) ? globToRegex(b).test(a) : a === b);
      case '!=':
        return yes(a !== b);
      case '=~':
        return yes(new RegExp(b).test(a));
      case '<':
        return yes(a < b);
      case '>':
        return yes(a > b);
      case '-eq':
      case '-ne':
      case '-lt':
      case '-le':
      case '-gt':
      case '-ge': {
        const pair = numbers();
        if (!pair)
          return fail(`bash: [: ${/^-?\d+$/.test(a) ? b : a}: integer expression expected`);
        const [x, y] = pair;
        const map: Record<string, boolean> = {
          '-eq': x === y,
          '-ne': x !== y,
          '-lt': x < y,
          '-le': x <= y,
          '-gt': x > y,
          '-ge': x >= y,
        };
        return yes(map[op] ?? false);
      }
    }
    return fail(`bash: [: ${op ?? ''}: binary operator expected`);
  }

  /** Word list for "for x in ...": brace ranges {1..5} and globs *.log are expanded. */
  private words(args: string[]): string[] {
    const out: string[] = [];
    for (const word of args) {
      const range = /^\{(-?\d+)\.\.(-?\d+)\}$/.exec(word);
      if (range) {
        const from = Number(range[1]);
        const to = Number(range[2]);
        const step = from <= to ? 1 : -1;
        for (let n = from; step > 0 ? n <= to : n >= to; n += step) out.push(String(n));
        continue;
      }
      const list = /^\{([^{}]*,[^{}]*)\}$/.exec(word);
      if (list) {
        out.push(...(list[1] ?? '').split(','));
        continue;
      }
      if (/[*?]/.test(word)) {
        const slash = word.lastIndexOf('/');
        const dir = slash >= 0 ? word.slice(0, slash) || '/' : '.';
        const node = this.node(this.resolvePath(dir));
        const regex = globToRegex(word.slice(slash + 1));
        const hits =
          node?.type === 'dir'
            ? [...node.children.keys()]
                .filter((n) => regex.test(n))
                .sort()
                .map((n) => (slash >= 0 ? `${word.slice(0, slash)}/${n}` : n))
            : [];
        out.push(...(hits.length ? hits : [word]));
        continue;
      }
      out.push(word);
    }
    return out;
  }

  /** The non-option arguments of a command whose options take a value (cut -d , -f 2 file). */
  private fileArgs(args: string[], optionsWithValue: string[]): string[] {
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i] ?? '';
      if (optionsWithValue.includes(arg)) i++;
      else if (!arg.startsWith('-')) files.push(arg);
    }
    return files;
  }

  private syncUsers(newHome?: string): void {
    this.writeFile('/etc/passwd', this.system.passwdFile(), 'root');
    this.writeFile('/etc/group', this.system.groupFile(), 'root');
    if (newHome) this.mkdirp(`/home/${newHome}`, newHome);
  }

  private ps(): CommandResult {
    const rows = [
      ...this.processes,
      ...this.docker.runningProcesses().map((p, i) => ({ pid: 2000 + i, user: 'root', cmd: p })),
    ];
    return ok(
      [
        '  PID USER     COMMAND',
        ...rows.map((p) => `${String(p.pid).padStart(5)} ${p.user.padEnd(8)} ${p.cmd}`),
      ].join('\n'),
    );
  }

  private top(): CommandResult {
    return ok(
      [
        'top - 09:30:00 up 3 days,  1 user,  load average: 0.15, 0.10, 0.05',
        'Tasks: 104 total,   1 running, 103 sleeping',
        '%Cpu(s):  3.1 us,  1.0 sy, 95.9 id',
        'MiB Mem :   3900.0 total,   1120.4 free,   1240.2 used',
        '',
        '  PID USER      %CPU %MEM COMMAND',
        ' 1204 guru       2.0  1.1 python3',
        '  412 root       0.3  0.2 sshd',
        '    1 root       0.0  0.3 init',
      ].join('\n'),
      'top is a live screen in a real terminal (press q to quit). This is a snapshot.',
    );
  }

  private kill(args: string[], ctx: ShellContext): CommandResult {
    const pid = Number(args.find((a) => /^\d+$/.test(a)));
    const index = this.processes.findIndex((p) => p.pid === pid);
    if (index < 0) return fail(`bash: kill: (${args[args.length - 1] ?? ''}) - No such process`);
    const proc = this.processes[index]!;
    if (proc.user === 'root' && !ctx.sudo)
      return fail(
        `bash: kill: (${pid}) - Operation not permitted`,
        'That process belongs to root. Only root (sudo) can stop it.',
      );
    this.processes.splice(index, 1);
    return ok('', `Stopped process ${pid} (${proc.cmd}).`);
  }

  private curl(args: string[]): CommandResult {
    const showHeaders = args.includes('-i') || args.includes('-I');
    const url = args.find((a) => !a.startsWith('-'));
    if (!url) return fail('curl: try curl localhost:8000');
    const match = /^(?:https?:\/\/)?(localhost|127\.0\.0\.1)(?::(\d+))?(\/.*)?$/.exec(url);
    if (!match) {
      return fail(
        `curl: (6) Could not resolve host: ${url.replace(/^https?:\/\//, '').split('/')[0]}`,
        'The simulator has no internet. Start a container with a published port, then curl localhost:<port>.',
      );
    }
    const port = Number(match[2] ?? 80);
    if (port === 9000)
      return ok(
        showHeaders
          ? 'HTTP/1.0 200 OK\nServer: SimpleHTTP/0.6 Python/3.12.3\n\nDirectory listing for /'
          : 'Directory listing for /',
      );
    const served = this.docker.serve(port);
    if (served === null) {
      return fail(
        `curl: (7) Failed to connect to localhost port ${port}: Connection refused`,
        `Nothing is listening on port ${port}. Is the container running and published with -p ${port}:<container port>?`,
      );
    }
    return ok(
      showHeaders ? `HTTP/1.1 200 OK\nContent-Type: text/html\n\n${served}` : served,
      `The request reached the container through the published port ${port}.`,
    );
  }

  private apt(args: string[], ctx: ShellContext): CommandResult {
    const [action, ...pkgs] = args.filter((a) => a !== '-y');
    if (action === 'update') {
      if (!ctx.sudo)
        return fail(
          'E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)',
          'Installing and updating software needs sudo.',
        );
      return ok(
        'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nReading package lists... Done',
      );
    }
    if (action === 'install') {
      if (!ctx.sudo)
        return fail(
          'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: are you root?',
          'Installing software needs sudo: sudo apt install <name>',
        );
      for (const pkg of pkgs) this.installed.add(pkg);
      return ok(
        `Reading package lists... Done\n${pkgs.map((p) => `Setting up ${p} ...`).join('\n')}`,
      );
    }
    return fail('usage: sudo apt update | sudo apt install <package>');
  }
}
