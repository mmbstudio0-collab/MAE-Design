import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
}

const PORT = Number(process.env.PORT || 3000);
const EARTH_RADIUS_M = 6378137;

interface AnalyzedBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  heightMeters?: number;
  kind?: string;
}

export interface MeterRectBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  heightMeters?: number;
  kind?: string;
}

interface SectorAnalysisResponse {
  ok: boolean;
  cached?: boolean;
  zoom: number;
  spanMeters: number;
  metersPerPixel: number;
  buildings: AnalyzedBox[];
  trees: AnalyzedBox[];
  narrowShadows: AnalyzedBox[];
  barriers: AnalyzedBox[];
  meterBoxes: {
    buildings: MeterRectBox[];
    trees: MeterRectBox[];
    narrowShadows: MeterRectBox[];
    barriers: MeterRectBox[];
  };
}

const analysisCache = new Map<string, SectorAnalysisResponse>();

function metersToLatLng(
  originLat: number,
  originLng: number,
  dxM: number,
  dyM: number
): { lat: number; lng: number } {
  const cosOrigin = Math.max(0.15, Math.cos((originLat * Math.PI) / 180));
  const lng = originLng + ((dxM / (EARTH_RADIUS_M * cosOrigin)) * 180) / Math.PI;
  const originRad = Math.max(-85, Math.min(85, originLat)) * (Math.PI / 180);
  const originMerc = Math.log(Math.tan(Math.PI / 4 + originRad / 2));
  const targetMerc = originMerc - dyM / (EARTH_RADIUS_M * cosOrigin);
  const latRad = 2 * Math.atan(Math.exp(targetMerc)) - Math.PI / 2;
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

function computeTileZoomForSpan(lat: number, desiredSpanMeters: number): {
  zoom: number;
  metersPerPixel: number;
  spanMeters: number;
} {
  const cosLat = Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const desiredMpp = Math.max(0.25, desiredSpanMeters) / 640;
  const rawZoom = Math.log2((2 * Math.PI * EARTH_RADIUS_M * cosLat) / (256 * desiredMpp));
  const zoom = Math.max(16, Math.min(18, Math.round(rawZoom)));
  const metersPerPixel = (2 * Math.PI * EARTH_RADIUS_M * cosLat) / (256 * Math.pow(2, zoom));
  const spanMeters = 640 * metersPerPixel;
  return { zoom, metersPerPixel, spanMeters };
}

function sanitizeBoxes(raw: unknown, maxItems = 180): AnalyzedBox[] {
  if (!Array.isArray(raw)) return [];
  const out: AnalyzedBox[] = [];
  for (let i = 0; i < raw.length && out.length < maxItems; i++) {
    const item = raw[i] as Record<string, unknown>;
    if (!item || typeof item !== 'object') continue;
    const ymin = Number(item.ymin);
    const xmin = Number(item.xmin);
    const ymax = Number(item.ymax);
    const xmax = Number(item.xmax);
    if (![ymin, xmin, ymax, xmax].every(Number.isFinite)) continue;
    const ny0 = Math.max(0, Math.min(1000, Math.min(ymin, ymax)));
    const nx0 = Math.max(0, Math.min(1000, Math.min(xmin, xmax)));
    const ny1 = Math.max(0, Math.min(1000, Math.max(ymin, ymax)));
    const nx1 = Math.max(0, Math.min(1000, Math.max(xmin, xmax)));
    if (nx1 - nx0 < 4 || ny1 - ny0 < 4) continue;
    const heightRaw = Number(item.heightMeters);
    out.push({
      ymin: ny0,
      xmin: nx0,
      ymax: ny1,
      xmax: nx1,
      heightMeters: Number.isFinite(heightRaw) ? Math.max(2, Math.min(45, heightRaw)) : undefined,
      kind: typeof item.kind === 'string' ? item.kind : undefined,
    });
  }
  return out;
}

function deduplicateMeterBoxes(boxes: MeterRectBox[], overlapThreshold = 0.42): MeterRectBox[] {
  const out: MeterRectBox[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    const areaA = Math.max(0.5, (a.maxX - a.minX) * (a.maxY - a.minY));
    let merged = false;
    for (let j = 0; j < out.length; j++) {
      const b = out[j];
      const ix0 = Math.max(a.minX, b.minX);
      const iy0 = Math.max(a.minY, b.minY);
      const ix1 = Math.min(a.maxX, b.maxX);
      const iy1 = Math.min(a.maxY, b.maxY);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      const inter = (ix1 - ix0) * (iy1 - iy0);
      const areaB = Math.max(0.5, (b.maxX - b.minX) * (b.maxY - b.minY));
      if (inter / Math.min(areaA, areaB) >= overlapThreshold) {
        merged = true;
        break;
      }
    }
    if (!merged) out.push(a);
  }
  return out;
}

const SECTOR_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    buildings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ymin: { type: Type.INTEGER },
          xmin: { type: Type.INTEGER },
          ymax: { type: Type.INTEGER },
          xmax: { type: Type.INTEGER },
          heightMeters: { type: Type.NUMBER },
          kind: { type: Type.STRING },
        },
        required: ['ymin', 'xmin', 'ymax', 'xmax'],
      },
    },
    trees: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ymin: { type: Type.INTEGER },
          xmin: { type: Type.INTEGER },
          ymax: { type: Type.INTEGER },
          xmax: { type: Type.INTEGER },
        },
        required: ['ymin', 'xmin', 'ymax', 'xmax'],
      },
    },
    narrowShadows: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ymin: { type: Type.INTEGER },
          xmin: { type: Type.INTEGER },
          ymax: { type: Type.INTEGER },
          xmax: { type: Type.INTEGER },
        },
        required: ['ymin', 'xmin', 'ymax', 'xmax'],
      },
    },
    barriers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ymin: { type: Type.INTEGER },
          xmin: { type: Type.INTEGER },
          ymax: { type: Type.INTEGER },
          xmax: { type: Type.INTEGER },
        },
        required: ['ymin', 'xmin', 'ymax', 'xmax'],
      },
    },
  },
  required: ['buildings', 'trees', 'narrowShadows', 'barriers'],
};

