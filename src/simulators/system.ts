import { fail, ok, type CommandResult } from './types';

/**
 * The pretend machine's services, users, groups and crontab, for the Linux track:
 * systemctl, journalctl, useradd, usermod, groups, passwd, crontab, ss, du, scp, wget.
 */

interface Service {
  description: string;
  active: boolean;
  enabled: boolean;
  pid: number;
  logs: string[];
}

interface User {
  uid: number;
  groups: string[];
  home: string;
}

export class SystemState {
  readonly services = new Map<string, Service>([
    [
      'nginx',
      {
        description: 'A high performance web server',
        active: false,
        enabled: false,
        pid: 1810,
        logs: [],
      },
    ],
    [
      'ssh',
      {
        description: 'OpenBSD Secure Shell server',
        active: true,
        enabled: true,
        pid: 412,
        logs: ['Server listening on 0.0.0.0 port 22.'],
      },
    ],
    [
      'cron',
      {
        description: 'Regular background program processing daemon',
        active: true,
        enabled: true,
        pid: 530,
        logs: ['(CRON) INFO (Running @reboot jobs)'],
      },
    ],
    [
      'docker',
      {
        description: 'Docker Application Container Engine',
        active: true,
        enabled: true,
        pid: 640,
        logs: ['API listen on /run/docker.sock'],
      },
    ],
    [
      'shop-api',
      {
        description: 'Shop API (gunicorn)',
        active: true,
        enabled: true,
        pid: 1204,
        logs: ['[INFO] Starting gunicorn 23.0.0', '[INFO] Listening at: http://0.0.0.0:8000'],
      },
    ],
  ]);

  readonly users = new Map<string, User>([
    ['root', { uid: 0, groups: ['root'], home: '/root' }],
    ['guru', { uid: 1000, groups: ['guru', 'sudo', 'docker'], home: '/home/guru' }],
  ]);

  readonly groupNames = new Set(['root', 'sudo', 'docker', 'guru', 'www-data', 'developers']);
  crontab: string[] = [];

  systemctl(args: string[], sudo: boolean): CommandResult {
    const [action = '', name = ''] = args.filter((a) => !a.startsWith('--'));
    const unit = name.replace(/\.service$/, '');
    if (action === 'list-units' || action === '') {
      return ok(
        [
          '  UNIT                 LOAD   ACTIVE   SUB      DESCRIPTION',
          ...[...this.services].map(
            ([n, s]) =>
              `  ${`${n}.service`.padEnd(20)} loaded ${(s.active ? 'active' : 'inactive').padEnd(8)} ${(s.active ? 'running' : 'dead').padEnd(8)} ${s.description}`,
          ),
        ].join('\n'),
      );
    }
    if (action === 'daemon-reload')
      return sudo
        ? ok('', 'Re-read the unit files after you created or edited one.')
        : this.needRoot();
    const service = this.services.get(unit);
    if (!service) return fail(`Unit ${unit || '(none)'}.service could not be found.`);
    const time = 'Sun 2026-11-15 09:30:00 IST';
    switch (action) {
      case 'status':
        return {
          output: [
            `${service.active ? '●' : '○'} ${unit}.service - ${service.description}`,
            `     Loaded: loaded (/lib/systemd/system/${unit}.service; ${service.enabled ? 'enabled' : 'disabled'}; preset: enabled)`,
            `     Active: ${service.active ? `active (running) since ${time}; 2h ago` : 'inactive (dead)'}`,
            ...(service.active ? [`   Main PID: ${service.pid} (${unit})`] : []),
            ...service.logs
              .slice(-3)
              .map((l) => `Nov 15 09:30:00 devguru ${unit}[${service.pid}]: ${l}`),
          ].join('\n'),
          exitCode: service.active ? 0 : 3,
          explanation:
            'status shows if the service runs now (Active) and if it starts at boot (enabled). The last log lines are at the bottom.',
        };
      case 'is-active':
        return service.active ? ok('active') : { output: 'inactive', exitCode: 3 };
      case 'is-enabled':
        return service.enabled ? ok('enabled') : { output: 'disabled', exitCode: 1 };
      case 'start':
      case 'stop':
      case 'restart':
      case 'reload':
      case 'enable':
      case 'disable': {
        if (!sudo) return this.needRoot();
        const notes: Record<string, string> = {
          start: 'Started the service now. It will NOT start at boot unless it is enabled.',
          stop: 'Stopped the service now. If it is enabled it will start again at the next boot.',
          restart: 'Stopped and started the service, for example after changing its config.',
          reload:
            'Asked the service to re-read its config without stopping (not all services support it).',
          enable:
            'The service will start automatically at boot. Add --now to also start it immediately.',
          disable: 'The service will no longer start at boot.',
        };
        if (action === 'start' || action === 'restart' || action === 'reload') {
          service.active = true;
          service.logs.push(
            action === 'reload' ? 'Reloaded configuration.' : `Started ${service.description}.`,
          );
        }
        if (action === 'stop') {
          service.active = false;
          service.logs.push(`Stopped ${service.description}.`);
        }
        let output = '';
        if (action === 'enable') {
          service.enabled = true;
          if (args.includes('--now')) service.active = true;
          output = `Created symlink /etc/systemd/system/multi-user.target.wants/${unit}.service → /lib/systemd/system/${unit}.service.`;
        }
        if (action === 'disable') {
          service.enabled = false;
          output = `Removed "/etc/systemd/system/multi-user.target.wants/${unit}.service".`;
        }
        return ok(output, notes[action]);
      }
      default:
        return fail(
          `Unknown command verb ${action}. Try: status, start, stop, restart, enable, disable.`,
        );
    }
  }

