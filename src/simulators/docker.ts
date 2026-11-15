import type { ShellSimulator } from './shell';
import { fail, ok, takeFlag, takeOption, type CommandResult } from './types';

/**
 * Pretend Docker for the Docker track. Images, containers, ports, logs, exec,
 * volumes, networks, docker build with a real layer cache (change a file and
 * only the steps after the COPY run again) and docker compose from compose.yaml.
 */

interface Image {
  repo: string;
  tag: string;
  id: string;
  size: string;
  /** What the image runs when the container starts. */
  cmd: string;
  /** Port the app inside listens on (for -p). */
  port?: number;
  /** What curl gets back from it. */
  serves?: string;
  /** Long-running server (nginx, redis...) or a one-off command (hello-world, alpine). */
  server: boolean;
  logs: string[];
  /** Env variable it refuses to start without. */
  requiresEnv?: string;
}

interface Container {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'exited';
  exitCode: number;
  ports: [number, number][];
  env: Record<string, string>;
  logs: string[];
  cmd: string;
  network: string;
  volumes: string[];
  project?: string;
  restart?: string;
  memory?: string;
  cpus?: string;
  readOnly?: boolean;
}

const CATALOG: Record<string, Omit<Image, 'id'>> = {
  'hello-world:latest': {
    repo: 'hello-world',
    tag: 'latest',
    size: '13.3kB',
    cmd: '/hello',
    server: false,
    logs: [],
  },
  'nginx:latest': {
    repo: 'nginx',
    tag: 'latest',
    size: '192MB',
    cmd: 'nginx -g "daemon off;"',
    port: 80,
    server: true,
    serves:
      '<!DOCTYPE html>\n<html><head><title>Welcome to nginx!</title></head>\n<body><h1>Welcome to nginx!</h1></body></html>',
    logs: [
      '/docker-entrypoint.sh: Configuration complete; ready for start up',
      '2026/11/15 09:30:00 [notice] 1#1: nginx/1.27.2 start worker processes',
    ],
  },
  'redis:7': {
    repo: 'redis',
    tag: '7',
    size: '117MB',
    cmd: 'redis-server',
    port: 6379,
    server: true,
    logs: [
      '1:M 15 Nov 2026 09:30:00.000 * Redis version=7.4.1',
      '1:M 15 Nov 2026 09:30:00.001 * Ready to accept connections tcp',
    ],
  },
  'postgres:16': {
    repo: 'postgres',
    tag: '16',
    size: '435MB',
    cmd: 'postgres',
    port: 5432,
    server: true,
    requiresEnv: 'POSTGRES_PASSWORD',
    logs: [
      'PostgreSQL init process complete; ready for start up.',
      'LOG:  database system is ready to accept connections',
    ],
  },
  'python:3.12-slim': {
    repo: 'python',
    tag: '3.12-slim',
    size: '130MB',
    cmd: 'python3',
    server: false,
    logs: [],
  },
  'alpine:3.20': {
    repo: 'alpine',
    tag: '3.20',
    size: '7.8MB',
    cmd: '/bin/sh',
    server: false,
    logs: [],
  },
  'ubuntu:24.04': {
    repo: 'ubuntu',
    tag: '24.04',
    size: '78.1MB',
    cmd: '/bin/bash',
    server: false,
    logs: [],
  },
  'node:22-alpine': {
    repo: 'node',
    tag: '22-alpine',
    size: '155MB',
    cmd: 'node',
    server: false,
    logs: [],
  },
};

const ALIASES: Record<string, string> = {
  hello: 'hello-world:latest',
  'hello-world': 'hello-world:latest',
  nginx: 'nginx:latest',
  redis: 'redis:7',
  'redis:latest': 'redis:7',
  postgres: 'postgres:16',
  'postgres:latest': 'postgres:16',
  python: 'python:3.12-slim',
  'python:3.12': 'python:3.12-slim',
  alpine: 'alpine:3.20',
  'alpine:latest': 'alpine:3.20',
  ubuntu: 'ubuntu:24.04',
  'ubuntu:latest': 'ubuntu:24.04',
  node: 'node:22-alpine',
};

const HELLO = `Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client.`;

const NAMES = [
  'brave_turing',
  'happy_hopper',
  'calm_lovelace',
  'eager_ritchie',
  'quiet_knuth',
  'jolly_ramanujan',
  'sharp_bhabha',
  'kind_raman',
];

