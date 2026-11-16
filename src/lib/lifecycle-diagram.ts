// Drawing of a lifecycle model as SVG markup: phases in order, repeated phases
// with a circular arrow, and feedback loops as numbered arcs back to earlier
// phases. It is drawn twice, left to right for wide screens and top to bottom
// for narrow ones, and the stylesheet shows the one that fits. Used by
// LifecycleDiagram.astro at build time and by the tailoring page in the browser,
// so it must not import anything that only runs on the server.
import type { Translate } from './client-strings';
import { escapeHtml as esc } from './text';

export interface DiagramProcess {
  id: string;
  name: string;
  origin: string;
  /** Plain text. */
  purpose: string;
}

export interface DiagramPhase {
  id: string;
  name: string;
  /** Plain text. */
  description?: string;
  iterative?: boolean;
  returnsTo?: string;
  returnNote?: string;
  procs: DiagramProcess[];
}

export interface DiagramInput {
  name: string;
  version: string;
  phases: DiagramPhase[];
  procHref: (id: string) => string;
}

export type { Translate };

/** The interface strings the drawing uses, for a page that draws it in the browser. */
export const diagramKeys = [
  'lc.diagram',
  'lc.diagramDesc',
  'lc.legendRepeated',
  'lc.legendLoop',
  'lc.tipProcesses',
  'lc.tipReturns',
  'lc.tipReceives',
  'origin.standards-and-literature',
  'origin.standards-only',
  'origin.decomposed',
];

export interface Loop {
  from: number;
  to: number;
  note: string | undefined;
  label: string;
}

/** Feedback loops, numbered in order of appearance. A loop to the same phase is drawn as a repetition instead. */
export function lifecycleLoops(phases: Pick<DiagramPhase, 'id' | 'returnsTo' | 'returnNote'>[]): Loop[] {
  const index = new Map(phases.map((p, i) => [p.id, i]));
  return phases
    .map((ph, i) => ({ from: i, to: ph.returnsTo ? index.get(ph.returnsTo) : undefined, note: ph.returnNote }))
    .filter((x): x is { from: number; to: number; note: string | undefined } => x.to !== undefined && x.to !== x.from)
    .map((x, k) => ({ ...x, label: `L${k + 1}` }));
}

/** Greedy word wrap by character count; SVG text does not wrap by itself. */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const TAG_W = 38;
const TAG_H = 18;
const TAG_GAP = 5;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string[];
  tags: (DiagramProcess & { x: number; y: number })[];
}

interface Arc extends Loop {
  d: string;
  lx: number;
  ly: number;
}

interface Layout {
  boxes: Box[];
  arcs: Arc[];
  width: number;
  height: number;
}

