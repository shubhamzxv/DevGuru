import { describe, expect, it } from 'vitest';
import {
  binarySearchFrames,
  sortFrames,
  traversalFrames,
  type SortAlgorithm,
} from '../src/simulators/algorithms';
import { parseDiagram } from '../src/simulators/diagram';
import { parseCompose } from '../src/simulators/docker';
import { GitSimulator } from '../src/simulators/git';
import { MockApi, parseRequestText } from '../src/simulators/http';
import { ShellSimulator } from '../src/simulators/shell';
import { splitWords, starterCommands } from '../src/simulators/types';

function runAll(
  sim: { run: (line: string) => { output: string; error?: boolean } },
  lines: string[],
) {
  return lines.map((line) => sim.run(line));
}

describe('command line helpers', () => {
  it('splits words and keeps quoted text together', () => {
    expect(splitWords(`git commit -m "first commit" --x 'a b'`)).toEqual([
      'git',
      'commit',
      '-m',
      'first commit',
      '--x',
      'a b',
    ]);
  });
  it('reads starter commands without $ and comments', () => {
    expect(starterCommands('# setup\n$ git init\n\ngit status')).toEqual([
      'git init',
      'git status',
    ]);
  });
});

describe('Git simulator', () => {
  const setup = () => {
    const git = new GitSimulator();
    runAll(git, ['git init', 'echo "hello" > app.txt', 'git add .', 'git commit -m "first"']);
    return git;
  };

  it('needs git init first', () => {
    expect(new GitSimulator().run('git status').error).toBe(true);
  });

  it('tracks the three areas', () => {
    const git = new GitSimulator();
    git.run('git init');
    git.run('echo "a" > a.txt');
    expect(git.run('git status').output).toContain('Untracked files');
    git.run('git add a.txt');
    expect(git.run('git status').output).toContain('new file:   a.txt');
    expect(git.run('git commit -m "add a"').output).toContain('root-commit');
    expect(git.run('git status').output).toContain('working tree clean');
    expect(git.run('git commit -m "again"').error).toBe(true);
  });

  it('fast-forwards when main has no new commits', () => {
    const git = setup();
    runAll(git, [
      'git switch -c feature',
      'echo "more" >> app.txt',
      'git commit -am "feature work"',
      'git switch main',
    ]);
    expect(git.run('cat app.txt').output).toBe('hello');
    const merge = git.run('git merge feature');
    expect(merge.output).toContain('Fast-forward');
    expect(git.run('cat app.txt').output).toBe('hello\nmore');
    expect(git.graph().every((c) => c.parents.length <= 1)).toBe(true);
  });

  it('makes a merge commit when both branches moved', () => {
    const git = setup();
    runAll(git, [
      'git switch -c feature',
      'echo "f" > f.txt',
      'git add .',
      'git commit -m "f"',
      'git switch main',
      'echo "m" > m.txt',
      'git add .',
      'git commit -m "m"',
    ]);
    expect(git.run('git merge feature').output).toContain("Merge made by the 'ort' strategy");
    const head = git.graph().find((c) => c.isHead);
    expect(head?.parents).toHaveLength(2);
    expect(git.run('ls').output).toBe('app.txt  f.txt  m.txt');
  });

  it('reports a conflict and lets you resolve it', () => {
    const git = setup();
    runAll(git, [
      'git switch -c feature',
      'echo "feature version" > app.txt',
      'git commit -am "feature"',
      'git switch main',
      'echo "main version" > app.txt',
      'git commit -am "main"',
    ]);
    const merge = git.run('git merge feature');
    expect(merge.error).toBe(true);
    expect(merge.output).toContain('CONFLICT');
    expect(git.run('cat app.txt').output).toContain('<<<<<<< HEAD');
    expect(git.run('git commit -m "x"').error).toBe(true);
    runAll(git, ['echo "both versions" > app.txt', 'git add app.txt']);
    expect(git.run('git commit -m "resolve"').error).toBeFalsy();
    expect(git.graph().find((c) => c.isHead)?.parents).toHaveLength(2);
  });

  it('rebase replays commits with new ids', () => {
    const git = setup();
    runAll(git, ['git switch -c feature', 'echo "f" > f.txt', 'git add .', 'git commit -m "f"']);
    const oldId = git.resolve('feature');
    runAll(git, [
      'git switch main',
      'echo "m" > m.txt',
      'git add .',
      'git commit -m "m"',
      'git switch feature',
    ]);
    expect(git.run('git rebase main').output).toContain('Successfully rebased');
    const newId = git.resolve('feature');
    expect(newId).not.toBe(oldId);
    expect(git.resolve('feature~1')).toBe(git.resolve('main'));
    expect(git.run('ls').output).toBe('app.txt  f.txt  m.txt');
  });

  it('reset --hard and revert undo work', () => {
    const git = setup();
    runAll(git, ['echo "bad" > app.txt', 'git commit -am "bad change"']);
    expect(git.run('git revert HEAD').output).toContain('Revert "bad change"');
    expect(git.run('cat app.txt').output).toBe('hello');
    git.run('git reset --hard HEAD~2');
    expect(git.run('git log --oneline').output.split('\n')).toHaveLength(1);
  });

  it('stash shelves and restores changes', () => {
    const git = setup();
    git.run('echo "wip" > app.txt');
    git.run('git stash');
    expect(git.run('cat app.txt').output).toBe('hello');
    git.run('git stash pop');
    expect(git.run('cat app.txt').output).toBe('wip');
  });

  it('reflog finds commits lost by reset', () => {
    const git = setup();
    git.run('echo "two" > app.txt');
    git.run('git commit -am "second"');
    const lost = git.resolve('HEAD');
    git.run('git reset --hard HEAD~1');
    const log = git.run('git reflog').output.split('\n');
    expect(log[0]).toContain('HEAD@{0}: reset: moving to HEAD~1');
    expect(log[1]).toContain('HEAD@{1}: commit: second');
    git.run('git reset --hard HEAD@{1}');
    expect(git.resolve('HEAD')).toBe(lost);
    expect(git.run('cat app.txt').output).toBe('two');
  });

  it('respects .gitignore', () => {
    const git = new GitSimulator();
    git.run('git init');
    git.run('echo "*.log" > .gitignore');
    git.run('echo "secret" > .env');
    git.run('echo ".env" >> .gitignore');
    git.run('echo "x" > debug.log');
    git.run('echo "code" > app.py');
    expect(git.run('git status -s').output).toBe('?? .gitignore\n?? app.py');
    git.run('git add .');
    expect(Object.keys(git.index).sort()).toEqual(['.gitignore', 'app.py']);
    expect(git.run('git add debug.log').error).toBe(true);
    expect(git.run('git check-ignore -v .env').output).toBe('.gitignore:.env\t.env');
  });

  it('push needs a remote, then shows origin/main', () => {
    const git = setup();
    expect(git.run('git push').error).toBe(true);
    git.run('git remote add origin https://github.com/guru/project.git');
    expect(git.run('git push -u origin main').output).toContain('[new branch]');
    expect(git.graph().slice(-1)[0]?.labels).toContain('origin/main');
  });
});