async function analyzeSingleTile(
  ai: GoogleGenAI,
  mapsKey: string,
  originLat: number,
  originLng: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
  halfSizeMeters: number
): Promise<{
  spanMeters: number;
  metersPerPixel: number;
  rawBuildings: AnalyzedBox[];
  rawTrees: AnalyzedBox[];
  rawShadows: AnalyzedBox[];
  rawBarriers: AnalyzedBox[];
  buildings: MeterRectBox[];
  trees: MeterRectBox[];
  narrowShadows: MeterRectBox[];
  barriers: MeterRectBox[];
}> {
  const tileCenter = metersToLatLng(originLat, originLng, offsetX, offsetY);
  const cosLat = Math.max(0.15, Math.cos((tileCenter.lat * Math.PI) / 180));
  const metersPerPixel = (2 * Math.PI * EARTH_RADIUS_M * cosLat) / (256 * Math.pow(2, zoom));
  const spanMeters = 640 * metersPerPixel;

  const staticMapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${tileCenter.lat.toFixed(6)},${tileCenter.lng.toFixed(6)}` +
    `&zoom=${zoom}&size=640x640&scale=2&maptype=satellite&key=${encodeURIComponent(mapsKey)}`;

  const imgResp = await fetch(staticMapUrl);
  if (!imgResp.ok) {
    const errText = await imgResp.text().catch(() => '');
    throw new Error(`Google Static Maps HTTP ${imgResp.status}: ${errText.slice(0, 180)}`);
  }

  const mimeType = imgResp.headers.get('content-type')?.split(';')[0] || 'image/png';
  const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
  const base64Img = imgBuffer.toString('base64');

  const prompt = [
    'Perform an exhaustive overhead satellite inspection of this high-resolution tile for tactical 2D collision masking and visual occlusion.',
    'All coordinates MUST use normalized [0..1000] image box coordinates [ymin, xmin, ymax, xmax] where 0 is top/left and 1000 is bottom/right.',
    '1. buildings: Detect EVERY visible man-made structure and roof — including small residential houses, single-wide/double-wide mobile homes & trailers, metal garages, sheds, barns, outbuildings, modular containers, and roofs near image edges or partially under trees. Wrap ONLY the roof footprint tightly (never open yards or roads). Estimate heightMeters (e.g., 4.2 house/trailer, 3.0 shed, 8+ multi-story).',
    '2. trees: Detect EVERY dense tree canopy or tree clump where a pedestrian standing underneath would be visually hidden from top-down view.',
    '3. narrowShadows: Dark cast shadow strips adjacent to building walls/trees or tight dark alleys where units would be obscured.',
    '4. barriers: Solid compound walls, high fences, or storage container rows blocking foot movement (never open streets, dirt tracks, or parking lots).',
    'CRITICAL: Do NOT omit small rectangular mobile homes, trailers, or houses anywhere in the tile.',
  ].join('\n');

  const promptPayload = [
    {
      inlineData: {
        mimeType,
        data: base64Img,
      },
    },
    prompt,
  ];
  const reqConfig = {
    responseMimeType: 'application/json',
    responseSchema: SECTOR_ANALYSIS_SCHEMA,
  };

  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let lastErr: unknown = null;
  const candidateModels = ['gemini-4-hydrogen', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  for (let attempt = 0; attempt < candidateModels.length; attempt++) {
    const modelName = candidateModels[attempt];
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: promptPayload,
        config: reqConfig,
      });
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (!isTransient && attempt === 0) throw err;
      await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
    }
  }
  if (!response) {
    throw lastErr instanceof Error ? lastErr : new Error('Satellite Vision request failed.');
  }

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned empty response text for satellite tile analysis.');
  }

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const rawBuildings = sanitizeBoxes(parsed.buildings, 180);
  const rawTrees = sanitizeBoxes(parsed.trees, 160);
  const rawShadows = sanitizeBoxes(parsed.narrowShadows, 110);
  const rawBarriers = sanitizeBoxes(parsed.barriers, 90);

  const sectorBound = halfSizeMeters * 1.04;
  const projectList = (list: AnalyzedBox[]): MeterRectBox[] => {
    const out: MeterRectBox[] = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const minX = offsetX + (b.xmin / 1000 - 0.5) * spanMeters;
      const maxX = offsetX + (b.xmax / 1000 - 0.5) * spanMeters;
      const minY = offsetY + (b.ymin / 1000 - 0.5) * spanMeters;
      const maxY = offsetY + (b.ymax / 1000 - 0.5) * spanMeters;
      if (maxX < -sectorBound || minX > sectorBound || maxY < -sectorBound || minY > sectorBound) {
        continue;
      }
      out.push({
        minX,
        maxX,
        minY,
        maxY,
        heightMeters: b.heightMeters,
        kind: b.kind,
      });
    }
    return out;
  };

  return {
    spanMeters,
    metersPerPixel,
    rawBuildings,
    rawTrees,
    rawShadows,
    rawBarriers,
    buildings: projectList(rawBuildings),
    trees: projectList(rawTrees),
    narrowShadows: projectList(rawShadows),
    barriers: projectList(rawBarriers),
  };
}

async function analyzeSectorWithGemini(
  lat: number,
  lng: number,
  halfSizeMeters: number
): Promise<SectorAnalysisResponse> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!mapsKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured on the server.');
  }

  const use2x2Grid = halfSizeMeters >= 240;
  const targetTileSpan = use2x2Grid
    ? Math.max(360, Math.min(1150, halfSizeMeters * 1.18))
    : Math.max(240, halfSizeMeters * 2.1);

  const { zoom, metersPerPixel, spanMeters } = computeTileZoomForSpan(lat, targetTileSpan);
  const cacheKey = `${lat.toFixed(5)}:${lng.toFixed(5)}:${zoom}:${use2x2Grid ? '2x2' : '1x1'}:${Math.round(halfSizeMeters)}`;
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const stepM = use2x2Grid ? Math.min(halfSizeMeters * 0.48, spanMeters * 0.42) : 0;
  const tileOffsets = use2x2Grid
    ? [
        { ox: -stepM, oy: -stepM },
        { ox: stepM, oy: -stepM },
        { ox: -stepM, oy: stepM },
        { ox: stepM, oy: stepM },
      ]
    : [{ ox: 0, oy: 0 }];

  const settled = await Promise.allSettled(
    tileOffsets.map(async (t, idx) => {
      if (idx > 0) {
        await new Promise((r) => setTimeout(r, idx * 180));
      }
      return analyzeSingleTile(ai, mapsKey, lat, lng, t.ox, t.oy, zoom, halfSizeMeters);
    })
  );

  const succeeded = settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof analyzeSingleTile>>> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (succeeded.length === 0) {
    const firstErr = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw firstErr?.reason instanceof Error
      ? firstErr.reason
      : new Error('All satellite tile Vision analyses failed.');
  }

  const allBuildings = deduplicateMeterBoxes(succeeded.flatMap((s) => s.buildings), 0.42);
  const allTrees = deduplicateMeterBoxes(succeeded.flatMap((s) => s.trees), 0.45);
  const allShadows = deduplicateMeterBoxes(succeeded.flatMap((s) => s.narrowShadows), 0.48);
  const allBarriers = deduplicateMeterBoxes(succeeded.flatMap((s) => s.barriers), 0.45);

  const totalSpan = halfSizeMeters * 2;
  const toLegacyNormalized = (list: MeterRectBox[]): AnalyzedBox[] =>
    list.map((b) => ({
      xmin: Math.max(0, Math.min(1000, Math.round(((b.minX / totalSpan) + 0.5) * 1000))),
      xmax: Math.max(0, Math.min(1000, Math.round(((b.maxX / totalSpan) + 0.5) * 1000))),
      ymin: Math.max(0, Math.min(1000, Math.round(((b.minY / totalSpan) + 0.5) * 1000))),
      ymax: Math.max(0, Math.min(1000, Math.round(((b.maxY / totalSpan) + 0.5) * 1000))),
      heightMeters: b.heightMeters,
      kind: b.kind,
    }));

  const result: SectorAnalysisResponse = {
    ok: true,
    zoom,
    spanMeters: totalSpan,
    metersPerPixel,
    buildings: toLegacyNormalized(allBuildings),
    trees: toLegacyNormalized(allTrees),
    narrowShadows: toLegacyNormalized(allShadows),
    barriers: toLegacyNormalized(allBarriers),
    meterBoxes: {
      buildings: allBuildings,
      trees: allTrees,
      narrowShadows: allShadows,
      barriers: allBarriers,
    },
  };

  if (analysisCache.size > 40) {
    const oldestKey = analysisCache.keys().next().value;
    if (oldestKey) analysisCache.delete(oldestKey);
  }
  analysisCache.set(cacheKey, result);
  return result;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/analyze-sector', async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const halfSizeMeters = Number(req.body?.halfSizeMeters ?? 450);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -85 ||
      lat > 85 ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(halfSizeMeters) ||
      halfSizeMeters < 100 ||
      halfSizeMeters > 10000
    ) {
      res.status(400).json({ ok: false, error: 'Invalid lat, lng, or halfSizeMeters parameters.' });
      return;
    }

    try {
      const analysis = await analyzeSectorWithGemini(lat, lng, halfSizeMeters);
      res.json(analysis);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Satellite sector analysis failed.';
      console.error('[api/analyze-sector]', message);
      res.status(502).json({ ok: false, error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Karantina Hatti server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