export function diagramSvgs(input: DiagramInput, t: Translate): string {
  const { phases: raw } = input;
  const phases = raw.map((ph, i) => ({ ...ph, n: String(i + 1).padStart(2, '0') }));
  const loops = lifecycleLoops(raw);
  // Loops that leave or reach the same phase get their own attachment point,
  // spread around the middle of the box, so their arrowheads do not overlap.
  const spread = (k: number, key: 'from' | 'to') => {
    const same = loops.filter((x) => x[key] === loops[k][key]);
    return same.indexOf(loops[k]) - (same.length - 1) / 2;
  };
  const repeated = (i: number) => raw[i].iterative || raw[i].returnsTo === raw[i].id;

  // --- Left to right -------------------------------------------------------

  const H: Layout = (() => {
    const W = 160;
    const GAP = 46;
    const TOP = 40;
    const LEFT = 8;
    const perRow = Math.floor((W - 16 + TAG_GAP) / (TAG_W + TAG_GAP));
    const names = phases.map((p) => wrap(p.name, 19));
    const nameLines = Math.max(1, ...names.map((n) => n.length));
    const tagRows = Math.max(1, ...phases.map((p) => Math.ceil(p.procs.length / perRow)));
    const boxH = 36 + nameLines * 17 + 8 + tagRows * (TAG_H + TAG_GAP) + 6;
    const boxes = phases.map((p, i) => ({
      x: LEFT + i * (W + GAP),
      y: TOP,
      w: W,
      h: boxH,
      name: names[i],
      tags: p.procs.map((proc, k) => ({
        ...proc,
        x: LEFT + i * (W + GAP) + 8 + (k % perRow) * (TAG_W + TAG_GAP),
        y: TOP + 36 + nameLines * 17 + 8 + Math.floor(k / perRow) * (TAG_H + TAG_GAP),
      })),
    }));
    const bottom = TOP + boxH;
    const arcs = loops.map((loop, k) => {
      const a = boxes[loop.from];
      const b = boxes[loop.to];
      const sx = a.x + a.w / 2 + spread(k, 'from') * 20;
      const tx = b.x + b.w / 2 + spread(k, 'to') * 20;
      const depth = 46 + k * 30;
      return {
        ...loop,
        d: `M${sx} ${bottom} C${sx} ${bottom + depth}, ${tx} ${bottom + depth}, ${tx} ${bottom + 3}`,
        lx: (sx + tx) / 2,
        ly: bottom + depth * 0.75,
      };
    });
    const width = LEFT * 2 + phases.length * W + (phases.length - 1) * GAP;
    const height = bottom + (loops.length ? 46 + (loops.length - 1) * 30 + 20 : 16);
    return { boxes, arcs, width, height };
  })();

  // --- Top to bottom -------------------------------------------------------

  const V: Layout = (() => {
    const LEFT = 44;
    const W = 232;
    const GAP = 40;
    const perRow = Math.floor((W - 16 + TAG_GAP) / (TAG_W + TAG_GAP));
    let y = 8;
    const boxes = phases.map((p) => {
      const name = wrap(p.name, 26);
      const rows = Math.max(1, Math.ceil(p.procs.length / perRow));
      const h = 36 + name.length * 17 + 8 + rows * (TAG_H + TAG_GAP) + 6;
      const box = {
        x: LEFT,
        y,
        w: W,
        h,
        name,
        tags: p.procs.map((proc, k) => ({
          ...proc,
          x: LEFT + 8 + (k % perRow) * (TAG_W + TAG_GAP),
          y: y + 36 + name.length * 17 + 8 + Math.floor(k / perRow) * (TAG_H + TAG_GAP),
        })),
      };
      y += h + GAP;
      return box;
    });
    const right = LEFT + W;
    const arcs = loops.map((loop, k) => {
      const a = boxes[loop.from];
      const b = boxes[loop.to];
      const sy = a.y + a.h / 2 + spread(k, 'from') * 14;
      const ty = b.y + b.h / 2 + spread(k, 'to') * 14;
      const x = right + 22 + k * 22;
      return { ...loop, d: `M${right} ${sy} H${x} V${ty} H${right + 3}`, lx: x, ly: (sy + ty) / 2 };
    });
    const width = right + 22 + Math.max(loops.length, 1) * 22 + 20;
    return { boxes, arcs, width, height: y - GAP + 8 };
  })();

  // --- Hover information: a title and a body of plain text per element ---

  const attr = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => ` ${k}="${esc(v)}"`)
      .join('');
  const snippet = (text: string, max = 190) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`);
  const tipTag = (proc: DiagramProcess) =>
    attr({ 'data-tip-title': `${proc.id} · ${proc.name}`, 'data-tip-meta': t(`origin.${proc.origin}`), 'data-tip-body': snippet(proc.purpose) });
  const tipPhase = (i: number) => {
    const ph = phases[i];
    const lines = [
      t('lc.tipProcesses', { n: ph.procs.length }),
      ...(repeated(i) ? [t('lc.legendRepeated')] : []),
      ...loops.filter((x) => x.from === i).map((x) => t('lc.tipReturns', { loop: x.label, phase: phases[x.to].name })),
      ...loops.filter((x) => x.to === i).map((x) => t('lc.tipReceives', { loop: x.label, phase: phases[x.from].name })),
    ];
    return attr({ 'data-tip-title': `${ph.n} · ${ph.name}`, 'data-tip-body': [ph.description, ...lines].filter(Boolean).join('\n') });
  };
  const tipLoop = (loop: Loop) =>
    attr({ 'data-tip-title': `${loop.label} · ${phases[loop.from].name} → ${phases[loop.to].name}`, 'data-tip-meta': t('lc.legendLoop'), 'data-tip-body': loop.note ?? '' });
  const tipRepeat = (i: number) => attr({ 'data-tip-title': `↻ ${phases[i].name}`, 'data-tip-body': t('lc.legendRepeated') });

  const desc = t('lc.diagramDesc', { phases: phases.map((p) => p.name).join(', ') });

  const svg = (key: string, g: Layout, horizontal: boolean) => {
    const head = `url(#head-${key})`;
    const wires = g.boxes
      .slice(1)
      .map((b, i) => {
        const a = g.boxes[i];
        return horizontal
          ? `<line class="wire" x1="${a.x + a.w}" y1="${a.y + 24}" x2="${b.x - 2}" y2="${b.y + 24}" marker-end="${head}"/>`
          : `<line class="wire" x1="${a.x + 40}" y1="${a.y + a.h}" x2="${b.x + 40}" y2="${b.y - 2}" marker-end="${head}"/>`;
      })
      .join('');
    const arcs = g.arcs
      .map(
        (arc) => `<g class="loop" data-from="${arc.from}" data-to="${arc.to}"${tipLoop(arc)}>
          <path class="hit" d="${arc.d}"/>
          <path class="wire loop-wire" d="${arc.d}" marker-end="${head}"/>
          <rect class="loop-label-bg" x="${arc.lx - 13}" y="${arc.ly - 9}" width="26" height="18"/>
          <text class="loop-label" x="${arc.lx}" y="${arc.ly + 4}" text-anchor="middle">${arc.label}</text>
        </g>`,
      )
      .join('');
    const boxes = g.boxes
      .map((b, i) => {
        let repeat = '';
        if (repeated(i)) {
          const d = horizontal
            ? `M${b.x + b.w * 0.66} ${b.y} C${b.x + b.w * 0.66} ${b.y - 34}, ${b.x + b.w * 0.34} ${b.y - 34}, ${b.x + b.w * 0.34} ${b.y - 3}`
            : `M${b.x} ${b.y + b.h * 0.3} C${b.x - 34} ${b.y + b.h * 0.3}, ${b.x - 34} ${b.y + b.h * 0.7}, ${b.x - 3} ${b.y + b.h * 0.7}`;
          repeat = `<g class="repeat"${tipRepeat(i)}><path class="hit" d="${d}"/><path class="wire" d="${d}" marker-end="${head}"/></g>`;
        }
        const name = b.name.map((line, k) => `<text class="name" x="${b.x + 8}" y="${b.y + 44 + k * 17}">${esc(line)}</text>`).join('');
        const tags = b.tags
          .map(
            (tag) => `<a href="${esc(input.procHref(tag.id))}" class="tag origin-${esc(tag.origin)}" data-process="${esc(tag.id)}" data-version="${esc(input.version)}"${attr({ 'data-name': tag.name, 'aria-label': `${tag.id} ${tag.name}` })}${tipTag(tag)}>
              <rect x="${tag.x}" y="${tag.y}" width="${TAG_W}" height="${TAG_H}"/>
              <text x="${tag.x + TAG_W / 2}" y="${tag.y + 13}" text-anchor="middle">${esc(tag.id)}</text>
            </a>`,
          )
          .join('');
        return `<g class="phase" data-phase="${i}"${tipPhase(i)}>
          ${repeat}
          <rect class="box" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>
          <rect class="step" x="${b.x + 8}" y="${b.y + 8}" width="24" height="16"/>
          <text class="step-text" x="${b.x + 20}" y="${b.y + 20}" text-anchor="middle">${phases[i].n}</text>
          ${name}${tags}
        </g>`;
      })
      .join('');
    return `<svg class="diagram diagram-${key}" viewBox="0 0 ${g.width} ${g.height}" data-size="${g.width} ${g.height}" role="img" aria-labelledby="lc-title-${key} lc-desc-${key}">
      <title id="lc-title-${key}">${esc(t('lc.diagram', { name: input.name }))}</title>
      <desc id="lc-desc-${key}">${esc(desc)}</desc>
      <defs>
        <marker id="head-${key}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" class="head"/>
        </marker>
      </defs>
      ${wires}${arcs}${boxes}
    </svg>`;
  };

  return svg('h', H, true) + svg('v', V, false);
}