const EXPLAIN: Record<string, string> = {
  pull: 'Downloaded the image (the read-only template) from Docker Hub into this machine.',
  images: 'Lists images stored on this machine. An image is a template; it does not run by itself.',
  run: 'docker run = create a container from an image and start it.',
  ps: 'Lists running containers. Add -a to also see stopped ones.',
  stop: 'Asked the main process to stop (SIGTERM). The container still exists and can be started again.',
  start: 'Started a stopped container again, with the same settings and files.',
  restart: 'Stopped and started the container.',
  rm: 'Deleted the container (its writable layer is gone). The image stays.',
  rmi: 'Deleted the image from this machine.',
  logs: 'Shows what the main process printed (stdout and stderr). -f follows new lines.',
  exec: 'Ran an extra command inside a RUNNING container, for debugging.',
  build:
    'Built an image from the Dockerfile, one layer per instruction. Unchanged steps come from the cache.',
  inspect: 'Shows the full low-level details of a container or image as JSON.',
  volume: 'A volume is storage managed by Docker that survives when the container is deleted.',
  network: 'Containers on the same user-defined network can reach each other by container name.',
  compose: 'Compose starts several containers described in compose.yaml with one command.',
  tag: 'Gave an image an extra name, usually <your-user>/<app>:<version> before pushing.',
  push: 'Uploaded the image to a registry (Docker Hub, Amazon ECR...).',
  login: 'Logged in to a registry so you can push.',
  version: 'Shows the client and server (daemon) versions.',
  system: 'docker system prune deletes stopped containers, unused networks and dangling images.',
  stats: 'Shows CPU and memory use per running container (a snapshot here).',
  port: 'Shows which host port goes to which container port.',
};

function shortId(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  return (hash.toString(16) + 'a3f9c2d1e8b7').slice(0, 12);
}

function imageKey(name: string): string {
  if (ALIASES[name]) return ALIASES[name];
  return name.includes(':') ? name : `${name}:latest`;
}

export class DockerEngine {
  readonly images = new Map<string, Image>();
  readonly containers: Container[] = [];
  readonly volumes = new Set<string>();
  readonly networks = new Set<string>(['bridge', 'host', 'none']);
  private layerCache = new Set<string>();
  private loggedIn = false;
  private counter = 0;

  constructor(private readonly shell: ShellSimulator) {}

  /** Lines for `ps` on the host. */
  runningProcesses(): string[] {
    return this.containers
      .filter((c) => c.status === 'running')
      .map((c) => `${c.cmd} (container ${c.name})`);
  }

  /** What `curl localhost:<port>` returns, or null when nothing listens there. */
  serve(port: number): string | null {
    const container = this.containers.find(
      (c) => c.status === 'running' && c.ports.some(([host]) => host === port),
    );
    if (!container) return null;
    return (
      this.images.get(container.image)?.serves ??
      `(port ${port} is open, but ${container.image} does not speak HTTP)`
    );
  }

  run(args: string[]): CommandResult {
    const [sub, ...rest] = args;
    if (!sub || sub === 'help' || sub === '--help') return ok(this.help());
    const result = this.dispatch(sub, rest);
    const key = sub === 'container' || sub === 'image' ? (rest[0] ?? sub) : sub;
    return result.explanation || result.error
      ? result
      : { ...result, explanation: EXPLAIN[key] ?? EXPLAIN[sub] };
  }

  private help(): string {
    return [
      'Images:      docker pull nginx   docker images   docker rmi <image>   docker build -t myapp .',
      'Containers:  docker run -d --name web -p 8080:80 nginx   docker ps [-a]   docker logs web',
      '             docker exec web ls   docker stop web   docker start web   docker rm [-f] web',
      'Storage:     docker volume create data   docker run -v data:/var/lib/postgresql/data ...',
      'Network:     docker network create app-net   docker run --network app-net ...',
      'Compose:     cd ~/app && docker compose up -d   docker compose ps   docker compose down',
      'Share:       docker login   docker tag myapp you/myapp:1.0   docker push you/myapp:1.0',
      'Try also:    curl localhost:8080 (after publishing a port)   docker inspect web',
    ].join('\n');
  }

  private dispatch(sub: string, args: string[]): CommandResult {
    switch (sub) {
      case 'version':
      case '--version':
        return ok('Docker version 27.3.1 (DevGuru simulator)');
      case 'pull':
        return this.pull(args[0]);
      case 'images':
        return this.listImages();
      case 'image':
        return args[0] === 'ls'
          ? this.listImages()
          : args[0] === 'rm'
            ? this.rmi(args.slice(1))
            : args[0] === 'prune'
              ? ok('Total reclaimed space: 0B')
              : fail(`docker image ${args[0] ?? ''}: not supported here`);
      case 'run':
        return this.runContainer(args);
      case 'ps':
        return this.ps(args.includes('-a') || args.includes('--all'));
      case 'container':
        if (args[0] === 'ls') return this.ps(args.includes('-a'));
        if (args[0] === 'prune') return this.prune();
        return this.dispatch(args[0] ?? '', args.slice(1));
      case 'stop':
      case 'start':
      case 'restart':
        return this.lifecycle(sub, args);
      case 'rm':
        return this.rm(args);
      case 'rmi':
        return this.rmi(args);
      case 'logs':
        return this.logs(args);
      case 'exec':
        return this.exec(args);
      case 'inspect':
        return this.inspect(args[0]);
      case 'port':
        return this.port(args[0]);
      case 'stats':
        return this.stats();
      case 'build':
        return this.build(args);
      case 'volume':
        return this.volume(args);
      case 'network':
        return this.network(args);
      case 'compose':
        return this.compose(args);
      case 'tag':
        return this.tag(args);
      case 'login':
        this.loggedIn = true;
        return ok('Login Succeeded');
      case 'push':
        return this.push(args[0]);
      case 'system':
        return args[0] === 'prune'
          ? this.prune()
          : ok(
              'TYPE            TOTAL     ACTIVE\nImages          ' +
                this.images.size +
                '\nContainers      ' +
                this.containers.length,
            );
      default:
        return fail(
          `docker: '${sub}' is not a docker command in this simulator.\nSee 'docker help'.`,
        );
    }
  }

