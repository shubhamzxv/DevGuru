/** One recorded moment: the line that is about to run and the variables so far. */
export interface TraceStep {
  line: number;
  /** "main program" or a function name such as "square()". */
  scope: string;
  vars: Record<string, string>;
  /** Everything printed before this line. */
  out: string;
}

export interface TraceResult {
  steps: TraceStep[];
  error: { message: string; line: number | null } | null;
  /** True when the code was stopped because it had too many steps. */
  truncated: boolean;
  output: string;
  /** Variables of the main program after the last line. */
  final: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) out[key] = String(item);
  }
  return out;
}

/** Turns the JSON text sent by the Python tracer into a checked TraceResult. */
export function parseTrace(json: string): TraceResult | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw) || !Array.isArray(raw.steps)) return null;

  const steps: TraceStep[] = [];
  for (const item of raw.steps as unknown[]) {
    if (!isRecord(item) || typeof item.line !== 'number') return null;
    steps.push({
      line: item.line,
      scope: typeof item.scope === 'string' ? item.scope : 'main program',
      vars: stringMap(item.vars),
      out: typeof item.out === 'string' ? item.out : '',
    });
  }

  const error =
    isRecord(raw.error) && typeof raw.error.message === 'string'
      ? {
          message: raw.error.message,
          line: typeof raw.error.line === 'number' ? raw.error.line : null,
        }
      : null;

  return {
    steps,
    error,
    truncated: raw.truncated === true,
    output: typeof raw.output === 'string' ? raw.output : '',
    final: stringMap(raw.final),
  };
}
