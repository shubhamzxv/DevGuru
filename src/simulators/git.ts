import {
  fail,
  ok,
  splitWords,
  takeFlag,
  takeOption,
  type CommandResult,
  type Simulator,
} from './types';

/**
 * A small but honest model of Git that runs in the browser.
 * Files are just name -> text. Three areas, like real Git:
 *   working (your folder)  ->  index (staging area, `git add`)  ->  commits (`git commit`)
 * Supported: init, config, status, add, restore, commit, log, show, diff, branch,
 * switch, checkout, merge (fast-forward, merge commit, conflicts), rebase, reset,
 * revert, cherry-pick, stash, tag, remote, push, fetch, pull, plus the file
 * commands echo, cat, ls, touch, rm.
 */

export type Tree = Record<string, string>;

export interface Commit {
  id: string;
  message: string;
  parents: string[];
  tree: Tree;
  /** Row in the graph (one row per branch). */
  lane: number;
  seq: number;
}

export interface GraphCommit {
  id: string;
  message: string;
  parents: string[];
  lane: number;
  labels: string[];
  isHead: boolean;
}

type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string };

interface Diff {
  added: string[];
  removed: string[];
  modified: string[];
}

const NOT_A_REPO = 'fatal: not a git repository (or any of the parent directories): .git';

function copy(tree: Tree): Tree {
  return { ...tree };
}

function sameTree(a: Tree, b: Tree): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
}

export function diffTrees(from: Tree, to: Tree): Diff {
  const diff: Diff = { added: [], removed: [], modified: [] };
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
  for (const key of keys) {
    if (!(key in from)) diff.added.push(key);
    else if (!(key in to)) diff.removed.push(key);
    else if (from[key] !== to[key]) diff.modified.push(key);
  }
  return diff;
}

function isEmpty(diff: Diff): boolean {
  return diff.added.length + diff.removed.length + diff.modified.length === 0;
}

/** Short, stable, hex id (real Git uses SHA-1 of the content). */
function makeId(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 7);
}

const EXPLAIN: Record<string, string> = {
  init: 'Created a hidden .git folder. From now on Git can record the history of this folder.',
  add: 'Copied the change into the staging area (index). Only staged changes go into the next commit.',
  commit:
    'Saved a snapshot of the staging area as a new commit, and moved the current branch to it.',
  status: 'Shows what is staged, what is changed but not staged, and files Git does not track yet.',
  log: 'Lists commits, newest first. Each commit has an id, and arrows show which commit came before.',
  branch: 'A branch is just a movable label that points at one commit. Creating one is instant.',
  switch: 'Moved HEAD to another branch and changed the files to match that branch.',
  merge: 'Joined the history of another branch into the current branch.',
  rebase:
    'Replayed your commits on top of another branch. They get NEW ids, so history looks straight.',
  reset: 'Moved the current branch back to another commit.',
  revert:
    'Made a NEW commit that undoes an old one. History is kept, so it is safe on shared branches.',
  'cherry-pick': 'Copied the change of one commit onto the current branch as a new commit.',
  stash:
    'Put your unfinished changes on a shelf, so the folder is clean. Bring them back with stash pop.',
  tag: 'A tag is a fixed label for one commit, usually a release such as v1.0.',
  diff: 'Shows the exact lines that changed. - is the old line, + is the new line.',
  restore:
    'Threw away a change and put back the version from the staging area (or from the last commit).',
  push: 'Sent your commits to the remote (for example GitHub) and moved the remote branch label.',
  pull: 'pull = fetch (download new commits) + merge them into your branch.',
  fetch: 'Downloaded new commits from the remote without changing your branch.',
  remote: 'A remote is a saved address of another copy of the repository, usually named origin.',
  config: 'Saved a Git setting. user.name and user.email appear in every commit you make.',
  show: 'Shows one commit: who, when, the message and what changed.',
};

export class GitSimulator implements Simulator {
  initialized = false;
  readonly commits = new Map<string, Commit>();
  readonly branches = new Map<string, string | null>();
  readonly tags = new Map<string, string>();
  readonly remoteRefs = new Map<string, string>();
  remoteUrl: string | null = null;
  head: Head = { kind: 'branch', name: 'main' };
  working: Tree = {};
  index: Tree = {};
  private stashList: { working: Tree; index: Tree; message: string }[] = [];
  private merging: { theirs: string; name: string; conflicts: Set<string> } | null = null;
  private upstream = new Map<string, string>();
  private config = new Map<string, string>([
    ['user.name', 'Guru'],
    ['user.email', 'guru@devguru.dev'],
  ]);
  private lanes = new Map<string, number>();
  private seq = 0;

  prompt(): string {
    if (!this.initialized) return 'guru@devguru:~/project$';
    const where = this.head.kind === 'branch' ? this.head.name : this.head.id;
    return `guru@devguru:~/project (${where}${this.merging ? '|MERGING' : ''})$`;
  }