  private find(ref: string | undefined): Container | undefined {
    if (!ref) return undefined;
    return this.containers.find((c) => c.name === ref || c.id.startsWith(ref));
  }

  private ensureImage(name: string, out: string[]): Image | string {
    const key = imageKey(name);
    const existing = this.images.get(key);
    if (existing) return existing;
    const template = CATALOG[key];
    if (!template) {
      return `Unable to find image '${key}' locally\ndocker: Error response from daemon: pull access denied for ${key.split(':')[0]}, repository does not exist or may require 'docker login'.`;
    }
    out.push(`Unable to find image '${key}' locally`, ...this.pullLines(key));
    const image = { ...template, id: shortId(key) };
    this.images.set(key, image);
    return image;
  }

  private pullLines(key: string): string[] {
    const tag = key.split(':')[1] ?? 'latest';
    return [
      `${tag}: Pulling from library/${key.split(':')[0]}`,
      `${shortId(key + 'l1')}: Pull complete`,
      `${shortId(key + 'l2')}: Pull complete`,
      `Status: Downloaded newer image for ${key}`,
    ];
  }

  private pull(name?: string): CommandResult {
    if (!name) return fail('"docker pull" requires exactly 1 argument.');
    const key = imageKey(name);
    if (this.images.has(key))
      return ok(
        `${key.split(':')[1]}: Pulling from library/${key.split(':')[0]}\nStatus: Image is up to date for ${key}`,
      );
    const out: string[] = [];
    const image = this.ensureImage(name, out);
    if (typeof image === 'string') return fail(image.split('\n').slice(1).join('\n'));
    return ok(out.slice(1).join('\n'));
  }

  private listImages(): CommandResult {
    const rows = [...this.images.values()].map(
      (i) => `${i.repo.padEnd(18)} ${i.tag.padEnd(10)} ${i.id}   ${i.size}`,
    );
    return ok(['REPOSITORY         TAG        IMAGE ID       SIZE', ...rows].join('\n'));
  }