  journalctl(args: string[]): CommandResult {
    const index = args.indexOf('-u');
    const unit = (index >= 0 ? args[index + 1] : undefined)?.replace(/\.service$/, '');
    const services = unit ? [[unit, this.services.get(unit)] as const] : [...this.services];
    const rows: string[] = [];
    for (const [name, service] of services) {
      if (!service) return ok(`-- No entries --`);
      for (const line of service.logs)
        rows.push(`Nov 15 09:30:00 devguru ${name}[${service.pid}]: ${line}`);
    }
    const n = args.indexOf('-n');
    const limited = n >= 0 ? rows.slice(-Number(args[n + 1] ?? 10)) : rows;
    return ok(
      limited.join('\n') || '-- No entries --',
      args.includes('-f')
        ? 'journalctl -f keeps following new lines (Ctrl+C to stop); the simulator stops here.'
        : 'journalctl reads the systemd journal: the logs of services. -u picks one service, -f follows, -n 50 shows the last 50.',
    );
  }

  useradd(args: string[], sudo: boolean): CommandResult {
    if (!sudo)
      return this.needRoot(
        'useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.',
      );
    const name = args.filter((a) => !a.startsWith('-')).pop();
    if (!name) return fail('usage: sudo useradd -m -s /bin/bash <name>');
    if (this.users.has(name)) return fail(`useradd: user '${name}' already exists`);
    const groupIndex = args.indexOf('-G');
    const extra = groupIndex >= 0 ? (args[groupIndex + 1] ?? '').split(',') : [];
    this.users.set(name, {
      uid: 1000 + this.users.size,
      groups: [name, ...extra],
      home: `/home/${name}`,
    });
    this.groupNames.add(name);
    return ok(
      '',
      `Created user ${name}${args.includes('-m') ? ` with home folder /home/${name}` : ' (no home folder: add -m)'}. Set a password with sudo passwd ${name}.`,
    );
  }

  usermod(args: string[], sudo: boolean): CommandResult {
    if (!sudo) return this.needRoot('usermod: Permission denied.');
    const name = args[args.length - 1] ?? '';
    const user = this.users.get(name);
    if (!user) return fail(`usermod: user '${name}' does not exist`);
    const index = args.findIndex((a) => a === '-aG' || a === '-G');
    if (index < 0) return fail('usage: sudo usermod -aG <group> <user>');
    const groups = (args[index + 1] ?? '').split(',');
    for (const g of groups)
      if (!this.groupNames.has(g)) return fail(`usermod: group '${g}' does not exist`);
    user.groups =
      args[index] === '-aG' ? [...new Set([...user.groups, ...groups])] : [name, ...groups];
    return ok(
      '',
      args[index] === '-aG'
        ? `Added ${name} to ${groups.join(', ')}. The user must log out and in again for it to apply.`
        : `-G without -a REPLACED all of ${name}'s extra groups. Usually you want -aG.`,
    );
  }

  groupadd(args: string[], sudo: boolean): CommandResult {
    if (!sudo) return this.needRoot('groupadd: Permission denied.');
    const name = args[0];
    if (!name) return fail('usage: sudo groupadd <name>');
    this.groupNames.add(name);
    return ok('');
  }

  groups(args: string[], current: string): CommandResult {
    const name = args[0] ?? current;
    const user = this.users.get(name);
    if (!user) return fail(`groups: '${name}': no such user`);
    return ok(args[0] ? `${name} : ${user.groups.join(' ')}` : user.groups.join(' '));
  }

