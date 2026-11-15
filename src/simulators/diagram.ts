/**
 * Architecture diagrams for the AWS and System Design tracks are written as a
 * small JSON block inside <Playground kind="diagram">, so content stays in MDX:
 *
 * {
 *   "nodes": [
 *     { "id": "user", "label": "User", "icon": "👤", "col": 0, "row": 1,
 *       "info": "What it is, in one or two sentences.", "example": "Optional real use case." }
 *   ],
 *   "edges": [["user", "cdn"], ["cdn", "s3", "static files"]],
 *   "flows": [
 *     { "name": "Open the website", "steps": [["user", "Types the address"], ["cdn", "Serves the page"]] }
 *   ]
 * }
 *
 * col / row place a node on a grid (0 = first column / row).
 */

export interface DiagramNode {
  id: string;
  label: string;
  icon?: string;
  col: number;
  row: number;
  info: string;
  example?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramFlow {
  name: string;
  steps: { node: string; text: string }[];
}

export interface Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  flows: DiagramFlow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns the diagram, or a plain-language error message for the content writer. */
export function parseDiagram(text: string): Diagram | string {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return `The diagram JSON is not valid: ${(error as Error).message}`;
  }
  if (!isRecord(raw) || !Array.isArray(raw.nodes)) return 'The diagram needs a "nodes" list.';

  const nodes: DiagramNode[] = [];
  for (const item of raw.nodes) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.label !== 'string') {
      return 'Every node needs an "id" and a "label".';
    }
    if (typeof item.col !== 'number' || typeof item.row !== 'number')
      return `Node "${item.id}" needs numbers "col" and "row".`;
    nodes.push({
      id: item.id,
      label: item.label,
      icon: typeof item.icon === 'string' ? item.icon : undefined,
      col: item.col,
      row: item.row,
      info: typeof item.info === 'string' ? item.info : '',
      example: typeof item.example === 'string' ? item.example : undefined,
    });
  }
  const ids = new Set(nodes.map((n) => n.id));

  const edges: DiagramEdge[] = [];
  for (const item of Array.isArray(raw.edges) ? raw.edges : []) {
    if (!Array.isArray(item) || typeof item[0] !== 'string' || typeof item[1] !== 'string')
      return 'Every edge is ["from", "to"] or ["from", "to", "label"].';
    const [from, to, label] = item as [string, string, unknown];
    if (!ids.has(from) || !ids.has(to))
      return `Edge ${from} -> ${to} uses a node id that does not exist.`;
    edges.push({ from, to, label: typeof label === 'string' ? label : undefined });
  }

  const flows: DiagramFlow[] = [];
  for (const item of Array.isArray(raw.flows) ? raw.flows : []) {
    if (!isRecord(item) || typeof item.name !== 'string' || !Array.isArray(item.steps))
      return 'Every flow needs a "name" and "steps".';
    const steps: { node: string; text: string }[] = [];
    for (const step of item.steps) {
      if (!Array.isArray(step) || typeof step[0] !== 'string' || !ids.has(step[0]))
        return `Flow "${item.name}" has a step with an unknown node.`;
      steps.push({ node: step[0], text: typeof step[1] === 'string' ? step[1] : '' });
    }
    flows.push({ name: item.name, steps });
  }
  return { nodes, edges, flows };
}