  private runContainer(input: string[]): CommandResult {
    const args = [...input];
    const detach = takeFlag(args, ['-d', '--detach']);
    const interactive = takeFlag(args, ['-it', '-ti', '-i', '-t']);
    const autoRemove = takeFlag(args, ['--rm']);
    const name = takeOption(args, ['--name']);
    const network = takeOption(args, ['--network', '--net']) ?? 'bridge';
    const restart = takeOption(args, ['--restart']);
    const memory = takeOption(args, ['-m', '--memory']);
    const cpus = takeOption(args, ['--cpus']);
    const readOnly = takeFlag(args, ['--read-only']);
    while (takeOption(args, ['--tmpfs']) !== undefined) {
      // memory-only mount: accepted, nothing to store in the simulator
    }
    if (restart && !/^(no|always|unless-stopped|on-failure(:\d+)?)$/.test(restart))
      return fail(
        `docker: invalid restart policy "${restart}"`,
        'Use no, always, unless-stopped or on-failure[:max-retries].',
      );
    const ports: [number, number][] = [];
    const env: Record<string, string> = {};
    const volumes: string[] = [];
    for (
      let option = takeOption(args, ['-p', '--publish']);
      option;
      option = takeOption(args, ['-p', '--publish'])
    ) {
      const [host, container] = option.split(':').map(Number);
      if (!host || !container)
        return fail(
          `docker: invalid port mapping "${option}". Use -p HOST:CONTAINER, for example -p 8080:80`,
        );
      ports.push([host, container]);
    }
    for (
      let option = takeOption(args, ['-e', '--env']);
      option;
      option = takeOption(args, ['-e', '--env'])
    ) {
      const [key = '', ...value] = option.split('=');
      env[key] = value.join('=');
    }
    for (
      let option = takeOption(args, ['-v', '--volume']);
      option;
      option = takeOption(args, ['-v', '--volume'])
    ) {
      volumes.push(option);
      const source = option.split(':')[0] ?? '';
      if (source && !source.startsWith('/') && !source.startsWith('.') && !source.startsWith('$'))
        this.volumes.add(source);
    }
    const [imageName, ...command] = args;
    if (!imageName) return fail('"docker run" requires at least 1 argument.');
    if (imageName.startsWith('-'))
      return fail(
        `unknown flag: ${imageName}`,
        'The simulator knows -d, -it, --rm, --name, -p, -e, -v, --network, --restart, --memory, --cpus, --read-only and --tmpfs. Options go before the image name.',
      );
    if (name && this.find(name)) {
      return fail(
        `docker: Error response from daemon: Conflict. The container name "/${name}" is already in use.`,
        'Container names must be unique. Remove the old one (docker rm -f) or pick another name.',
      );
    }
    if (network !== 'bridge' && !this.networks.has(network))
      return fail(`docker: Error response from daemon: network ${network} not found.`);

    const out: string[] = [];
    const image = this.ensureImage(imageName, out);
    if (typeof image === 'string') return fail(image);

    for (const [host] of ports) {
      if (
        this.containers.some((c) => c.status === 'running' && c.ports.some(([h]) => h === host))
      ) {
        return fail(
          `docker: Error response from daemon: Bind for 0.0.0.0:${host} failed: port is already allocated.`,
          `Another container already uses host port ${host}. Pick another host port, for example -p ${host + 1}:${ports[0]?.[1]}.`,
        );
      }
    }

    this.counter++;
    const container: Container = {
      id: shortId(`container${this.counter}${imageName}`),
      name: name ?? NAMES[(this.counter - 1) % NAMES.length] ?? `container_${this.counter}`,
      image: imageKey(imageName),
      status: 'running',
      exitCode: 0,
      ports,
      env,
      logs: [...image.logs],
      cmd: command.length > 0 ? command.join(' ') : image.cmd,
      network,
      volumes,
      restart,
      memory,
      cpus,
      readOnly,
    };

    if (image.requiresEnv && !(image.requiresEnv in env)) {
      container.status = 'exited';
      container.exitCode = 1;
      container.logs = [
        `Error: Database is uninitialized and superuser password is not specified.`,
        `       You must specify ${image.requiresEnv} to a non-empty value.`,
      ];
    } else if (!image.server || command.length > 0) {
      container.status = 'exited';
      container.logs = [this.oneOff(image, command)];
    }

    if (!(autoRemove && container.status === 'exited')) this.containers.push(container);

    const notes: string[] = [];
    if (container.status === 'exited' && container.exitCode !== 0) {
      out.push(...container.logs);
      return {
        output: out.join('\n'),
        error: true,
        explanation: `The container started and stopped at once. Read why with docker logs ${container.name}: here the required ${image.requiresEnv} is missing (add -e ${image.requiresEnv}=secret).`,
      };
    }
    if (container.status === 'exited') {
      out.push(...container.logs.filter(Boolean));
      notes.push(
        'The command finished, so the container stopped (Exited). A container lives only as long as its main process.',
      );
      if (autoRemove) notes.push('--rm deleted it automatically.');
    } else if (detach) {
      out.push(container.id + 'f00d'.repeat(13));
      notes.push(`Started in the background (-d). Name: ${container.name}.`);
      if (ports.length > 0)
        notes.push(
          `-p ${ports.map(([h, c]) => `${h}:${c}`).join(', ')} sends host port to container port: try curl localhost:${ports[0]?.[0]}`,
        );
      else if (image.port)
        notes.push(
          `No port is published, so you cannot reach it from the host. Add -p 8080:${image.port}.`,
        );
    } else {
      out.push(...container.logs);
      notes.push(
        'Without -d the terminal stays attached to the container (Ctrl+C stops it). The simulator gives your prompt back; the container keeps running. Use -d next time.',
      );
    }
    if (interactive && container.status === 'exited' && command.length === 0)
      notes.push(
        '-it gives you a shell inside the container in a real terminal. Here, try docker run --rm alpine ls / instead.',
      );
    return ok(out.join('\n'), `${EXPLAIN.run} ${notes.join(' ')}`);
  }