  id(args: string[], current: string): CommandResult {
    const name = args[0] ?? current;
    const user = this.users.get(name);
    if (!user) return fail(`id: '${name}': no such user`);
    const gid = (g: string) =>
      g === name ? user.uid : g === 'sudo' ? 27 : g === 'docker' ? 999 : 1100;
    return ok(
      `uid=${user.uid}(${name}) gid=${user.uid}(${name}) groups=${user.groups.map((g) => `${gid(g)}(${g})`).join(',')}`,
    );
  }

  passwdFile(): string {
    return [...this.users]
      .map(
        ([name, u]) =>
          `${name}:x:${u.uid}:${u.uid}::${u.home}:${name === 'root' ? '/bin/bash' : '/bin/bash'}`,
      )
      .join('\n');
  }

  groupFile(): string {
    return [...this.groupNames]
      .map((g) => {
        const members = [...this.users]
          .filter(([n, u]) => n !== g && u.groups.includes(g))
          .map(([n]) => n);
        return `${g}:x:${g === 'sudo' ? 27 : g === 'docker' ? 999 : 1000}:${members.join(',')}`;
      })
      .join('\n');
  }

  crontabCommand(args: string[], stdin: string | null): CommandResult {
    if (args[0] === '-l')
      return this.crontab.length
        ? ok(this.crontab.join('\n'))
        : { output: 'no crontab for guru', error: true };
    if (args[0] === '-r') {
      this.crontab = [];
      return ok('', 'Removed your whole crontab.');
    }
    if (args[0] === '-e')
      return ok(
        '(the editor would open here)',
        'crontab -e opens your crontab in an editor. In the simulator add a line with: echo "0 2 * * * /home/guru/scripts/backup.sh" | crontab -',
      );
    if (args[0] === '-' && stdin !== null) {
      const entries = stdin.split('\n').filter((l) => l.trim());
      for (const entry of entries) {
        if (entry.startsWith('#')) continue;
        const fields = entry.trim().split(/\s+/);
        const special = fields[0]?.startsWith('@');
        if (!special && fields.length < 6)
          return fail(
            `"-":1: bad minute\nerrors in crontab file, can't install.`,
            'A cron line needs 5 time fields and a command: minute hour day-of-month month day-of-week command.',
          );
      }
      this.crontab = entries;
      return ok('', `Installed ${entries.length} cron line(s). See them with crontab -l.`);
    }
    return fail('usage: crontab -l | crontab -e | crontab -r | echo "..." | crontab -');
  }

  ss(dockerPorts: number[]): CommandResult {
    const rows: [string, number, string][] = [['0.0.0.0', 22, 'sshd']];
    if (this.services.get('nginx')?.active) rows.push(['0.0.0.0', 80, 'nginx']);
    if (this.services.get('shop-api')?.active) rows.push(['0.0.0.0', 8000, 'gunicorn']);
    rows.push(['127.0.0.1', 9000, 'python3']);
    for (const port of dockerPorts) rows.push(['0.0.0.0', port, 'docker-proxy']);
    return ok(
      [
        'Netid State  Local Address:Port   Process',
        ...rows.map(
          ([addr, port, proc]) =>
            `tcp   LISTEN ${`${addr}:${port}`.padEnd(20)} users:(("${proc}"))`,
        ),
      ].join('\n'),
      'ss -tulpn lists listening ports: t=TCP u=UDP l=listening p=process n=numbers. 0.0.0.0 = open to all networks, 127.0.0.1 = this machine only.',
    );
  }

  private needRoot(
    message = 'Failed to start: Access denied. (Interactive authentication required.)',
  ): CommandResult {
    return fail(message, 'This changes the system, so it needs sudo.');
  }
}

/** du: sizes of files and folders under a path (approximate, from content length). */
export function du(args: string[], files: Record<string, string>, label: string): CommandResult {
  const human = args.some((a) => /^-\w*h/.test(a));
  const summary = args.some((a) => /^-\w*s/.test(a));
  const total = Object.values(files).reduce((sum, c) => sum + c.length + 4096, 4096);
  const format = (bytes: number) =>
    human
      ? bytes >= 1024 * 1024
        ? `${(bytes / 1048576).toFixed(1)}M`
        : `${Math.ceil(bytes / 1024)}K`
      : String(Math.ceil(bytes / 1024));
  if (summary) return ok(`${format(total)}\t${label}`);
  const dirs = new Map<string, number>();
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      dirs.set(dir, (dirs.get(dir) ?? 4096) + content.length + 4096);
    }
  }
  return ok(
    [
      ...[...dirs].map(([d, size]) => `${format(size)}\t${label === '.' ? './' : `${label}/`}${d}`),
      `${format(total)}\t${label}`,
    ].join('\n'),
  );
}