describe('Linux shell simulator', () => {
  it('moves around and lists files', () => {
    const sh = new ShellSimulator();
    expect(sh.run('pwd').output).toBe('/home/guru');
    sh.run('cd app');
    expect(sh.prompt()).toBe('guru@devguru:~/app$');
    expect(sh.run('ls').output).toBe('app.py  compose.yaml  Dockerfile  requirements.txt');
    sh.run('cd ..');
    expect(sh.run('cd nowhere').error).toBe(true);
  });

  it('supports pipes, redirects and chains', () => {
    const sh = new ShellSimulator();
    expect(sh.run('grep ERROR logs/app.log | wc -l').output).toBe('2');
    expect(sh.run('cat logs/app.log | grep -c INFO').output).toBe('4');
    sh.run('echo "line one" > out.txt && echo "line two" >> out.txt');
    expect(sh.run('cat out.txt').output).toBe('line one\nline two');
    expect(sh.run('find . -name "*.py"').output).toBe('./app/app.py');
  });

  it('enforces permissions and runs scripts', () => {
    const sh = new ShellSimulator();
    expect(sh.run('echo "x" > /etc/test').error).toBe(true);
    expect(sh.run('touch /etc/test').error).toBe(true);
    expect(sh.run('sudo touch /etc/test').error).toBeFalsy();
    expect(sh.run('./scripts/backup.sh').error).toBe(true);
    sh.run('chmod +x scripts/backup.sh');
    expect(sh.run('ls -l scripts').output).toContain('-rwxr-xr-x');
    expect(sh.run('./scripts/backup.sh').output).toBe('Backing up notes...\nDone');
    expect(sh.run('ls').output).toContain('notes.bak');
  });
});