  private oneOff(image: Image, command: string[]): string {
    if (image.repo === 'hello-world') return HELLO;
    const text = command.join(' ');
    if (text === '') return '';
    const printMatch = /print\((["'])(.*)\1\)/.exec(text);
    if (/python3? --version/.test(text) || /python3? -V/.test(text)) return 'Python 3.12.7';
    if (printMatch) return printMatch[2] ?? '';
    if (/^node -v|^node --version/.test(text)) return 'v22.11.0';
    if (/^echo /.test(text)) return text.slice(5);
    if (/cat \/etc\/os-release/.test(text))
      return image.repo === 'alpine'
        ? 'NAME="Alpine Linux"\nVERSION_ID=3.20.3'
        : 'NAME="Debian GNU/Linux"\nVERSION_ID="12"';
    if (/^ls\b/.test(text)) return 'bin  dev  etc  home  lib  proc  root  tmp  usr  var';
    if (/^(uname|hostname)/.test(text)) return 'a1b2c3d4e5f6';
    if (/^(sh|bash|\/bin\/sh|\/bin\/bash)$/.test(text)) return '';
    return `(ran "${text}" inside ${image.repo})`;
  }

  private ps(all: boolean): CommandResult {
    const list = this.containers.filter((c) => all || c.status === 'running');
    const rows = list.map((c) => {
      const status =
        c.status === 'running' ? 'Up 2 minutes' : `Exited (${c.exitCode}) 1 minute ago`;
      const ports =
        c.status === 'running' ? c.ports.map(([h, p]) => `0.0.0.0:${h}->${p}/tcp`).join(', ') : '';
      return `${c.id}   ${c.image.padEnd(18)} ${status.padEnd(26)} ${ports.padEnd(22)} ${c.name}`;
    });
    return ok(
      [
        'CONTAINER ID   IMAGE              STATUS                     PORTS                  NAMES',
        ...rows,
      ].join('\n'),
    );
  }

  private lifecycle(action: 'stop' | 'start' | 'restart', refs: string[]): CommandResult {
    if (refs.length === 0) return fail(`"docker ${action}" requires at least 1 argument.`);
    const out: string[] = [];
    for (const ref of refs) {
      const container = this.find(ref);
      if (!container) return fail(`Error response from daemon: No such container: ${ref}`);
      if (action === 'stop') {
        container.status = 'exited';
        container.exitCode = 0;
      } else {
        const image = this.images.get(container.image);
        if (image?.requiresEnv && !(image.requiresEnv in container.env))
          return fail(`Error: container ${ref} exits again: ${image.requiresEnv} is missing.`);
        container.status = image?.server && container.cmd === image.cmd ? 'running' : 'exited';
      }
      out.push(ref);
    }
    return ok(out.join('\n'));
  }

  private rm(args: string[]): CommandResult {
    const force = takeFlag(args, ['-f', '--force']);
    const out: string[] = [];
    for (const ref of args) {
      const container = this.find(ref);
      if (!container) return fail(`Error response from daemon: No such container: ${ref}`);
      if (container.status === 'running' && !force) {
        return fail(
          `Error response from daemon: cannot remove container "/${container.name}": container is running: stop the container before removing or force remove`,
          'Stop it first (docker stop), or use docker rm -f.',
        );
      }
      this.containers.splice(this.containers.indexOf(container), 1);
      out.push(ref);
    }
    return ok(out.join('\n'));
  }

  private rmi(args: string[]): CommandResult {
    const force = takeFlag(args, ['-f', '--force']);
    const out: string[] = [];
    for (const ref of args) {
      const key = imageKey(ref);
      const image = this.images.get(key);
      if (!image) return fail(`Error response from daemon: No such image: ${key}`);
      const user = this.containers.find((c) => c.image === key);
      if (user && !force)
        return fail(
          `Error response from daemon: conflict: unable to remove repository reference "${key}" (must force) - container ${user.id} is using its referenced image`,
          'A container (even a stopped one) still uses this image. Remove the container first.',
        );
      this.images.delete(key);
      out.push(`Untagged: ${key}`, `Deleted: sha256:${image.id}`);
    }
    return ok(out.join('\n'));
  }

  private logs(args: string[]): CommandResult {
    const follow = takeFlag(args, ['-f', '--follow']);
    const tail = takeOption(args, ['--tail', '-n']);
    const container = this.find(args[0]);
    if (!container) return fail(`Error response from daemon: No such container: ${args[0] ?? ''}`);
    const lines = tail ? container.logs.slice(-Number(tail)) : container.logs;
    return ok(
      lines.join('\n'),
      follow
        ? `${EXPLAIN.logs} (In a real terminal -f keeps waiting; press Ctrl+C to stop.)`
        : undefined,
    );
  }

  private exec(input: string[]): CommandResult {
    const args = [...input];
    const interactive = takeFlag(args, ['-it', '-ti', '-i', '-t']);
    const [ref, ...command] = args;
    const container = this.find(ref);
    if (!container) return fail(`Error response from daemon: No such container: ${ref ?? ''}`);
    if (container.status !== 'running')
      return fail(
        `Error response from daemon: container ${container.id} is not running`,
        'exec works only on a running container. Start it first.',
      );
    const text = command.join(' ');
    if (/^(sh|bash|\/bin\/sh|\/bin\/bash)$/.test(text)) {
      return ok(
        `root@${container.id}:/# `,
        interactive
          ? 'This opens a shell inside the container in a real terminal. In the simulator run one command at a time: docker exec <name> ls /'
          : 'Add -it for an interactive shell.',
      );
    }
    if (/^redis-cli( ping)?$/.test(text)) return ok('PONG');
    if (/^redis-cli set /.test(text)) return ok('OK');
    if (/^redis-cli get /.test(text)) return ok('"hello"');
    if (/^psql/.test(text)) return ok('psql (16.4)\nType "help" for help.\n\npostgres=#');
    if (text === 'env' || text === 'printenv')
      return ok(
        [
          'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin',
          `HOSTNAME=${container.id}`,
          ...Object.entries(container.env).map(([k, v]) => `${k}=${v}`),
        ].join('\n'),
      );
    if (text === 'hostname') return ok(container.id);
    if (text === 'whoami') return ok('root');
    if (/^ls/.test(text))
      return ok(
        text.includes('/app')
          ? 'Dockerfile  app.py  compose.yaml  requirements.txt'
          : 'app  bin  dev  etc  home  lib  proc  root  tmp  usr  var',
      );
    if (/^cat \/etc\/os-release/.test(text))
      return ok('PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"');
    if (/^ps/.test(text))
      return ok(`PID   USER     COMMAND\n    1 root     ${container.cmd}\n   42 root     ${text}`);
    if (/^echo /.test(text)) return ok(text.slice(5));
    return ok(`(ran "${text}" inside ${container.name})`);
  }

  private inspect(ref?: string): CommandResult {
    const container = this.find(ref);
    if (!container) {
      const image = ref ? this.images.get(imageKey(ref)) : undefined;
      if (!image) return fail(`Error: No such object: ${ref ?? ''}`);
      return ok(
        JSON.stringify(
          [
            {
              Id: `sha256:${image.id}`,
              RepoTags: [`${image.repo}:${image.tag}`],
              Size: image.size,
              Config: {
                Cmd: image.cmd.split(' '),
                ExposedPorts: image.port ? { [`${image.port}/tcp`]: {} } : {},
              },
            },
          ],
          null,
          2,
        ),
      );
    }
    return ok(
      JSON.stringify(
        [
          {
            Id: container.id,
            Name: `/${container.name}`,
            State: { Status: container.status, ExitCode: container.exitCode },
            Config: {
              Image: container.image,
              Env: Object.entries(container.env).map(([k, v]) => `${k}=${v}`),
              Cmd: container.cmd.split(' '),
            },
            HostConfig: {
              Binds: container.volumes,
              RestartPolicy: { Name: container.restart ?? 'no' },
              Memory: container.memory ?? 0,
              NanoCpus: container.cpus ? Number(container.cpus) * 1e9 : 0,
              ReadonlyRootfs: container.readOnly ?? false,
            },
            NetworkSettings: {
              Networks: {
                [container.network]: {
                  IPAddress: `172.17.0.${this.containers.indexOf(container) + 2}`,
                },
              },
              Ports: Object.fromEntries(
                container.ports.map(([h, c]) => [
                  `${c}/tcp`,
                  [{ HostIp: '0.0.0.0', HostPort: String(h) }],
                ]),
              ),
            },
          },
        ],
        null,
        2,
      ),
    );
  }

  private port(ref?: string): CommandResult {
    const container = this.find(ref);
    if (!container) return fail(`Error: No such container: ${ref ?? ''}`);
    return ok(container.ports.map(([h, c]) => `${c}/tcp -> 0.0.0.0:${h}`).join('\n'));
  }

  private stats(): CommandResult {
    const running = this.containers.filter((c) => c.status === 'running');
    return ok(
      [
        'CONTAINER ID   NAME              CPU %     MEM USAGE / LIMIT',
        ...running.map(
          (c, i) =>
            `${c.id}   ${c.name.padEnd(17)} ${(0.4 + i * 0.3).toFixed(2)}%     ${12 + i * 9}MiB / 3.8GiB`,
        ),
      ].join('\n'),
      `${EXPLAIN.stats} In a real terminal it keeps updating; press Ctrl+C to stop.`,
    );
  }

  private build(input: string[]): CommandResult {
    const args = [...input];
    const tag = takeOption(args, ['-t', '--tag']);
    const file = takeOption(args, ['-f', '--file']) ?? 'Dockerfile';
    const context = args[0];
    if (!context)
      return fail(
        'ERROR: "docker build" requires exactly 1 argument (the build context, usually .).',
      );
    const base = context === '.' ? '' : `${context.replace(/\/$/, '')}/`;
    const text = this.shell.readFile(`${base}${file}`);
    if (text === undefined)
      return fail(
        `ERROR: failed to solve: failed to read dockerfile: open ${file}: no such file or directory`,
        'Run docker build in the folder that has the Dockerfile (cd ~/app), or pass its folder.',
      );

    const steps = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    const from = steps.find((s) => /^FROM\s/i.test(s));
    if (!from)
      return fail('ERROR: failed to solve: the Dockerfile must start with FROM <base image>');
    const out: string[] = ['[+] Building 4.2s'];
    const pulled: string[] = [];
    const baseImage = this.ensureImage(from.split(/\s+/)[1] ?? '', pulled);
    if (typeof baseImage === 'string')
      return fail(`ERROR: failed to solve: ${from.split(/\s+/)[1]}: not found`);

    const contextFiles = this.shell.filesUnder(context);
    let key = '';
    let cached = 0;
    let cmd = baseImage.cmd;
    let port: number | undefined;
    steps.forEach((step, i) => {
      const [instruction = ''] = step.split(/\s+/);
      let input = step;
      if (/^(COPY|ADD)$/i.test(instruction)) {
        const sources = step.split(/\s+/).slice(1, -1);
        const relevant = Object.entries(contextFiles)
          .filter(([path]) =>
            sources.some((s) => s === '.' || path === s || path.startsWith(`${s}/`)),
          )
          .sort(([a], [b]) => a.localeCompare(b));
        input += JSON.stringify(relevant);
      }
      key = shortId(key + input);
      const hit = this.layerCache.has(key);
      if (hit) cached++;
      this.layerCache.add(key);
      out.push(` => ${hit ? 'CACHED ' : ''}[${i + 1}/${steps.length}] ${step}`);
      if (/^CMD$/i.test(instruction) || /^ENTRYPOINT$/i.test(instruction)) {
        const json = /\[(.*)\]/.exec(step);
        cmd = json
          ? (json[1] ?? '')
              .replace(/"/g, '')
              .split(',')
              .map((s) => s.trim())
              .join(' ')
          : step.split(/\s+/).slice(1).join(' ');
      }
      if (/^EXPOSE$/i.test(instruction)) port = Number(step.split(/\s+/)[1]);
    });

    const name = tag ?? `<none>`;
    const key2 = tag ? imageKey(tag) : `sha:${key}`;
    const [repo = 'unnamed', version = 'latest'] = key2.split(':');
    const appName = repo.split('/').pop() ?? repo;
    this.images.set(key2, {
      repo,
      tag: version,
      id: key.slice(0, 12),
      size: '148MB',
      cmd,
      port,
      server: true,
      serves: `Hello from my app! (image ${appName}:${version})`,
      logs: [
        `[INFO] Starting gunicorn 23.0.0`,
        `[INFO] Listening at: http://0.0.0.0:${port ?? 8000}`,
        '[INFO] Booting worker with pid: 7',
      ],
    });
    out.push(` => exporting layers`, ` => naming to docker.io/library/${name}`);
    const explanation =
      cached > 0
        ? `${cached} of ${steps.length} steps came from the cache, so the build was fast. A step runs again only if it or anything before it changed.`
        : `${EXPLAIN.build} Run the same build again and the steps will say CACHED. Change app.py and only the steps from COPY . . run again.`;
    return ok([...pulled, ...out].join('\n'), explanation);
  }

  private volume(args: string[]): CommandResult {
    const [action, name] = args;
    if (action === 'create' && name) {
      this.volumes.add(name);
      return ok(name);
    }
    if (action === 'ls')
      return ok(
        ['DRIVER    VOLUME NAME', ...[...this.volumes].map((v) => `local     ${v}`)].join('\n'),
      );
    if (action === 'rm' && name) {
      if (this.containers.some((c) => c.volumes.some((v) => v.startsWith(`${name}:`))))
        return fail(`Error response from daemon: remove ${name}: volume is in use`);
      return this.volumes.delete(name) ? ok(name) : fail(`Error: No such volume: ${name}`);
    }
    if (action === 'inspect' && name)
      return ok(
        JSON.stringify(
          [{ Name: name, Driver: 'local', Mountpoint: `/var/lib/docker/volumes/${name}/_data` }],
          null,
          2,
        ),
      );
    return fail('usage: docker volume create|ls|rm|inspect <name>');
  }

  private network(args: string[]): CommandResult {
    const [action, name] = args;
    if (action === 'create' && name) {
      this.networks.add(name);
      return ok(shortId(name) + 'beef'.repeat(13));
    }
    if (action === 'ls')
      return ok(
        [
          'NETWORK ID     NAME            DRIVER',
          ...[...this.networks].map(
            (n) =>
              `${shortId(n)}   ${n.padEnd(15)} ${n === 'host' ? 'host' : n === 'none' ? 'null' : 'bridge'}`,
          ),
        ].join('\n'),
      );
    if (action === 'rm' && name)
      return this.networks.delete(name) ? ok(name) : fail(`Error: No such network: ${name}`);
    return fail('usage: docker network create|ls|rm <name>');
  }

  private compose(args: string[]): CommandResult {
    const [action = '', ...rest] = args;
    const project = this.shell.cwd.split('/').pop() ?? 'project';
    const text = this.shell.readFile('compose.yaml') ?? this.shell.readFile('docker-compose.yml');
    if (text === undefined)
      return fail(
        'no configuration file provided: not found',
        'Run docker compose in a folder that has compose.yaml (try cd ~/app).',
      );
    const services = parseCompose(text);
    const mine = this.containers.filter((c) => c.project === project);

    if (action === 'up') {
      const out: string[] = [];
      const network = `${project}_default`;
      if (!this.networks.has(network)) {
        this.networks.add(network);
        out.push(`[+] Network ${network}  Created`);
      }
      for (const service of services) {
        const name = `${project}-${service.name}-1`;
        if (mine.some((c) => c.name === name && c.status === 'running')) {
          out.push(`[+] Container ${name}  Running`);
          continue;
        }
        let imageName = service.image;
        if (!imageName && service.build) {
          const built = this.build(['-t', `${project}-${service.name}`, service.build]);
          if (built.error) return built;
          imageName = `${project}-${service.name}`;
        }
        if (!imageName) return fail(`service "${service.name}" has neither an image nor build`);
        const old = this.find(name);
        if (old) this.containers.splice(this.containers.indexOf(old), 1);
        const result = this.runContainer([
          '-d',
          '--name',
          name,
          '--network',
          network,
          ...service.ports.flatMap((p) => ['-p', p]),
          ...Object.entries(service.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
          ...(service.volumes ?? []).flatMap((v) => ['-v', v]),
          imageName,
        ]);
        if (result.error) return result;
        const created = this.find(name);
        if (created) created.project = project;
        out.push(`[+] Container ${name}  Started`);
      }
      return ok(
        out.join('\n'),
        `${EXPLAIN.compose} Services reach each other by service name (for example redis:6379) on the ${network} network.${rest.includes('-d') ? '' : ' Add -d to run in the background.'}`,
      );
    }
    if (action === 'ps')
      return this.ps(true).output
        ? ok(
            [
              'NAME                 IMAGE          STATUS',
              ...mine.map(
                (c) =>
                  `${c.name.padEnd(20)} ${c.image.padEnd(14)} ${c.status === 'running' ? 'Up' : 'Exited'}`,
              ),
            ].join('\n'),
          )
        : ok('');
    if (action === 'down') {
      const out = mine.map((c) => `[+] Container ${c.name}  Removed`);
      for (const c of mine) this.containers.splice(this.containers.indexOf(c), 1);
      this.networks.delete(`${project}_default`);
      out.push(`[+] Network ${project}_default  Removed`);
      const removeVolumes = rest.includes('-v') || rest.includes('--volumes');
      if (removeVolumes) {
        const named = mine.flatMap((c) =>
          c.volumes.map((v) => v.split(':')[0] ?? '').filter((v) => this.volumes.has(v)),
        );
        for (const v of new Set(named)) {
          this.volumes.delete(v);
          out.push(`[+] Volume ${v}  Removed`);
        }
      }
      return ok(
        out.join('\n'),
        removeVolumes
          ? 'Removed the containers, the network and the named volumes: the data is gone.'
          : 'Stopped and removed the containers and the network. Named volumes stay unless you add -v.',
      );
    }
    if (action === 'logs')
      return ok(
        mine
          .flatMap((c) =>
            c.logs.map(
              (l) => `${c.name.replace(`${project}-`, '').replace(/-1$/, '').padEnd(8)}| ${l}`,
            ),
          )
          .join('\n'),
      );
    return fail('usage: docker compose up [-d] | ps | logs | down');
  }

  private tag(args: string[]): CommandResult {
    const [source, target] = args;
    const image = source ? this.images.get(imageKey(source)) : undefined;
    if (!image || !target)
      return fail(`Error response from daemon: No such image: ${source ?? ''}`);
    const key = imageKey(target);
    const [repo = target, version = 'latest'] = key.split(':');
    this.images.set(key, { ...image, repo, tag: version });
    return ok('');
  }

  private push(ref?: string): CommandResult {
    if (!ref) return fail('"docker push" requires exactly 1 argument.');
    const key = imageKey(ref);
    if (!this.images.has(key))
      return fail(`An image does not exist locally with the tag: ${key.split(':')[0]}`);
    if (!this.loggedIn)
      return fail(
        `denied: requested access to the resource is denied`,
        'Log in first with docker login, and tag the image with your Docker Hub user name.',
      );
    return ok(
      `The push refers to repository [docker.io/${key.split(':')[0]}]\n${shortId(key)}: Pushed\n${key.split(':')[1]}: digest: sha256:${shortId(key + 'd')}${shortId(key + 'e')} size: 1573`,
    );
  }

  private prune(): CommandResult {
    const stopped = this.containers.filter((c) => c.status === 'exited');
    for (const c of stopped) this.containers.splice(this.containers.indexOf(c), 1);
    return ok(
      `Deleted Containers:\n${stopped.map((c) => c.id).join('\n')}\n\nTotal reclaimed space: ${stopped.length * 12}MB`,
    );
  }
}

interface ComposeService {
  name: string;
  image?: string;
  build?: string;
  ports: string[];
  env: Record<string, string>;
  volumes?: string[];
}

/** Reads the simple compose.yaml shapes used in the lessons (services, image, build, ports, environment, volumes). */
export function parseCompose(text: string): ComposeService[] {
  const services: ComposeService[] = [];
  let current: ComposeService | null = null;
  let list: 'ports' | 'environment' | 'volumes' | null = null;
  let inServices = true; // files without a services: key still work
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      // top-level keys: only services: holds services (volumes:, networks: do not)
      inServices = line === 'services:';
      current = null;
      list = null;
    } else if (!inServices) {
      continue;
    } else if (indent === 2 && /^[\w-]+:$/.test(line)) {
      current = { name: line.slice(0, -1), ports: [], env: {} };
      services.push(current);
      list = null;
    } else if (current && indent === 4) {
      const [key = '', ...value] = line.split(':');
      const text2 = value
        .join(':')
        .trim()
        .replace(/^["']|["']$/g, '');
      list = null;
      if (key === 'image') current.image = text2;
      else if (key === 'build') current.build = text2 || '.';
      else if (key === 'ports') list = 'ports';
      else if (key === 'environment') list = 'environment';
      else if (key === 'volumes') list = 'volumes';
    } else if (current && indent >= 6 && list) {
      const item = line.replace(/^-\s*/, '').replace(/^["']|["']$/g, '');
      if (list === 'ports') current.ports.push(item);
      else if (list === 'volumes') current.volumes = [...(current.volumes ?? []), item];
      else {
        const [k = '', ...v] = item.split(/[:=]/);
        current.env[k.trim()] = v
          .join('=')
          .trim()
          .replace(/^["']|["']$/g, '');
      }
    }
  }
  return services;
}