  run(line: string): CommandResult {
    const parts = line
      .split('&&')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const outputs: string[] = [];
      let last: CommandResult = ok('');
      for (const part of parts) {
        last = this.runOne(part);
        if (last.output) outputs.push(last.output);
        if (last.error) break;
      }
      return { ...last, output: outputs.join('\n') };
    }
    return this.runOne(line.trim());
  }

  // ---------- graph data for the picture ----------

  graph(): GraphCommit[] {
    const visible = new Set<string>();
    const tips = [
      ...this.branches.values(),
      ...this.tags.values(),
      ...this.remoteRefs.values(),
      this.headId(),
      this.merging?.theirs ?? null,
    ];
    for (const tip of tips) if (tip) for (const id of this.ancestors(tip)) visible.add(id);
    const headId = this.headId();
    return [...visible]
      .map((id) => this.commits.get(id))
      .filter((c): c is Commit => c !== undefined)
      .sort((a, b) => a.seq - b.seq)
      .map((c) => ({
        id: c.id,
        message: c.message,
        parents: c.parents,
        lane: c.lane,
        labels: this.labelsFor(c.id),
        isHead: c.id === headId,
      }));
  }

  // ---------- helpers ----------

  headId(): string | null {
    return this.head.kind === 'branch' ? (this.branches.get(this.head.name) ?? null) : this.head.id;
  }

  private headTree(): Tree {
    const id = this.headId();
    return id ? copy(this.commits.get(id)?.tree ?? {}) : {};
  }

  private labelsFor(id: string): string[] {
    const labels: string[] = [];
    if (this.head.kind === 'detached' && this.head.id === id) labels.push('HEAD');
    for (const [name, target] of this.branches) {
      if (target !== id) continue;
      labels.push(
        this.head.kind === 'branch' && this.head.name === name ? `HEAD -> ${name}` : name,
      );
    }
    for (const [name, target] of this.remoteRefs) if (target === id) labels.push(name);
    for (const [name, target] of this.tags) if (target === id) labels.push(`tag: ${name}`);
    return labels;
  }

  ancestors(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(this.commits.get(next)?.parents ?? []));
    }
    return seen;
  }

  private mergeBase(a: string, b: string): string | null {
    const fromA = this.ancestors(a);
    let best: Commit | null = null;
    for (const id of this.ancestors(b)) {
      const commit = this.commits.get(id);
      if (commit && fromA.has(id) && (!best || commit.seq > best.seq)) best = commit;
    }
    return best?.id ?? null;
  }

  resolve(ref: string): string | undefined {
    const match = /^(.+?)(~(\d*)|\^+)?$/.exec(ref);
    if (!match) return undefined;
    const [, base = '', suffix, count] = match;
    let id: string | null | undefined;
    if (base === 'HEAD') id = this.headId();
    else if (this.branches.has(base)) id = this.branches.get(base);
    else if (this.tags.has(base)) id = this.tags.get(base);
    else if (this.remoteRefs.has(base)) id = this.remoteRefs.get(base);
    else if (base.length >= 4) id = [...this.commits.keys()].find((key) => key.startsWith(base));
    if (!id) return undefined;
    let steps = 0;
    if (suffix?.startsWith('~')) steps = count === '' || count === undefined ? 1 : Number(count);
    else if (suffix) steps = suffix.length;
    for (let i = 0; i < steps; i++) {
      id = this.commits.get(id)?.parents[0];
      if (!id) return undefined;
    }
    return id;
  }

  private lane(): number {
    const key = this.head.kind === 'branch' ? this.head.name : `detached:${this.head.id}`;
    let lane = this.lanes.get(key);
    if (lane === undefined) {
      lane = this.lanes.size === 0 ? 0 : Math.max(...this.lanes.values()) + 1;
      this.lanes.set(key, lane);
    }
    return lane;
  }

  private newCommit(message: string, parents: string[], tree: Tree): Commit {
    this.seq++;
    const id = makeId(`${this.seq}:${message}:${parents.join(',')}:${JSON.stringify(tree)}`);
    const commit: Commit = {
      id,
      message,
      parents,
      tree: copy(tree),
      lane: this.lane(),
      seq: this.seq,
    };
    this.commits.set(id, commit);
    if (this.head.kind === 'branch') this.branches.set(this.head.name, id);
    else this.head = { kind: 'detached', id };
    return commit;
  }

  private isDirty(): boolean {
    const head = this.headTree();
    const tracked = Object.keys(this.index);
    return (
      !sameTree(head, this.index) || tracked.some((file) => this.working[file] !== this.index[file])
    );
  }

  private setFiles(tree: Tree) {
    this.working = copy(tree);
    this.index = copy(tree);
  }

  private shortMessage(id: string): string {
    return `${id} ${this.commits.get(id)?.message ?? ''}`;
  }

  // ---------- command dispatch ----------

  private runOne(line: string): CommandResult {
    if (line === '') return ok('');
    const redirect = /^echo\s+(.*?)\s*(>>?)\s*(\S+)$/.exec(line);
    if (redirect)
      return this.echoToFile(redirect[1] ?? '', redirect[2] === '>>', redirect[3] ?? '');

    const words = splitWords(line);
    const [command, ...args] = words;
    switch (command) {
      case 'git':
        return this.git(args);
      case 'echo':
        return ok(args.join(' '));
      case 'cat':
        return this.cat(args);
      case 'ls':
        return ok(Object.keys(this.working).sort().join('  '));
      case 'touch':
        for (const file of args) this.working[file] ??= '';
        return ok('', 'Created an empty file (Git sees it as untracked until you git add it).');
      case 'rm':
        return this.rm(args);
      case 'pwd':
        return ok('/home/guru/project');
      case 'clear':
        return { output: '', clear: true };
      case 'help':
        return ok(this.help());
      default:
        return fail(
          `${command}: command not found`,
          'This simulator understands git commands plus echo, cat, ls, touch and rm. Type help.',
        );
    }
  }

  private help(): string {
    return [
      'Files:   echo "text" > file   echo "more" >> file   cat file   ls   touch file   rm file',
      'Start:   git init   git config user.name "Your Name"',
      'Save:    git status   git add <file>|.   git commit -m "message"   git diff [--staged]',
      'History: git log --oneline   git show <id>',
      'Branch:  git branch <name>   git switch <name>   git switch -c <name>   git branch -d <name>',
      'Join:    git merge <branch>   git merge --abort   git rebase <branch>',
      'Undo:    git restore <file>   git restore --staged <file>   git reset [--soft|--hard] HEAD~1',
      '         git revert <id>   git cherry-pick <id>   git stash   git stash pop',
      'Share:   git remote add origin <url>   git push -u origin main   git pull   git tag v1.0',
    ].join('\n');
  }

  private echoToFile(text: string, append: boolean, file: string): CommandResult {
    const value = splitWords(text).join(' ');
    const before = this.working[file];
    this.working[file] = append && before !== undefined ? `${before}\n${value}` : value;
    return ok(
      '',
      before === undefined
        ? `Created ${file}. Git does not track it until you run git add.`
        : `Changed ${file}. Run git status to see that Git noticed.`,
    );
  }

  private cat(files: string[]): CommandResult {
    const missing = files.find((file) => !(file in this.working));
    if (missing) return fail(`cat: ${missing}: No such file or directory`);
    return ok(files.map((file) => this.working[file]).join('\n'));
  }

  private rm(files: string[]): CommandResult {
    const missing = files.find((file) => !(file in this.working));
    if (missing) return fail(`rm: cannot remove '${missing}': No such file or directory`);
    for (const file of files) delete this.working[file];
    return ok(
      '',
      'Deleted the file from your folder. Stage the deletion with git add, then commit.',
    );
  }

  private git(args: string[]): CommandResult {
    const [sub, ...rest] = args;
    if (!sub) return ok(this.help());
    if (
      !this.initialized &&
      !['init', 'config', 'help', 'clone', 'version', '--version'].includes(sub)
    ) {
      return fail(NOT_A_REPO, 'Run git init first, to turn this folder into a Git repository.');
    }
    const result = this.gitCommand(sub, rest);
    const key = sub === 'checkout' ? 'switch' : sub;
    return result.explanation || result.error ? result : { ...result, explanation: EXPLAIN[key] };
  }

  private gitCommand(sub: string, args: string[]): CommandResult {
    switch (sub) {
      case 'init':
        return this.init();
      case 'version':
      case '--version':
        return ok('git version 2.47.0 (DevGuru simulator)');
      case 'help':
        return ok(this.help());
      case 'clone':
        return ok(
          `Cloning into '${(args[0] ?? 'repo')
            .split('/')
            .pop()
            ?.replace(/\.git$/, '')}'...\ndone.`,
          'clone = download a whole repository with its history. In this simulator you work in ~/project.',
        );
      case 'config':
        return this.configCmd(args);
      case 'status':
        return this.status(args.includes('-s') || args.includes('--short'));
      case 'add':
        return this.add(args);
      case 'restore':
        return this.restore(args);
      case 'rm':
        return this.gitRm(args);
      case 'commit':
        return this.commit(args);
      case 'log':
        return this.log(args);
      case 'show':
        return this.show(args[0] ?? 'HEAD');
      case 'diff':
        return this.diff(args);
      case 'branch':
        return this.branch(args);
      case 'switch':
        return this.switchCmd(args);
      case 'checkout':
        return this.checkout(args);
      case 'merge':
        return this.merge(args);
      case 'rebase':
        return this.rebase(args);
      case 'reset':
        return this.reset(args);
      case 'revert':
        return this.revert(args[0]);
      case 'cherry-pick':
        return this.cherryPick(args[0]);
      case 'stash':
        return this.stash(args);
      case 'tag':
        return this.tag(args);
      case 'remote':
        return this.remote(args);
      case 'push':
        return this.push(args);
      case 'fetch':
        return ok('', 'Nobody else pushed in the simulator, so there is nothing new to download.');
      case 'pull':
        return ok('Already up to date.', EXPLAIN.pull);
      default:
        return fail(
          `git: '${sub}' is not a git command in this simulator. See 'git help'.`,
          'Type git help to see the commands this simulator understands.',
        );
    }
  }

  private init(): CommandResult {
    if (this.initialized) {
      return ok('Reinitialized existing Git repository in /home/guru/project/.git/');
    }
    this.initialized = true;
    this.branches.set('main', null);
    this.head = { kind: 'branch', name: 'main' };
    return ok('Initialized empty Git repository in /home/guru/project/.git/');
  }

  private configCmd(args: string[]): CommandResult {
    const list = takeFlag(args, ['--list', '-l']);
    takeFlag(args, ['--global', '--local']);
    if (list) {
      return ok([...this.config].map(([key, value]) => `${key}=${value}`).join('\n'));
    }
    const [key, value] = args;
    if (!key) return fail('usage: git config [--global] <name> [<value>]');
    if (value === undefined) {
      const current = this.config.get(key);
      return current === undefined ? fail('') : ok(current);
    }
    this.config.set(key, value);
    return ok('');
  }

  private status(short: boolean): CommandResult {
    const head = this.headTree();
    const staged = diffTrees(head, this.index);
    const tracked = Object.keys(this.index).sort();
    const unstagedModified = tracked.filter(
      (f) => f in this.working && this.working[f] !== this.index[f],
    );
    const unstagedDeleted = tracked.filter((f) => !(f in this.working));
    const untracked = Object.keys(this.working)
      .filter((f) => !(f in this.index))
      .sort();
    const conflicts = [...(this.merging?.conflicts ?? [])].sort();

    if (short) {
      const lines = new Map<string, string>();
      for (const f of staged.added) lines.set(f, 'A ');
      for (const f of staged.modified) lines.set(f, 'M ');
      for (const f of staged.removed) lines.set(f, 'D ');
      for (const f of unstagedModified) lines.set(f, `${(lines.get(f) ?? ' ')[0]}M`);
      for (const f of unstagedDeleted) lines.set(f, `${(lines.get(f) ?? ' ')[0]}D`);
      for (const f of conflicts) lines.set(f, 'UU');
      for (const f of untracked) lines.set(f, '??');
      return ok(
        [...lines]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([f, code]) => `${code} ${f}`)
          .join('\n'),
        'Short status: first column = staged, second = not staged. ?? = untracked, UU = conflict.',
      );
    }

    const out: string[] = [
      this.head.kind === 'branch'
        ? `On branch ${this.head.name}`
        : `HEAD detached at ${this.head.id}`,
    ];
    if (this.headId() === null) out.push('', 'No commits yet');
    if (this.merging) {
      out.push('You have unmerged paths.', '  (fix conflicts and run "git commit")');
      if (conflicts.length > 0) {
        out.push('', 'Unmerged paths:', ...conflicts.map((f) => `\tboth modified:   ${f}`));
      }
    }
    const stagedLines = [
      ...staged.added.map((f) => `\tnew file:   ${f}`),
      ...staged.modified.filter((f) => !conflicts.includes(f)).map((f) => `\tmodified:   ${f}`),
      ...staged.removed.map((f) => `\tdeleted:    ${f}`),
    ];
    if (stagedLines.length > 0) {
      out.push(
        '',
        'Changes to be committed:',
        '  (use "git restore --staged <file>..." to unstage)',
        ...stagedLines,
      );
    }
    const unstagedLines = [
      ...unstagedModified.filter((f) => !conflicts.includes(f)).map((f) => `\tmodified:   ${f}`),
      ...unstagedDeleted.map((f) => `\tdeleted:    ${f}`),
    ];
    if (unstagedLines.length > 0) {
      out.push(
        '',
        'Changes not staged for commit:',
        '  (use "git add <file>..." to update what will be committed)',
        ...unstagedLines,
      );
    }
    if (untracked.length > 0) {
      out.push(
        '',
        'Untracked files:',
        '  (use "git add <file>..." to include in what will be committed)',
        ...untracked.map((f) => `\t${f}`),
      );
    }
    if (stagedLines.length + unstagedLines.length + untracked.length + conflicts.length === 0) {
      out.push(
        this.headId() === null
          ? 'nothing to commit (create/copy files and use "git add" to track)'
          : 'nothing to commit, working tree clean',
      );
    }
    return ok(out.join('\n'));
  }

  private add(paths: string[]): CommandResult {
    if (paths.length === 0)
      return fail(
        'Nothing specified, nothing added.',
        'Try git add <file> or git add . for everything.',
      );
    const all = paths.some((p) => p === '.' || p === '-A' || p === '--all');
    const targets = all
      ? [...new Set([...Object.keys(this.working), ...Object.keys(this.index)])]
      : paths;
    for (const file of targets) {
      if (file in this.working) this.index[file] = this.working[file] ?? '';
      else if (file in this.index) delete this.index[file];
      else return fail(`fatal: pathspec '${file}' did not match any files`);
      this.merging?.conflicts.delete(file);
    }
    return ok('');
  }

  private restore(args: string[]): CommandResult {
    const staged = takeFlag(args, ['--staged', '-S']);
    if (args.length === 0) return fail('fatal: you must specify path(s) to restore');
    const head = this.headTree();
    for (const file of args) {
      if (staged) {
        if (file in head) this.index[file] = head[file] ?? '';
        else delete this.index[file];
      } else if (file in this.index) {
        this.working[file] = this.index[file] ?? '';
      } else {
        return fail(`error: pathspec '${file}' did not match any file(s) known to git`);
      }
    }
    return ok(
      '',
      staged
        ? 'Took the file out of the staging area. Your edit is still in the folder.'
        : 'Threw away the unstaged edit: the file is back to the staged (or committed) version.',
    );
  }

  private gitRm(args: string[]): CommandResult {
    const cached = takeFlag(args, ['--cached']);
    for (const file of args) {
      if (!(file in this.index)) return fail(`fatal: pathspec '${file}' did not match any files`);
      delete this.index[file];
      if (!cached) delete this.working[file];
    }
    return ok(
      args.map((f) => `rm '${f}'`).join('\n'),
      cached
        ? 'Git stops tracking the file, but it stays in your folder.'
        : 'Deleted the file and staged the deletion.',
    );
  }

  private commit(args: string[]): CommandResult {
    const all = takeFlag(args, ['-a', '--all']) || args.includes('-am');
    if (args.includes('-am')) args.splice(args.indexOf('-am'), 1, '-m');
    const allowEmpty = takeFlag(args, ['--allow-empty']);
    const amend = takeFlag(args, ['--amend']);
    let message = takeOption(args, ['-m', '--message']);

    if (all) {
      for (const file of Object.keys(this.index)) {
        if (file in this.working) this.index[file] = this.working[file] ?? '';
        else delete this.index[file];
      }
    }

    if (this.merging) {
      if (this.merging.conflicts.size > 0) {
        return fail(
          'error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use git add <file>',
          'Edit each conflicted file (remove the <<<<<<< ======= >>>>>>> lines), git add it, then commit.',
        );
      }
      const parents = [this.headId(), this.merging.theirs].filter((p): p is string => p !== null);
      const commit = this.newCommit(
        message ?? `Merge branch '${this.merging.name}'`,
        parents,
        this.index,
      );
      this.merging = null;
      return ok(
        `[${this.branchName()} ${commit.id}] ${commit.message}`,
        'Finished the merge with a merge commit (it has two parents).',
      );
    }

    if (message === undefined) {
      return fail(
        'error: please give a message with -m "what you changed"',
        'In a real terminal Git would open an editor for the message.',
      );
    }

    const headId = this.headId();
    if (amend) {
      if (!headId) return fail('fatal: You have nothing to amend.');
      const old = this.commits.get(headId)!;
      if (message === '') message = old.message;
      const commit = this.newCommit(message, old.parents, this.index);
      return ok(
        `[${this.branchName()} ${commit.id}] ${commit.message}`,
        `Replaced the last commit (${old.id}) with a new one (${commit.id}). Never amend commits you already pushed.`,
      );
    }

    const changes = diffTrees(this.headTree(), this.index);
    if (isEmpty(changes) && !allowEmpty) {
      return fail(
        this.status(false).output.replace(/\n?nothing to commit.*$/, '') +
          '\nno changes added to commit (use "git add")',
        'Nothing is staged. Change a file, run git add, then commit.',
      );
    }
    const commit = this.newCommit(message, headId ? [headId] : [], this.index);
    const root = headId ? '' : ' (root-commit)';
    const count = changes.added.length + changes.modified.length + changes.removed.length;
    return ok(
      `[${this.branchName()}${root} ${commit.id}] ${message}\n ${count} file${count === 1 ? '' : 's'} changed`,
    );
  }

  private branchName(): string {
    return this.head.kind === 'branch' ? this.head.name : 'detached HEAD';
  }

  private reachable(from: string[]): Commit[] {
    const ids = new Set<string>();
    for (const tip of from) for (const id of this.ancestors(tip)) ids.add(id);
    return [...ids]
      .map((id) => this.commits.get(id))
      .filter((c): c is Commit => c !== undefined)
      .sort((a, b) => b.seq - a.seq);
  }

  private log(args: string[]): CommandResult {
    const oneline = takeFlag(args, ['--oneline']);
    const all = takeFlag(args, ['--all']);
    takeFlag(args, ['--graph', '--decorate']);
    const limitText =
      takeOption(args, ['-n', '--max-count']) ?? args.find((a) => /^-\d+$/.test(a))?.slice(1);
    const start = args.find((a) => !a.startsWith('-'));
    const headId = start ? this.resolve(start) : this.headId();
    if (!headId) {
      return fail(
        `fatal: your current branch '${this.branchName()}' does not have any commits yet`,
      );
    }
    const tips = all
      ? [...this.branches.values(), ...this.tags.values()].filter((t): t is string => !!t)
      : [headId];
    let commits = this.reachable(tips);
    if (limitText) commits = commits.slice(0, Number(limitText));
    const decorate = (id: string) => {
      const labels = this.labelsFor(id);
      return labels.length > 0 ? ` (${labels.join(', ')})` : '';
    };
    if (oneline) {
      return ok(commits.map((c) => `${c.id}${decorate(c.id)} ${c.message}`).join('\n'));
    }
    return ok(
      commits
        .map((c) =>
          [
            `commit ${c.id}${decorate(c.id)}`,
            ...(c.parents.length > 1 ? [`Merge: ${c.parents.join(' ')}`] : []),
            `Author: ${this.config.get('user.name')} <${this.config.get('user.email')}>`,
            '',
            `    ${c.message}`,
          ].join('\n'),
        )
        .join('\n\n'),
    );
  }

  private show(ref: string): CommandResult {
    const id = this.resolve(ref);
    const commit = id ? this.commits.get(id) : undefined;
    if (!commit) return fail(`fatal: bad revision '${ref}'`);
    const parent = commit.parents[0] ? (this.commits.get(commit.parents[0])?.tree ?? {}) : {};
    return ok(
      [
        `commit ${commit.id}`,
        `Author: ${this.config.get('user.name')} <${this.config.get('user.email')}>`,
        '',
        `    ${commit.message}`,
        '',
        this.patch(parent, commit.tree),
      ].join('\n'),
    );
  }

  private patch(from: Tree, to: Tree): string {
    const diff = diffTrees(from, to);
    const out: string[] = [];
    for (const file of [...diff.added, ...diff.modified, ...diff.removed].sort()) {
      out.push(
        `diff --git a/${file} b/${file}`,
        `--- ${file in from ? `a/${file}` : '/dev/null'}`,
        `+++ ${file in to ? `b/${file}` : '/dev/null'}`,
      );
      const oldLines = from[file] !== undefined ? (from[file] ?? '').split('\n') : [];
      const newLines = to[file] !== undefined ? (to[file] ?? '').split('\n') : [];
      for (const lineText of oldLines) if (!newLines.includes(lineText)) out.push(`-${lineText}`);
      for (const lineText of newLines) if (!oldLines.includes(lineText)) out.push(`+${lineText}`);
    }
    return out.join('\n');
  }

  private diff(args: string[]): CommandResult {
    const staged = takeFlag(args, ['--staged', '--cached']);
    if (staged) return ok(this.patch(this.headTree(), this.index));
    const indexOnlyTracked: Tree = {};
    for (const file of Object.keys(this.index)) {
      if (file in this.working) indexOnlyTracked[file] = this.working[file] ?? '';
    }
    return ok(
      this.patch(this.index, indexOnlyTracked),
      'git diff = changes NOT staged yet. Use git diff --staged to see what will be committed.',
    );
  }

  private branch(args: string[]): CommandResult {
    const remove = takeOption(args, ['-d', '--delete']);
    const force = takeOption(args, ['-D']);
    const rename = takeFlag(args, ['-m', '--move']);
    takeFlag(args, ['-a', '--all', '-v']);

    if (remove !== undefined || force !== undefined) {
      const name = (remove ?? force)!;
      if (!this.branches.has(name)) return fail(`error: branch '${name}' not found.`);
      if (this.head.kind === 'branch' && this.head.name === name) {
        return fail(`error: Cannot delete branch '${name}' checked out at '/home/guru/project'`);
      }
      const target = this.branches.get(name);
      const headId = this.headId();
      if (force === undefined && target && headId && !this.ancestors(headId).has(target)) {
        return fail(
          `error: The branch '${name}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${name}'.`,
          'Git protects commits that exist only on this branch. -D deletes anyway.',
        );
      }
      this.branches.delete(name);
      return ok(
        `Deleted branch ${name} (was ${target ?? 'empty'}).`,
        'Only the label is gone. Merged commits stay in history.',
      );
    }

    if (rename) {
      const [first, second] = args;
      const from = second ? first : this.branchName();
      const to = second ?? first;
      if (!from || !to || !this.branches.has(from))
        return fail('usage: git branch -m [<old>] <new>');
      this.branches.set(to, this.branches.get(from) ?? null);
      this.branches.delete(from);
      const lane = this.lanes.get(from);
      if (lane !== undefined) this.lanes.set(to, lane);
      if (this.head.kind === 'branch' && this.head.name === from)
        this.head = { kind: 'branch', name: to };
      return ok('', `Renamed branch ${from} to ${to}.`);
    }

    const [name, start] = args;
    if (!name) {
      const current = this.head.kind === 'branch' ? this.head.name : null;
      const lines = [...this.branches.keys()]
        .sort()
        .map((b) => `${b === current ? '*' : ' '} ${b}`);
      if (this.head.kind === 'detached') lines.unshift(`* (HEAD detached at ${this.head.id})`);
      return ok(lines.join('\n'), 'The * shows the branch you are on.');
    }
    if (this.branches.has(name)) return fail(`fatal: a branch named '${name}' already exists`);
    const target = start ? this.resolve(start) : this.headId();
    if (!target)
      return fail(
        `fatal: not a valid object name: '${start ?? this.branchName()}'`,
        'Make the first commit before creating branches.',
      );
    this.branches.set(name, target);
    return ok(
      '',
      `Created branch ${name} pointing at ${target}. You are still on ${this.branchName()}: use git switch ${name} to move.`,
    );
  }

  private moveTo(head: Head): CommandResult | null {
    if (this.merging) return fail('error: you need to resolve your current merge first.');
    const target = head.kind === 'branch' ? this.branches.get(head.name) : head.id;
    const targetTree = target ? (this.commits.get(target)?.tree ?? {}) : {};
    const dirty = this.isDirty(); // check BEFORE moving HEAD
    if (dirty && !sameTree(targetTree, this.headTree())) {
      return fail(
        'error: Your local changes to the following files would be overwritten by checkout.\nPlease commit your changes or stash them before you switch branches.',
        'Commit or git stash your changes first, then switch.',
      );
    }
    this.head = head;
    if (!dirty) this.setFiles(targetTree); // dirty but same files: keep the edits, like real Git
    return null;
  }

  private switchCmd(args: string[]): CommandResult {
    const create = takeOption(args, ['-c', '--create']);
    if (create) return this.createAndSwitch(create, args[0]);
    const name = args[0];
    if (!name) return fail('fatal: missing branch name');
    if (args[0] === '-')
      return fail(
        'Switching back with "-" is not supported in the simulator. Type the branch name.',
      );
    if (!this.branches.has(name)) {
      return fail(
        `fatal: invalid reference: ${name}`,
        `Create it first with git switch -c ${name}.`,
      );
    }
    const error = this.moveTo({ kind: 'branch', name });
    return error ?? ok(`Switched to branch '${name}'`);
  }

  private createAndSwitch(name: string, start?: string): CommandResult {
    const made = this.branch([name, ...(start ? [start] : [])]);
    if (made.error) return made;
    const error = this.moveTo({ kind: 'branch', name });
    return (
      error ??
      ok(`Switched to a new branch '${name}'`, `Created ${name} and moved HEAD to it, in one step.`)
    );
  }

  private checkout(args: string[]): CommandResult {
    const create = takeOption(args, ['-b']);
    if (create) return this.createAndSwitch(create, args[0]);
    const dashes = args.indexOf('--');
    if (dashes >= 0) return this.restore(args.slice(dashes + 1));
    const target = args[0];
    if (!target) return fail('fatal: you must name a branch or commit');
    if (this.branches.has(target)) {
      const error = this.moveTo({ kind: 'branch', name: target });
      return error ?? ok(`Switched to branch '${target}'`);
    }
    const id = this.resolve(target);
    if (id) {
      const error = this.moveTo({ kind: 'detached', id });
      return (
        error ??
        ok(
          `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state.\nHEAD is now at ${this.shortMessage(id)}`,
          'Detached HEAD: you are looking at an old commit, not at a branch. Create a branch (git switch -c name) to keep new work.',
        )
      );
    }
    if (target in this.index) return this.restore([target]);
    return fail(`error: pathspec '${target}' did not match any file(s) known to git`);
  }

  private merge(args: string[]): CommandResult {
    if (takeFlag(args, ['--abort'])) {
      if (!this.merging) return fail('fatal: There is no merge to abort (MERGE_HEAD missing).');
      this.merging = null;
      this.setFiles(this.headTree());
      return ok('', 'Cancelled the merge. Everything is back to how it was before git merge.');
    }
    const noFastForward = takeFlag(args, ['--no-ff']);
    const message = takeOption(args, ['-m']);
    const name = args[0];
    if (!name) return fail('fatal: No commit specified to merge.');
    if (this.merging)
      return fail('error: Merging is not possible because you have unmerged files.');
    const theirs = this.resolve(name);
    const ours = this.headId();
    if (!theirs) return fail(`merge: ${name} - not something we can merge`);
    if (!ours) return fail('fatal: make a first commit before merging');
    if (this.isDirty())
      return fail(
        'error: Your local changes would be overwritten by merge. Commit or stash them first.',
      );

    if (this.ancestors(ours).has(theirs)) {
      return ok(
        'Already up to date.',
        `Every commit of ${name} is already in ${this.branchName()}.`,
      );
    }
    if (this.ancestors(theirs).has(ours) && !noFastForward) {
      if (this.head.kind === 'branch') this.branches.set(this.head.name, theirs);
      else this.head = { kind: 'detached', id: theirs };
      this.setFiles(this.commits.get(theirs)?.tree ?? {});
      return ok(
        `Updating ${ours}..${theirs}\nFast-forward`,
        `Fast-forward: ${this.branchName()} had no new commits, so Git just moved the label forward to ${theirs}. No merge commit needed.`,
      );
    }

    const baseId = this.mergeBase(ours, theirs);
    const base = baseId ? (this.commits.get(baseId)?.tree ?? {}) : {};
    const ourTree = this.commits.get(ours)?.tree ?? {};
    const theirTree = this.commits.get(theirs)?.tree ?? {};
    const merged: Tree = {};
    const conflicts = new Set<string>();
    for (const file of new Set([
      ...Object.keys(ourTree),
      ...Object.keys(theirTree),
      ...Object.keys(base),
    ])) {
      const o = ourTree[file];
      const t = theirTree[file];
      const b = base[file];
      let result: string | undefined;
      if (o === t) result = o;
      else if (o === b) result = t;
      else if (t === b) result = o;
      else {
        conflicts.add(file);
        result = `<<<<<<< HEAD\n${o ?? ''}\n=======\n${t ?? ''}\n>>>>>>> ${name}`;
      }
      if (result !== undefined) merged[file] = result;
    }

    if (conflicts.size === 0) {
      this.setFiles(merged);
      const commit = this.newCommit(message ?? `Merge branch '${name}'`, [ours, theirs], merged);
      return ok(
        `Merge made by the 'ort' strategy.\n[${this.branchName()} ${commit.id}] ${commit.message}`,
        `Both branches had new commits, so Git made a merge commit (${commit.id}) with two parents.`,
      );
    }

    this.working = copy(merged);
    this.index = copy(merged);
    for (const file of conflicts) this.index[file] = ourTree[file] ?? '';
    this.merging = { theirs, name, conflicts };
    return fail(
      [...conflicts]
        .map((f) => `Auto-merging ${f}\nCONFLICT (content): Merge conflict in ${f}`)
        .join('\n') + '\nAutomatic merge failed; fix conflicts and then commit the result.',
      'Both branches changed the same file differently. cat the file, write the final text (echo "..." > file), then git add and git commit. Or git merge --abort.',
    );
  }

  /** Applies the change made by `commit` (compared with its first parent) onto `onto`. */
  private applyChange(commit: Commit, onto: Tree, reverse = false): Tree | string {
    const parent = commit.parents[0] ? (this.commits.get(commit.parents[0])?.tree ?? {}) : {};
    const [from, to] = reverse ? [commit.tree, parent] : [parent, commit.tree];
    const result = copy(onto);
    const diff = diffTrees(from, to);
    for (const file of [...diff.added, ...diff.modified, ...diff.removed]) {
      if (result[file] === to[file]) continue;
      if (result[file] !== from[file]) return file; // conflict
      if (file in to) result[file] = to[file] ?? '';
      else delete result[file];
    }
    return result;
  }

  private rebase(args: string[]): CommandResult {
    const upstreamName = args[0];
    if (!upstreamName)
      return fail('fatal: please name the branch to rebase onto, for example git rebase main');
    if (this.head.kind !== 'branch')
      return fail('fatal: rebase needs a branch. Switch to one first.');
    const upstream = this.resolve(upstreamName);
    const ours = this.headId();
    if (!upstream || !ours) return fail(`fatal: invalid upstream '${upstreamName}'`);
    if (this.isDirty())
      return fail(
        'error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.',
      );
    if (this.ancestors(ours).has(upstream)) return ok('Current branch is up to date.');
    if (this.ancestors(upstream).has(ours)) {
      this.branches.set(this.head.name, upstream);
      this.setFiles(this.commits.get(upstream)?.tree ?? {});
      return ok(
        `Successfully rebased and updated refs/heads/${this.head.name}.`,
        'Your branch had no own commits, so it simply moved forward.',
      );
    }

    const base = this.mergeBase(ours, upstream);
    const toReplay: Commit[] = [];
    let cursor: string | undefined = ours;
    while (cursor && cursor !== base) {
      const commit = this.commits.get(cursor);
      if (!commit) break;
      if (commit.parents.length < 2) toReplay.unshift(commit); // merge commits are dropped, like real Git
      cursor = commit.parents[0];
    }

    let tree = copy(this.commits.get(upstream)?.tree ?? {});
    const plan: { message: string; tree: Tree; oldId: string }[] = [];
    for (const commit of toReplay) {
      const applied = this.applyChange(commit, tree);
      if (typeof applied === 'string') {
        return fail(
          `CONFLICT (content): Merge conflict in ${applied}\nerror: could not apply ${commit.id}... ${commit.message}`,
          'Real Git stops here so you fix the file, git add it and run git rebase --continue. The simulator undid the rebase: try git merge instead, or change the file so it does not clash.',
        );
      }
      tree = applied;
      plan.push({ message: commit.message, tree, oldId: commit.id });
    }

    this.branches.set(this.head.name, upstream);
    const mapping: string[] = [];
    for (const step of plan) {
      const parent = this.headId();
      const commit = this.newCommit(step.message, parent ? [parent] : [], step.tree);
      mapping.push(`${step.oldId} -> ${commit.id}  ${step.message}`);
    }
    this.setFiles(tree);
    return ok(
      `Successfully rebased and updated refs/heads/${this.head.name}.\n${mapping.join('\n')}`,
      `Replayed ${plan.length} commit${plan.length === 1 ? '' : 's'} on top of ${upstreamName}. The old ids are gone and new ids were made, so never rebase commits others already pulled.`,
    );
  }

  private reset(args: string[]): CommandResult {
    const soft = takeFlag(args, ['--soft']);
    const hard = takeFlag(args, ['--hard']);
    takeFlag(args, ['--mixed']);
    const ref = args[0] ?? 'HEAD';
    const target = this.resolve(ref);
    if (!target) {
      if (ref in this.index || ref in this.headTree()) return this.restore(['--staged', ...args]);
      return fail(`fatal: ambiguous argument '${ref}': unknown revision`);
    }
    if (this.head.kind === 'branch') this.branches.set(this.head.name, target);
    else this.head = { kind: 'detached', id: target };
    this.merging = null;
    const tree = this.commits.get(target)?.tree ?? {};
    if (!soft) this.index = copy(tree);
    if (hard) this.working = copy(tree);
    const mode = soft ? 'soft' : hard ? 'hard' : 'mixed';
    const explain = {
      soft: 'Moved the branch back. The undone changes are still staged, ready to commit again.',
      mixed: 'Moved the branch back and unstaged the undone changes. They are still in your files.',
      hard: 'Moved the branch back and THREW AWAY the undone changes in your files. Use with care.',
    }[mode];
    return ok(hard ? `HEAD is now at ${this.shortMessage(target)}` : '', explain);
  }

  private revert(ref?: string): CommandResult {
    const id = ref ? this.resolve(ref) : undefined;
    const commit = id ? this.commits.get(id) : undefined;
    if (!commit) return fail(`fatal: bad revision '${ref ?? ''}'`);
    if (this.isDirty()) return fail('error: your local changes would be overwritten by revert.');
    const applied = this.applyChange(commit, this.headTree(), true);
    if (typeof applied === 'string')
      return fail(`error: could not revert ${commit.id}: conflict in ${applied}`);
    this.setFiles(applied);
    const parent = this.headId();
    const made = this.newCommit(`Revert "${commit.message}"`, parent ? [parent] : [], applied);
    return ok(`[${this.branchName()} ${made.id}] ${made.message}`);
  }

  private cherryPick(ref?: string): CommandResult {
    const id = ref ? this.resolve(ref) : undefined;
    const commit = id ? this.commits.get(id) : undefined;
    if (!commit) return fail(`fatal: bad revision '${ref ?? ''}'`);
    if (this.isDirty())
      return fail('error: your local changes would be overwritten by cherry-pick.');
    const applied = this.applyChange(commit, this.headTree());
    if (typeof applied === 'string')
      return fail(`error: could not apply ${commit.id}: conflict in ${applied}`);
    this.setFiles(applied);
    const parent = this.headId();
    const made = this.newCommit(commit.message, parent ? [parent] : [], applied);
    return ok(
      `[${this.branchName()} ${made.id}] ${made.message}`,
      `Copied ${commit.id} as a new commit ${made.id}.`,
    );
  }

  private stash(args: string[]): CommandResult {
    const [action = 'push', ...rest] = args;
    if (action === 'push' || action === 'save') {
      if (!this.isDirty()) return ok('No local changes to save');
      const message = takeOption(rest, ['-m']) ?? `WIP on ${this.branchName()}`;
      this.stashList.unshift({ working: copy(this.working), index: copy(this.index), message });
      const untracked: Tree = {};
      for (const file of Object.keys(this.working))
        if (!(file in this.index)) untracked[file] = this.working[file] ?? '';
      this.setFiles(this.headTree());
      Object.assign(this.working, untracked); // untracked files stay, like real Git
      return ok(`Saved working directory and index state ${message}`);
    }
    if (action === 'list') {
      return ok(this.stashList.map((s, i) => `stash@{${i}}: ${s.message}`).join('\n'));
    }
    if (action === 'pop' || action === 'apply') {
      const top = this.stashList[0];
      if (!top) return fail('No stash entries found.');
      if (this.isDirty())
        return fail('error: Your local changes would be overwritten. Commit or stash them first.');
      this.working = copy(top.working);
      this.index = copy(top.index);
      if (action === 'pop') this.stashList.shift();
      return ok(
        action === 'pop' ? 'Dropped refs/stash@{0}' : '',
        action === 'pop'
          ? 'Brought the shelved changes back and removed them from the stash.'
          : 'Brought the changes back and kept a copy in the stash.',
      );
    }
    if (action === 'drop') {
      if (!this.stashList.shift()) return fail('No stash entries found.');
      return ok('Dropped refs/stash@{0}');
    }
    return fail(`error: unknown subcommand: ${action}`);
  }

  private tag(args: string[]): CommandResult {
    const remove = takeOption(args, ['-d', '--delete']);
    if (remove) {
      if (!this.tags.delete(remove)) return fail(`error: tag '${remove}' not found.`);
      return ok(`Deleted tag '${remove}'`);
    }
    takeOption(args, ['-m']);
    const annotated = takeOption(args, ['-a']);
    const name = annotated ?? args[0];
    const ref = annotated ? args[0] : args[1];
    if (!name) return ok([...this.tags.keys()].sort().join('\n'));
    if (this.tags.has(name)) return fail(`fatal: tag '${name}' already exists`);
    const target = ref ? this.resolve(ref) : this.headId();
    if (!target) return fail('fatal: Failed to resolve HEAD as a valid ref.');
    this.tags.set(name, target);
    return ok('');
  }

  private remote(args: string[]): CommandResult {
    const [action, name, url] = args;
    if (!action || action === '-v') {
      if (!this.remoteUrl) return ok('');
      return ok(`origin\t${this.remoteUrl} (fetch)\norigin\t${this.remoteUrl} (push)`);
    }
    if (action === 'add') {
      if (!name || !url) return fail('usage: git remote add <name> <url>');
      if (this.remoteUrl) return fail(`error: remote ${name} already exists.`);
      this.remoteUrl = url;
      return ok('');
    }
    return fail(`error: unknown subcommand: ${action}`);
  }

  private push(args: string[]): CommandResult {
    const setUpstream = takeFlag(args, ['-u', '--set-upstream']);
    const force = takeFlag(args, ['-f', '--force', '--force-with-lease']);
    if (!this.remoteUrl) {
      return fail(
        'fatal: No configured push destination.',
        'Add one first: git remote add origin https://github.com/you/project.git',
      );
    }
    if (this.head.kind !== 'branch') return fail('fatal: You are not currently on a branch.');
    const [, branchArg] = args;
    const branch = branchArg ?? this.head.name;
    if (!branchArg && !this.upstream.has(branch) && !setUpstream) {
      return fail(
        `fatal: The current branch ${branch} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ${branch}`,
      );
    }
    const local = this.branches.get(branch);
    if (!local) return fail(`error: src refspec ${branch} does not match any`);
    const remoteName = `origin/${branch}`;
    const before = this.remoteRefs.get(remoteName);
    if (before && !this.ancestors(local).has(before) && !force) {
      return fail(
        ` ! [rejected]        ${branch} -> ${branch} (non-fast-forward)\nerror: failed to push some refs`,
        'The remote has commits you do not have (or you rewrote history). Pull first, or force push only on your own branch.',
      );
    }
    this.remoteRefs.set(remoteName, local);
    if (setUpstream) this.upstream.set(branch, remoteName);
    const line = before
      ? `   ${before}..${local}  ${branch} -> ${branch}`
      : ` * [new branch]      ${branch} -> ${branch}`;
    return ok(
      `To ${this.remoteUrl}\n${line}${setUpstream ? `\nbranch '${branch}' set up to track '${remoteName}'.` : ''}`,
    );
  }
}
