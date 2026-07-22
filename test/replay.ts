// Turns a JSON fixture dumped by the plugin back into something the exporter
// can walk, and stubs the handful of Figma calls it makes. Import this before
// anything from src/, so the figma global exists when those modules load.
//
// Usage:
//   const { frames } = await loadFixture("fixtures/services-page.json");
//   const out = await generate(frames[0], { semantic: true, tailwind: false });

import { MIXED_MARKER } from "../src/fixture";

const MIXED = Symbol("figma.mixed");

// Assets are not in a fixture, so exportAsync returns a stand-in sized like the
// node it came from. The size matters: Figma's real SVG carries width and height,
// and a stand-in without them falls back to the replaced-element default of
// 300x150. A hug-sized icon button then measured 300px and looked like a layout
// bug that was not there.
const svgStub = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, Math.round(w))}" ` +
  `height="${Math.max(1, Math.round(h))}" viewBox="0 0 ${Math.max(1, Math.round(w))} ${Math.max(1, Math.round(h))}"></svg>`;

// Installed on import: every suite reaches this through test/fakes.ts.
function installFigmaStub(): void {
  (globalThis as unknown as { figma: unknown }).figma = {
    mixed: MIXED,
    base64Encode: () => "STUB",
    // Image paints resolve through this. A fixture carries the hash but not the
    // bytes, so any hash yields the same stub: enough to prove the layer is
    // emitted with the right sizing, opacity and blend mode.
    getImageByHash: (hash: string) =>
      hash
        ? {
            getBytesAsync: async () => new Uint8Array([0, 0, 0]),
            getSizeAsync: async () => ({ width: 32, height: 32 }),
          }
        : null,
  };
}
installFigmaStub();

type Json = unknown;

function revive(value: Json): unknown {
  if (value === MIXED_MARKER) return MIXED;
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, Json>)) {
      out[k] = revive(v);
    }
    return out;
  }
  return value;
}

interface RawNode {
  [key: string]: unknown;
  type?: string;
  children?: RawNode[];
  segments?: unknown[];
}

// A fixture node is plain data plus the two methods the exporter calls on it.
function hydrate(raw: RawNode): SceneNode {
  const node = revive(raw) as RawNode;
  const kids = (node.children ?? []) as RawNode[];
  const segments = (node.segments ?? []) as unknown[];
  delete node.segments;

  const built: Record<string, unknown> = { ...node };
  if (node.children) built.children = kids.map(hydrate);

  const w = typeof node.width === "number" ? node.width : 1;
  const h = typeof node.height === "number" ? node.height : 1;
  built.exportAsync = async (opts?: { format?: string }) =>
    opts?.format === "SVG_STRING" ? svgStub(w, h) : new Uint8Array([0, 0, 0]);
  if (node.type === "TEXT") built.getStyledTextSegments = () => segments;

  return built as unknown as SceneNode;
}

export interface Fixture {
  version: number;
  pluginApi: string;
  frames: SceneNode[];
}

export async function loadFixture(path: string): Promise<Fixture> {
  const raw = JSON.parse(await Bun.file(path).text()) as {
    version: number;
    pluginApi?: string;
    frames: RawNode[];
  };
  return {
    version: raw.version,
    pluginApi: raw.pluginApi ?? "unknown",
    frames: raw.frames.map(hydrate),
  };
}

// Same thing from an in-memory object, for tests that build a tree by hand.
export function hydrateFrames(frames: RawNode[]): SceneNode[] {
  return frames.map(hydrate);
}