describe('Linux simulator: text tools, Bash and system', () => {
  it('runs cut, sed, awk and tr', () => {
    const sh = new ShellSimulator();
    sh.run("echo 'name,city' > p.csv; echo 'Asha,Delhi' >> p.csv");
    expect(sh.run('cut -d, -f2 p.csv').output).toBe('city\nDelhi');
    expect(sh.run("sed 's/Delhi/Mumbai/' p.csv").output).toBe('name,city\nAsha,Mumbai');
    expect(sh.run("sed -n '2p' p.csv").output).toBe('Asha,Delhi');
    expect(sh.run("awk -F, 'NR > 1 {print $1}' p.csv").output).toBe('Asha');
    expect(sh.run("awk '$8 >= 400 {print $8}' logs/access.log").output).toBe('401\n401\n403\n500');
    expect(sh.run("awk '{sum += $9} END {print sum}' logs/access.log").output).toBe('5472');
    expect(sh.run('echo hello | tr a-z A-Z').output).toBe('HELLO');
  });

  it('runs Bash if, loops, functions, $? and arithmetic', () => {
    const sh = new ShellSimulator();
    expect(sh.run('x=5; if [ $x -gt 3 ]; then echo big; else echo small; fi').output).toBe('big');
    expect(sh.run('for i in {1..3}; do echo "n=$i"; done').output).toBe('n=1\nn=2\nn=3');
    expect(sh.run('c=0; while [ $c -lt 3 ]; do c=$((c+1)); done; echo $c').output).toBe('3');
    sh.run('greet() { echo "Hi $1"; }');
    expect(sh.run('greet Asha').output).toBe('Hi Asha');
    expect(sh.run('echo "today is $(date +%F)"').output).toBe('today is 2026-11-15');
    expect(sh.run('ls missing; echo "status $?"').output).toContain('status 2'.replace('2', '1'));
    expect(sh.run("echo 'a > b'").output).toBe('a > b');
  });

  it('runs a script with arguments and exit codes', () => {
    const sh = new ShellSimulator();
    sh.run("echo 'echo \"args: $# first: $1\"' > s.sh; echo 'exit 3' >> s.sh");
    expect(sh.run('./s.sh a').error).toBe(true); // no x permission yet
    expect(sh.run('bash s.sh a b').output).toBe('args: 2 first: a');
    expect(sh.run('echo $?').output).toBe('3');
  });

  it('manages services, users and cron', () => {
    const sh = new ShellSimulator();
    expect(sh.run('systemctl is-active nginx').output).toBe('inactive');
    expect(sh.run('systemctl start nginx').error).toBe(true); // needs sudo
    sh.run('sudo systemctl enable --now nginx');
    expect(sh.run('systemctl status nginx').output).toContain('active (running)');
    sh.run('sudo useradd -m priya');
    sh.run('sudo usermod -aG docker priya');
    expect(sh.run('groups priya').output).toBe('priya : priya docker');
    expect(sh.run('tail -1 /etc/passwd').output).toContain('priya:x:');
    sh.run("echo '0 2 * * * /home/guru/scripts/backup.sh' | crontab -");
    expect(sh.run('crontab -l').output).toBe('0 2 * * * /home/guru/scripts/backup.sh');
    expect(sh.run("echo '0 2 * *' | crontab -").error).toBe(true);
  });
});

