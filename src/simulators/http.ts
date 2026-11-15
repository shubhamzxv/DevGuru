/**
 * A pretend REST API that lives in the browser, for the REST/HTTP track.
 * Base URL: https://api.devguru.dev
 *
 *   GET    /books                 list (filter ?author=, paginate ?page=&limit=)
 *   GET    /books/:id             one book (ETag; send If-None-Match to get 304)
 *   POST   /books                 create  (JSON body with title and author)
 *   PUT    /books/:id             replace (title and author required)
 *   PATCH  /books/:id             change some fields
 *   DELETE /books/:id             delete
 *   POST   /login                 {"username":"guru","password":"secret"} -> token
 *   GET    /me                    needs  Authorization: Bearer <token>
 *   GET    /admin                 logged in but not allowed -> 403
 *   GET    /limited               rate limited: the 4th call within a minute -> 429
 *   GET    /old-books             moved -> 301
 *   GET    /bug                   server crash -> 500
 *   OPTIONS any path              which methods are allowed (CORS preflight)
 */

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof METHODS)[number];

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  body: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  /** Plain words: what happened and why this status code. */
  explanation: string;
  timeMs: number;
}

export const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Reads the request text used in lesson code blocks: "METHOD /path", header lines, blank line, body. */
export function parseRequestText(text: string): HttpRequest {
  const lines = text.replace(/\r/g, '').split('\n');
  while (lines.length > 0 && (lines[0] ?? '').trim() === '') lines.shift();
  const [first = 'GET /books', ...rest] = lines;
  const [methodText = 'GET', target = '/books'] = first.trim().split(/\s+/);
  const method = (METHODS as readonly string[]).includes(methodText.toUpperCase())
    ? (methodText.toUpperCase() as HttpMethod)
    : 'GET';
  const path = target.replace(/^https?:\/\/[^/]+/, '') || '/';
  const headers: Record<string, string> = {};
  let i = 0;
  for (; i < rest.length; i++) {
    const line = rest[i] ?? '';
    if (line.trim() === '') break;
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return {
    method,
    path,
    headers,
    body: rest
      .slice(i + 1)
      .join('\n')
      .trim(),
  };
}

interface Book {
  id: number;
  title: string;
  author: string;
  year?: number;
}

const SEED_BOOKS: Book[] = [
  { id: 1, title: 'Malgudi Days', author: 'R. K. Narayan', year: 1943 },
  { id: 2, title: 'The Guide', author: 'R. K. Narayan', year: 1958 },
  { id: 3, title: 'The Blue Umbrella', author: 'Ruskin Bond', year: 1980 },
  { id: 4, title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', year: 1999 },
  { id: 5, title: 'The God of Small Things', author: 'Arundhati Roy', year: 1997 },
];

const VALID_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiZ3VydSJ9.dG9rZW4';

function header(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((h) => h.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}

function etagFor(book: Book): string {
  return `"v${book.id}-${(book.title.length * 31 + book.author.length) % 997}"`;
}

export class MockApi {
  private books: Book[] = SEED_BOOKS.map((b) => ({ ...b }));
  private nextId = 6;
  private limitedCalls = 0;
  private calls = 0;

  send(request: HttpRequest): HttpResponse {
    this.calls++;
    const url = new URL(request.path, 'https://api.devguru.dev');
    const segments = url.pathname.split('/').filter(Boolean);
    const route = segments[0] ?? '';
    const id = segments[1];
    const timeMs = 18 + ((this.calls * 37) % 60);
    const respond = (
      status: number,
      body: unknown,
      explanation: string,
      extra: Record<string, string> = {},
    ): HttpResponse => {
      const text =
        body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      const headers: Record<string, string> = {
        Date: 'Sun, 15 Nov 2026 04:00:00 GMT',
        ...(text
          ? {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': String(text.length),
            }
          : {}),
        ...extra,
      };
      return {
        status,
        statusText: STATUS_TEXT[status] ?? '',
        headers,
        body: request.method === 'HEAD' ? '' : text,
        explanation,
        timeMs,
      };
    };
    const error = (
      status: number,
      message: string,
      explanation: string,
      extra?: Record<string, string>,
    ) => respond(status, { error: STATUS_TEXT[status], detail: message }, explanation, extra);

    if (request.method === 'OPTIONS') {
      const allow =
        route === 'books'
          ? id
            ? 'GET, PUT, PATCH, DELETE, OPTIONS'
            : 'GET, POST, OPTIONS'
          : 'GET, OPTIONS';
      return respond(
        204,
        null,
        'OPTIONS asks "what may I do here?". Browsers send it first (a CORS preflight) before some cross-site requests. The Allow header lists the methods.',
        {
          Allow: allow,
          'Access-Control-Allow-Origin': 'https://devguru.dev',
          'Access-Control-Allow-Methods': allow,
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      );
    }

    const needsJson = ['POST', 'PUT', 'PATCH'].includes(request.method);
    let json: Record<string, unknown> = {};
    if (needsJson) {
      const type = header(request.headers, 'Content-Type') ?? '';
      if (request.body && !type.includes('application/json')) {
        return error(
          415,
          'Send the body as JSON with the header Content-Type: application/json',
          '415: the server cannot read this body format. Add the header Content-Type: application/json.',
        );
      }
      if (request.body) {
        try {
          const parsed: unknown = JSON.parse(request.body);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
            throw new Error('not an object');
          json = parsed as Record<string, unknown>;
        } catch {
          return error(
            400,
            'The body is not valid JSON',
            '400 Bad Request: the server could not even read the request. Check commas, quotes (JSON needs "double quotes") and brackets.',
          );
        }
      }
    }

    switch (route) {
      case 'books':
        return id === undefined
          ? this.collection(request, url, json, respond, error)
          : this.item(request, id, json, respond, error);
      case 'login': {
        if (request.method !== 'POST')
          return error(405, 'Use POST /login', '405: this URL exists but not for that method.', {
            Allow: 'POST',
          });
        if (json.username === 'guru' && json.password === 'secret') {
          return respond(
            200,
            { access_token: VALID_TOKEN, token_type: 'bearer', expires_in: 3600 },
            '200: login worked. Send the token on later requests as Authorization: Bearer <token>. The server keeps no session: the token itself proves who you are.',
          );
        }
        return error(
          401,
          'Wrong username or password',
          '401 Unauthorized: we do not know who you are. (Try username guru, password secret.)',
          { 'WWW-Authenticate': 'Bearer' },
        );
      }
      case 'me':
      case 'admin': {
        const auth = header(request.headers, 'Authorization');
        if (!auth)
          return error(
            401,
            'Not authenticated',
            '401: no Authorization header, so the server does not know who you are. POST /login first and send the token.',
            { 'WWW-Authenticate': 'Bearer' },
          );
        if (auth !== `Bearer ${VALID_TOKEN}`)
          return error(
            401,
            'Invalid or expired token',
            '401: the token is wrong or expired. Log in again for a new one.',
            { 'WWW-Authenticate': 'Bearer error="invalid_token"' },
          );
        if (route === 'admin')
          return error(
            403,
            'Admins only',
            '403 Forbidden: the server knows who you are (the token is valid) but you are not allowed. 401 = who are you? 403 = I know you, and no.',
          );
        return respond(
          200,
          { username: 'guru', name: 'Guru', role: 'learner' },
          '200: the token was valid, so the server returned your profile.',
        );
      }
      case 'limited': {
        this.limitedCalls++;
        const remaining = Math.max(0, 3 - this.limitedCalls);
        if (this.limitedCalls > 3) {
          return error(
            429,
            'Rate limit exceeded: 3 requests per minute',
            '429 Too Many Requests: you sent more than the allowed number of requests. Wait for Retry-After seconds. APIs do this to protect themselves.',
            { 'Retry-After': '60', 'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': '0' },
          );
        }
        return respond(
          200,
          { ok: true },
          `200, but look at the X-RateLimit headers: only ${remaining} calls left this minute. Send this request again a few times.`,
          { 'X-RateLimit-Limit': '3', 'X-RateLimit-Remaining': String(remaining) },
        );
      }
      case 'old-books':
        return respond(
          301,
          null,
          '301: the resource moved for good. The Location header says where; browsers and curl -L follow it automatically.',
          { Location: '/books' },
        );
      case 'bug':
        return error(
          500,
          'Something went wrong on our side',
          '500: the server crashed while handling the request. It is the server’s fault, not yours; the client cannot fix it by changing the request.',
        );
      case '':
        return respond(
          200,
          {
            message: 'Welcome to the DevGuru demo API',
            endpoints: [
              '/books',
              '/books/{id}',
              '/login',
              '/me',
              '/admin',
              '/limited',
              '/old-books',
              '/bug',
            ],
          },
          '200: the root of the API lists what it offers.',
        );
      default:
        return error(
          404,
          `No resource at ${url.pathname}`,
          '404 Not Found: no resource lives at this URL. Check the spelling (try /books).',
        );
    }
  }

  private collection(
    request: HttpRequest,
    url: URL,
    json: Record<string, unknown>,
    respond: (s: number, b: unknown, e: string, h?: Record<string, string>) => HttpResponse,
    error: (s: number, m: string, e: string, h?: Record<string, string>) => HttpResponse,
  ): HttpResponse {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const author = url.searchParams.get('author');
      let list = author
        ? this.books.filter((b) => b.author.toLowerCase().includes(author.toLowerCase()))
        : this.books;
      const limit = Number(url.searchParams.get('limit') ?? 0);
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
      const total = list.length;
      if (limit > 0) list = list.slice((page - 1) * limit, page * limit);
      const notes = [
        author ? `?author= filtered the list (query parameters filter or sort a collection).` : '',
        limit > 0
          ? `?page=${page}&limit=${limit} returned one page. X-Total-Count says how many exist.`
          : '',
      ].filter(Boolean);
      return respond(
        200,
        list,
        `200 OK: GET read the collection without changing anything (safe and idempotent). ${notes.join(' ')}`.trim(),
        { 'X-Total-Count': String(total), 'Cache-Control': 'max-age=60' },
      );
    }
    if (request.method === 'POST') {
      const problems = this.validate(json, ['title', 'author']);
      if (problems.length > 0)
        return respond(
          422,
          { error: 'Validation failed', detail: problems },
          '422: the JSON was readable but the data is wrong (a required field is missing or has the wrong type). The detail says which field.',
        );
      const book: Book = {
        id: this.nextId++,
        title: String(json.title),
        author: String(json.author),
        ...(typeof json.year === 'number' ? { year: json.year } : {}),
      };
      this.books.push(book);
      return respond(
        201,
        book,
        '201 Created: POST made a new book. The server chose the id, and the Location header is the URL of the new resource. Sending the same POST again creates ANOTHER book (POST is not idempotent).',
        { Location: `/books/${book.id}` },
      );
    }
    return error(
      405,
      `${request.method} is not allowed on /books`,
      `405: /books exists, but not for ${request.method}. To change or delete one book use its URL, such as /books/1.`,
      { Allow: 'GET, POST, OPTIONS' },
    );
  }

  private item(
    request: HttpRequest,
    idText: string,
    json: Record<string, unknown>,
    respond: (s: number, b: unknown, e: string, h?: Record<string, string>) => HttpResponse,
    error: (s: number, m: string, e: string, h?: Record<string, string>) => HttpResponse,
  ): HttpResponse {
    const id = Number(idText);
    const index = this.books.findIndex((b) => b.id === id);
    const book = this.books[index];
    if (!book)
      return error(
        404,
        `Book ${idText} not found`,
        `404: there is no book with id ${idText}${request.method === 'DELETE' ? ' (maybe it was already deleted)' : ''}.`,
      );

    switch (request.method) {
      case 'GET':
      case 'HEAD': {
        const etag = etagFor(book);
        if (header(request.headers, 'If-None-Match') === etag) {
          return respond(
            304,
            null,
            '304 Not Modified: your copy (the ETag you sent) is still current, so the server sent no body. This saves bandwidth.',
            { ETag: etag },
          );
        }
        return respond(
          200,
          book,
          `200 OK. The ETag header is a version stamp: send it back as If-None-Match: ${etag} and you get 304 while nothing changed.`,
          { ETag: etag, 'Cache-Control': 'max-age=60' },
        );
      }
      case 'PUT': {
        const problems = this.validate(json, ['title', 'author']);
        if (problems.length > 0)
          return respond(
            422,
            { error: 'Validation failed', detail: problems },
            '422: PUT replaces the WHOLE resource, so every required field must be sent. For a partial change use PATCH.',
          );
        const updated: Book = {
          id,
          title: String(json.title),
          author: String(json.author),
          ...(typeof json.year === 'number' ? { year: json.year } : {}),
        };
        this.books[index] = updated;
        return respond(
          200,
          updated,
          '200: PUT replaced the book with exactly what you sent (fields you left out are gone). Sending it again gives the same result: PUT is idempotent.',
        );
      }
      case 'PATCH': {
        if (Object.keys(json).length === 0)
          return error(
            400,
            'Send at least one field to change',
            '400: PATCH needs a body with the fields to change.',
          );
        if ('id' in json)
          return error(
            400,
            'The id cannot be changed',
            '400: the id is chosen by the server and never changes.',
          );
        const changed = { ...book, ...json } as Book;
        this.books[index] = changed;
        return respond(
          200,
          changed,
          '200: PATCH changed only the fields you sent and kept the rest.',
        );
      }
      case 'DELETE':
        this.books.splice(index, 1);
        return respond(
          204,
          null,
          '204 No Content: deleted, and there is nothing to send back. Run it again and you get 404, but the state is the same (DELETE is idempotent).',
        );
      default:
        return error(
          405,
          `${request.method} is not allowed here`,
          '405: this URL does not support that method.',
          { Allow: 'GET, PUT, PATCH, DELETE, OPTIONS' },
        );
    }
  }

  private validate(
    json: Record<string, unknown>,
    required: string[],
  ): { field: string; problem: string }[] {
    const problems: { field: string; problem: string }[] = [];
    for (const field of required) {
      const value = json[field];
      if (value === undefined || value === null || value === '')
        problems.push({ field, problem: 'field required' });
      else if (typeof value !== 'string') problems.push({ field, problem: 'must be a string' });
    }
    if (json.year !== undefined && typeof json.year !== 'number')
      problems.push({ field: 'year', problem: 'must be a number' });
    return problems;
  }
}

/** The same request as a curl command, so learners can see the terminal version. */
export function toCurl(request: HttpRequest): string {
  const parts = [`curl -i -X ${request.method} "https://api.devguru.dev${request.path}"`];
  for (const [key, value] of Object.entries(request.headers)) parts.push(`  -H "${key}: ${value}"`);
  if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method))
    parts.push(`  -d '${request.body.replace(/\s*\n\s*/g, ' ')}'`);
  return parts.join(' \\\n');
}