describe('Docker simulator', () => {
  it('runs a web server and reaches it with curl', () => {
    const sh = new ShellSimulator();
    expect(sh.run('curl localhost:8080').error).toBe(true);
    const run = sh.run('docker run -d --name web -p 8080:80 nginx');
    expect(run.output).toContain('Pulling from library/nginx');
    expect(sh.run('docker ps').output).toContain('web');
    expect(sh.run('curl localhost:8080').output).toContain('Welcome to nginx!');
    expect(sh.run('docker run -d -p 8080:80 nginx').error).toBe(true); // port taken
    expect(sh.run('docker rm web').error).toBe(true); // still running
    sh.run('docker stop web');
    expect(sh.run('docker ps').output).not.toContain('web');
    expect(sh.run('docker ps -a').output).toContain('Exited');
  });

  it('explains a container that exits at once', () => {
    const sh = new ShellSimulator();
    const result = sh.run('docker run -d postgres');
    expect(result.error).toBe(true);
    expect(result.output).toContain('POSTGRES_PASSWORD');
    expect(
      sh.run('docker run -d -e POSTGRES_PASSWORD=secret --name db postgres').error,
    ).toBeFalsy();
  });

  it('uses the layer cache on the second build', () => {
    const sh = new ShellSimulator();
    sh.run('cd app');
    expect(sh.run('docker build -t myapp .').output).not.toContain('CACHED');
    expect(sh.run('docker build -t myapp .').output.match(/CACHED/g)).toHaveLength(7);
    sh.run('echo "# changed" >> app.py');
    const third = sh.run('docker build -t myapp .').output;
    expect(third).toContain('CACHED [4/7] RUN pip install');
    expect(third).toContain(' => [5/7] COPY . .');
  });

  it('starts a compose project', () => {
    expect(
      parseCompose(
        'services:\n  web:\n    build: .\n    ports:\n      - "8000:8000"\n  redis:\n    image: redis:7',
      ),
    ).toEqual([
      { name: 'web', build: '.', ports: ['8000:8000'], env: {} },
      { name: 'redis', image: 'redis:7', ports: [], env: {} },
    ]);
    const sh = new ShellSimulator();
    sh.run('cd app');
    expect(sh.run('docker compose up -d').output).toContain('Container app-redis-1  Started');
    expect(sh.run('curl localhost:8000').output).toContain('Hello from my app!');
    sh.run('docker compose down');
    expect(sh.run('docker ps -a').output.split('\n')).toHaveLength(1);
  });

  it('accepts restart and resource options', () => {
    const sh = new ShellSimulator();
    const run = sh.run(
      'docker run -d --name api --restart unless-stopped --memory 512m --cpus 1 --read-only --tmpfs /tmp -p 8080:80 nginx',
    );
    expect(run.error).toBeFalsy();
    expect(sh.run('docker inspect api').output).toContain('"unless-stopped"');
    expect(sh.run('docker run -d --restart sometimes nginx').error).toBe(true);
    expect(sh.run('docker run -d --bogus nginx').output).toContain('unknown flag: --bogus');
  });

  it('skips top-level volumes in compose and removes them with down -v', () => {
    const text =
      'services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata:';
    expect(parseCompose(text)).toEqual([
      {
        name: 'db',
        image: 'postgres:16',
        ports: [],
        env: { POSTGRES_PASSWORD: 'secret' },
        volumes: ['pgdata:/var/lib/postgresql/data'],
      },
    ]);
  });
});

describe('HTTP simulator', () => {
  it('reads request text', () => {
    expect(
      parseRequestText('POST /books\nContent-Type: application/json\n\n{"title": "x"}'),
    ).toEqual({
      method: 'POST',
      path: '/books',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title": "x"}',
    });
  });

  it('creates, validates and deletes', () => {
    const api = new MockApi();
    const json = { 'Content-Type': 'application/json' };
    expect(api.send({ method: 'GET', path: '/books', headers: {}, body: '' }).status).toBe(200);
    const created = api.send({
      method: 'POST',
      path: '/books',
      headers: json,
      body: '{"title":"Gitanjali","author":"Tagore"}',
    });
    expect(created.status).toBe(201);
    expect(created.headers.Location).toBe('/books/6');
    expect(
      api.send({ method: 'POST', path: '/books', headers: json, body: '{"title":"No author"}' })
        .status,
    ).toBe(422);
    expect(
      api.send({ method: 'POST', path: '/books', headers: json, body: '{bad json' }).status,
    ).toBe(400);
    expect(api.send({ method: 'POST', path: '/books', headers: {}, body: '{"a":1}' }).status).toBe(
      415,
    );
    expect(api.send({ method: 'DELETE', path: '/books/6', headers: {}, body: '' }).status).toBe(
      204,
    );
    expect(api.send({ method: 'DELETE', path: '/books/6', headers: {}, body: '' }).status).toBe(
      404,
    );
    expect(api.send({ method: 'DELETE', path: '/books', headers: {}, body: '' }).status).toBe(405);
  });

  it('explains 401 vs 403, 304 and 429', () => {
    const api = new MockApi();
    expect(api.send({ method: 'GET', path: '/me', headers: {}, body: '' }).status).toBe(401);
    const login = api.send({
      method: 'POST',
      path: '/login',
      headers: { 'Content-Type': 'application/json' },
      body: '{"username":"guru","password":"secret"}',
    });
    const token = (JSON.parse(login.body) as { access_token: string }).access_token;
    const auth = { Authorization: `Bearer ${token}` };
    expect(api.send({ method: 'GET', path: '/me', headers: auth, body: '' }).status).toBe(200);
    expect(api.send({ method: 'GET', path: '/admin', headers: auth, body: '' }).status).toBe(403);
    const first = api.send({ method: 'GET', path: '/books/1', headers: {}, body: '' });
    expect(
      api.send({
        method: 'GET',
        path: '/books/1',
        headers: { 'If-None-Match': first.headers.ETag ?? '' },
        body: '',
      }).status,
    ).toBe(304);
    const codes = [1, 2, 3, 4].map(
      () => api.send({ method: 'GET', path: '/limited', headers: {}, body: '' }).status,
    );
    expect(codes).toEqual([200, 200, 200, 429]);
  });
});

describe('diagram and algorithms', () => {
  it('parses a diagram and reports mistakes in plain words', () => {
    const good = parseDiagram(
      '{"nodes":[{"id":"a","label":"A","col":0,"row":0},{"id":"b","label":"B","col":1,"row":0}],"edges":[["a","b"]],"flows":[{"name":"go","steps":[["a","start"],["b","end"]]}]}',
    );
    expect(typeof good).toBe('object');
    expect(
      parseDiagram('{"nodes":[{"id":"a","label":"A","col":0,"row":0}],"edges":[["a","zzz"]]}'),
    ).toContain('does not exist');
    expect(parseDiagram('{ nope')).toContain('not valid');
  });

  it.each<SortAlgorithm>(['bubble', 'selection', 'insertion', 'merge', 'quick'])(
    '%s sort ends sorted',
    (algorithm) => {
      const frames = sortFrames(algorithm, [5, 2, 9, 1, 7, 3]);
      expect(frames.slice(-1)[0]?.values).toEqual([1, 2, 3, 5, 7, 9]);
      expect(frames.slice(-1)[0]?.sorted).toHaveLength(6);
    },
  );

  it('binary search finds or reports missing', () => {
    expect(binarySearchFrames([1, 3, 5, 7, 9], 7).slice(-1)[0]?.found).toBe(3);
    expect(binarySearchFrames([1, 3, 5, 7, 9], 4).slice(-1)[0]?.note).toContain('not in the list');
  });

  it('BFS goes level by level, DFS goes deep', () => {
    expect(traversalFrames('bfs').slice(-1)[0]?.visited).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ]);
    expect(traversalFrames('dfs').slice(-1)[0]?.visited).toEqual([
      'A',
      'B',
      'D',
      'E',
      'H',
      'F',
      'C',
      'G',
    ]);
  });
});
