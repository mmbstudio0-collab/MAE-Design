import { ObstacleGrid } from './obstacles';
import {
  CityStreetNetwork,
  EW_STREET_NAMES,
  MAIN_RIVER_BRIDGES_X,
  NORTH_RIVER_BRIDGES_Y,
  NS_STREET_NAMES,
  SOUTH_RIVER_BRIDGES_Y,
  getCityStreetNetwork,
  getLakeShorelineX,
  getMainRiverCenterY,
  getNorthRiverCenterX,
} from './prebakedMap';
import { Obstacle } from './types';

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const ROOF_PALETTE = [
  { main: '#333b46', parapet: '#4b5563', accent: '#1f2937' },
  { main: '#3e3a37', parapet: '#57534e', accent: '#292524' },
  { main: '#2d3748', parapet: '#4a5568', accent: '#1a202c' },
  { main: '#3b424c', parapet: '#64748b', accent: '#262b33' },
  { main: '#443c38', parapet: '#625650', accent: '#2c2522' },
];

export interface CityMapViewport {
  cx: number; // world center X in meters
  cy: number; // world center Y in meters
  ppm: number; // pixels per meter
  width: number;
  height: number;
}

const networkCache = new Map<number, CityStreetNetwork>();
function getCachedNetwork(halfSize: number): CityStreetNetwork {
  let net = networkCache.get(halfSize);
  if (!net) {
    net = getCityStreetNetwork(halfSize);
    networkCache.set(halfSize, net);
  }
  return net;
}

/**
 * Renders the self-contained 1:1 Tactical Satellite City Map directly from exact geometry & obstacles.
 * Guarantees 100% pixel parity between visual buildings/streets/rivers/bridges and collision/NavMesh.
 */
export function renderCityMapLayer(
  ctx: CanvasRenderingContext2D,
  vp: CityMapViewport,
  halfSize: number,
  obstacleGrid: ObstacleGrid,
  allObstacles: readonly Obstacle[],
  elapsedVisual: number,
  viewBounds?: { minX: number; maxX: number; minY: number; maxY: number } | null
) {
  const { cx, cy, ppm, width, height } = vp;
  const halfW_m = width / (2 * ppm);
  const halfH_m = height / (2 * ppm);
  const minX = viewBounds ? Math.min(viewBounds.minX, cx - halfW_m) : cx - halfW_m;
  const maxX = viewBounds ? Math.max(viewBounds.maxX, cx + halfW_m) : cx + halfW_m;
  const minY = viewBounds ? Math.min(viewBounds.minY, cy - halfH_m) : cy - halfH_m;
  const maxY = viewBounds ? Math.max(viewBounds.maxY, cy + halfH_m) : cy + halfH_m;

  const toPx = (wx: number) => width * 0.5 + (wx - cx) * ppm;
  const toPy = (wy: number) => height * 0.5 + (wy - cy) * ppm;

  const net = getCachedNetwork(halfSize);

  // 1. Satellite Earth / Concrete Urban Base
  ctx.fillStyle = '#1b2028';
  ctx.fillRect(0, 0, width, height);

  // World-space transform for crisp aligned terrain geometry
  ctx.save();
  ctx.translate(width * 0.5 - cx * ppm, height * 0.5 - cy * ppm);
  ctx.scale(ppm, ppm);

  // Sector Landmass Backdrop + Outer Subtle Grid Texture
  const visMinX = Math.max(-halfSize - 300, minX - 60);
  const visMaxX = Math.min(halfSize + 300, maxX + 60);
  const visMinY = Math.max(-halfSize - 300, minY - 60);
  const visMaxY = Math.min(halfSize + 300, maxY + 60);

  // Urban block sidewalk base inside sector
  ctx.fillStyle = '#252b34';
  ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);

  // 2. Grant Park & Millennium Park Lush Satellite Turf (East of Michigan Ave x >= 254, y: -390..1265)
  const pb = net.parkBounds;
  if (visMaxX >= pb.minX && visMinX <= pb.maxX && visMaxY >= pb.minY && visMinY <= pb.maxY) {
    ctx.fillStyle = '#203c2a';
    ctx.fillRect(pb.minX, pb.minY, pb.maxX - pb.minX, pb.maxY - pb.minY);

    // Mown lawn satellite turf stripes
    if (ppm >= 0.35) {
      ctx.fillStyle = '#254530';
      for (let gx = pb.minX; gx < pb.maxX; gx += 18) {
        ctx.fillRect(gx, pb.minY, 9, pb.maxY - pb.minY);
      }
    }

    // Scenic gravel promenades & Buckingham Fountain Plaza
    ctx.fillStyle = '#524f49';
    ctx.fillRect(569, 415, 12, 285);
    ctx.beginPath();
    ctx.arc(730, 557, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#68635b';
    ctx.beginPath();
    ctx.arc(730, 557, 36, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Road Network (Asphalt, Curb/Sidewalks, Centerlines, Crosswalks)
  const roadW = 16.5;
  const sidewalkW = 24.5;
  const drawDetailMarkings = ppm >= 0.65;
  const drawSidewalks = ppm >= 0.35;

  // 3a. Outer Metropolitan Arterial Roads (201m spacing)
  if (halfSize > 1800) {
    const outerMinX = Math.floor(Math.max(-halfSize, visMinX) / net.outerStep) * net.outerStep;
    const outerMaxX = Math.ceil(Math.min(halfSize, visMaxX) / net.outerStep) * net.outerStep;
    const outerMinY = Math.floor(Math.max(-halfSize, visMinY) / net.outerStep) * net.outerStep;
    const outerMaxY = Math.ceil(Math.min(halfSize, visMaxY) / net.outerStep) * net.outerStep;

    ctx.fillStyle = '#1e232b';
    for (let rx = outerMinX; rx <= outerMaxX; rx += net.outerStep) {
      if (Math.abs(rx) <= net.coreLimit) continue;
      ctx.fillRect(rx - 7.5, visMinY, 15, visMaxY - visMinY);
    }
    for (let ry = outerMinY; ry <= outerMaxY; ry += net.outerStep) {
      if (Math.abs(ry) <= net.coreLimit) continue;
      ctx.fillRect(visMinX, ry - 7.5, visMaxX - visMinX, 15);
    }
  }

  // 3b. Core Urban Grid Streets & Sidewalks
  const coreSpanStartX = Math.max(-net.coreLimit - 30, visMinX);
  const coreSpanEndX = Math.min(net.coreLimit + 30, visMaxX);
  const coreSpanStartY = Math.max(-net.coreLimit - 30, visMinY);
  const coreSpanEndY = Math.min(net.coreLimit + 30, visMaxY);

  if (coreSpanEndX > coreSpanStartX && coreSpanEndY > coreSpanStartY) {
    if (drawSidewalks) {
      ctx.fillStyle = '#363d49';
      for (let i = 0; i < net.nsStreets.length; i++) {
        const rx = net.nsStreets[i];
        if (rx < visMinX - 30 || rx > visMaxX + 30) continue;
        ctx.fillRect(rx - sidewalkW / 2, coreSpanStartY, sidewalkW, coreSpanEndY - coreSpanStartY);
      }
      for (let i = 0; i < net.ewStreets.length; i++) {
        const ry = net.ewStreets[i];
        if (ry < visMinY - 30 || ry > visMaxY + 30) continue;
        ctx.fillRect(coreSpanStartX, ry - sidewalkW / 2, coreSpanEndX - coreSpanStartX, sidewalkW);
      }
    }

    // Dark Satellite Asphalt Roadway
    ctx.fillStyle = '#1b1f27';
    for (let i = 0; i < net.nsStreets.length; i++) {
      const rx = net.nsStreets[i];
      if (rx < visMinX - 30 || rx > visMaxX + 30) continue;
      ctx.fillRect(rx - roadW / 2, coreSpanStartY, roadW, coreSpanEndY - coreSpanStartY);
    }
    for (let i = 0; i < net.ewStreets.length; i++) {
      const ry = net.ewStreets[i];
      if (ry < visMinY - 30 || ry > visMaxY + 30) continue;
      ctx.fillRect(coreSpanStartX, ry - roadW / 2, coreSpanEndX - coreSpanStartX, roadW);
    }

    // Center Service Alleys (between split N/S buildings inside each block)
    if (ppm >= 0.45) {
      ctx.fillStyle = '#191d24';
      for (let r = 0; r < net.ewStreets.length - 1; r++) {
        const ay = (net.ewStreets[r] + net.ewStreets[r + 1]) / 2;
        if (ay < visMinY - 20 || ay > visMaxY + 20) continue;
        for (let c = 0; c < net.nsStreets.length - 1; c++) {
          const x0 = net.nsStreets[c];
          const x1 = net.nsStreets[c + 1];
          if (x1 < visMinX || x0 > visMaxX) continue;
          if (x0 >= 250 && net.ewStreets[r] >= -400 && net.ewStreets[r + 1] <= 1275) continue;
          ctx.fillRect(x0 + 8, ay - 4.2, x1 - x0 - 16, 8.4);
        }
      }
    }

    // Road Lane Markings & Intersection Crosswalks
    if (drawDetailMarkings) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.48)';
      ctx.lineWidth = 0.35;
      ctx.setLineDash([4.5, 5.5]);
      for (let i = 0; i < net.nsStreets.length; i++) {
        const rx = net.nsStreets[i];
        if (rx < visMinX - 20 || rx > visMaxX + 20) continue;
        ctx.beginPath();
        ctx.moveTo(rx, coreSpanStartY);
        ctx.lineTo(rx, coreSpanEndY);
        ctx.stroke();
      }
      for (let i = 0; i < net.ewStreets.length; i++) {
        const ry = net.ewStreets[i];
        if (ry < visMinY - 20 || ry > visMaxY + 20) continue;
        ctx.beginPath();
        ctx.moveTo(coreSpanStartX, ry);
        ctx.lineTo(coreSpanEndX, ry);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // White zebra crosswalk bars at visible intersections
      if (ppm >= 0.95) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.36)';
        for (let ci = 0; ci < net.nsStreets.length; ci++) {
          const rx = net.nsStreets[ci];
          if (rx < visMinX - 20 || rx > visMaxX + 20) continue;
          for (let ri = 0; ri < net.ewStreets.length; ri++) {
            const ry = net.ewStreets[ri];
            if (ry < visMinY - 20 || ry > visMaxY + 20) continue;
            if (rx >= getLakeShorelineX(ry) - 18) continue;
            for (let s = -6; s <= 6; s += 2.4) {
              ctx.fillRect(rx + s - 0.6, ry - roadW * 0.5 - 3.2, 1.2, 2.6);
              ctx.fillRect(rx + s - 0.6, ry + roadW * 0.5 + 0.6, 1.2, 2.6);
              ctx.fillRect(rx - roadW * 0.5 - 3.2, ry + s - 0.6, 2.6, 1.2);
              ctx.fillRect(rx + roadW * 0.5 + 0.6, ry + s - 0.6, 2.6, 1.2);
            }
          }
        }
      }
    }
  }

  // 4. Lake Michigan & Chicago River Channels + Seawall Embankments + Bridges
  // 4a. Lake Michigan (Continuous Polygon East of Shoreline)
  ctx.fillStyle = '#0c2d48';
  ctx.beginPath();
  const yStep = Math.max(40, (visMaxY - visMinY) / 28);
  const lakeTop = Math.min(visMinY - 40, -halfSize - 100);
  const lakeBot = Math.max(visMaxY + 40, halfSize + 100);
  const eastWall = Math.max(visMaxX + 200, halfSize + 400);
  ctx.moveTo(eastWall, lakeTop);
  ctx.lineTo(getLakeShorelineX(lakeTop), lakeTop);
  for (let sy = lakeTop + yStep; sy < lakeBot; sy += yStep) {
    ctx.lineTo(getLakeShorelineX(sy), sy);
  }
  ctx.lineTo(getLakeShorelineX(lakeBot), lakeBot);
  ctx.lineTo(eastWall, lakeBot);
  ctx.closePath();
  ctx.fill();

  // Shoreline Concrete Seawall Breakwater
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(getLakeShorelineX(visMinY - 40), visMinY - 40);
  for (let sy = visMinY; sy <= visMaxY + 40; sy += 45) {
    ctx.lineTo(getLakeShorelineX(sy), sy);
  }
  ctx.stroke();

  // 4b. Chicago River Branches (Embankment + Deep Teal Water)
  const drawRiverChannel = (pts: { x: number; y: number }[], bankW: number, waterW: number) => {
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = bankW;
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    ctx.strokeStyle = '#0e3756';
    ctx.lineWidth = waterW;
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  };

  // Main Branch
  if (visMinY <= -500 && visMaxY >= -850 && visMaxX >= -880) {
    const mainPts: { x: number; y: number }[] = [];
    for (let rx = -855; rx <= getLakeShorelineX(-730) + 45; rx += 60) {
      mainPts.push({ x: rx, y: getMainRiverCenterY(rx) });
    }
    drawRiverChannel(mainPts, 72, 62);
  }
  // South Branch
  if (visMaxY >= -620 && visMinX <= -770 && visMaxX >= -890) {
    drawRiverChannel(
      [
        { x: -830, y: -595 },
        { x: -830, y: Math.min(halfSize + 100, visMaxY + 80) },
      ],
      72,
      62
    );
  }
  // North Branch
  if (visMinY <= -580 && visMinX <= -760) {
    const topY = Math.max(-halfSize - 100, visMinY - 80);
    drawRiverChannel(
      [
        { x: -835, y: -595 },
        { x: getNorthRiverCenterX(topY), y: topY },
      ],
      64,
      54
    );
  }

  // Subtle animated water wave sheen streaks (when zoomed near water)
  if (ppm >= 0.4) {
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.14)';
    ctx.lineWidth = 1.1;
    const waveDrift = (elapsedVisual * 4) % 36;
    const wStartX = Math.max(visMinX, getLakeShorelineX(visMinY) + 18);
    if (wStartX < visMaxX) {
      ctx.beginPath();
      for (let wy = Math.floor(visMinY / 42) * 42; wy <= visMaxY; wy += 42) {
        const shore = getLakeShorelineX(wy) + 16;
        for (let wx = Math.max(shore, Math.floor(visMinX / 72) * 72 + waveDrift); wx < visMaxX; wx += 72) {
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + 16, wy + Math.sin(wy * 0.05 + elapsedVisual) * 1.5);
        }
      }
      ctx.stroke();
    }
  }

  // 4c. Real Walkable Bridges over Chicago River Branches
  const drawBridgeDeck = (bx: number, by: number, lenX: number, lenY: number, isNS: boolean) => {
    ctx.fillStyle = '#3b424e';
    ctx.fillRect(bx - lenX / 2, by - lenY / 2, lenX, lenY);
    // Steel side girders / railings
    ctx.fillStyle = '#94a3b8';
    if (isNS) {
      ctx.fillRect(bx - lenX / 2, by - lenY / 2, 1.8, lenY);
      ctx.fillRect(bx + lenX / 2 - 1.8, by - lenY / 2, 1.8, lenY);
    } else {
      ctx.fillRect(bx - lenX / 2, by - lenY / 2, lenX, 1.8);
      ctx.fillRect(bx - lenX / 2, by + lenY / 2 - 1.8, lenX, 1.8);
    }
  };

  for (let i = 0; i < MAIN_RIVER_BRIDGES_X.length; i++) {
    const bx = MAIN_RIVER_BRIDGES_X[i];
    if (bx < visMinX - 30 || bx > visMaxX + 30) continue;
    drawBridgeDeck(bx, getMainRiverCenterY(bx), 22, 72, true);
  }
  for (let i = 0; i < SOUTH_RIVER_BRIDGES_Y.length; i++) {
    const by = SOUTH_RIVER_BRIDGES_Y[i];
    if (by > halfSize || by < visMinY - 30 || by > visMaxY + 30) continue;
    drawBridgeDeck(-830, by, 72, 22, false);
  }
  for (let i = 0; i < NORTH_RIVER_BRIDGES_Y.length; i++) {
    const by = NORTH_RIVER_BRIDGES_Y[i];
    if (by < -halfSize || by < visMinY - 30 || by > visMaxY + 30) continue;
    drawBridgeDeck(getNorthRiverCenterX(by), by, 68, 22, false);
  }

  // 5. Query Visible Buildings, Trees, & Architectural Barriers (100% 1:1 with Physics Grid!)
  const visibleObs = obstacleGrid.queryBoxScratch(minX - 65, minY - 65, maxX + 65, maxY + 65);
  const obsSlice = visibleObs.length > 0 || viewBounds ? visibleObs : allObstacles;
  const detailRoof = ppm >= 0.45;
  const drawShadows = ppm >= 0.3;

  // 5a. Building Drop Shadows First
  if (drawShadows) {
    ctx.fillStyle = 'rgba(2, 6, 14, 0.52)';
    for (let i = 0; i < obsSlice.length; i++) {
      const ob = obsSlice[i];
      if (ob.kind !== 'building' || ob.shape !== 'rect' || ob.x === undefined || ob.y === undefined || !ob.w || !ob.h) {
        continue;
      }
      const shOff = Math.min(9, Math.max(3, (ob.w + ob.h) * 0.045));
      ctx.fillRect(ob.x - ob.w / 2 + shOff, ob.y - ob.h / 2 + shOff, ob.w, ob.h);
    }
  }

  // 5b. 3D-Shaded Rooftops + HVAC Pods + Helipads
  for (let i = 0; i < obsSlice.length; i++) {
    const ob = obsSlice[i];
    if (ob.kind === 'building' && ob.shape === 'rect' && ob.x !== undefined && ob.y !== undefined && ob.w && ob.h) {
      const seed = hashString(ob.id);
      const pal = ROOF_PALETTE[Math.floor(seed * ROOF_PALETTE.length)];
      const x0 = ob.x - ob.w / 2;
      const y0 = ob.y - ob.h / 2;

      // Outer building wall / sunlit north-west bevel
      ctx.fillStyle = pal.parapet;
      ctx.fillRect(x0, y0, ob.w, ob.h);

      // Recessed roof deck
      const rim = Math.min(2.2, ob.w * 0.08, ob.h * 0.08);
      ctx.fillStyle = pal.main;
      ctx.fillRect(x0 + rim, y0 + rim, ob.w - rim * 2, ob.h - rim * 2);

      if (detailRoof && ob.w >= 14 && ob.h >= 14) {
        // Subtle 3D rooftop step-tier / penthouse or HVAC equipment
        ctx.fillStyle = pal.accent;
        const innerW = ob.w * 0.42;
        const innerH = ob.h * 0.42;
        ctx.fillRect(ob.x - innerW / 2, ob.y - innerH / 2, innerW, innerH);

        // HVAC chiller boxes & skylight vents
        ctx.fillStyle = '#64748b';
        const podX = ob.x - ob.w * 0.25;
        const podY = ob.y - ob.h * 0.25;
        ctx.fillRect(podX, podY, 3.8, 2.6);
        if (seed > 0.45) {
          ctx.fillRect(ob.x + ob.w * 0.14, ob.y + ob.h * 0.14, 4.2, 3.0);
        }

        // Occasional Loop tower helipad decal
        if (seed > 0.87 && ob.w >= 34 && ob.h >= 34 && ppm >= 0.7) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.arc(ob.x, ob.y, 6.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (ob.kind === 'barrier' && !ob.id.startsWith('lake-') && !ob.id.startsWith('river-')) {
      if (ob.id.startsWith('fountain-') && ob.x !== undefined && ob.y !== undefined && ob.radius) {
        // Buckingham Fountain decorative basin
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, ob.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, ob.radius * 0.84, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, ob.radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
      } else if (ob.shape === 'rect' && ob.x !== undefined && ob.y !== undefined && ob.w && ob.h) {
        ctx.save();
        ctx.translate(ob.x, ob.y);
        ctx.rotate(ob.angle ?? 0);
        ctx.fillStyle = '#57534e';
        ctx.fillRect(-ob.w / 2, -ob.h / 2, ob.w, ob.h);
        ctx.restore();
      }
    }
  }

  // 5c. Green Leafy Tree Canopies (Matching Exact Collision Radius)
  for (let i = 0; i < obsSlice.length; i++) {
    const ob = obsSlice[i];
    if (ob.kind !== 'tree' || ob.x === undefined || ob.y === undefined || !ob.radius) continue;
    const r = ob.radius;
    if (drawShadows) {
      ctx.fillStyle = 'rgba(2, 6, 14, 0.42)';
      ctx.beginPath();
      ctx.arc(ob.x + r * 0.38, ob.y + r * 0.42, r * 0.96, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(ob.x, ob.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (ppm >= 0.45) {
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(ob.x - r * 0.16, ob.y - r * 0.18, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(ob.x - r * 0.28, ob.y - r * 0.28, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();

  // 6. Crisp Screen-Space Street Name Labels & River Watermark (never blurry or distorted)
  if (ppm >= 0.55) {
    ctx.save();
    ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // East-West Street Labels
    for (const [yStr, name] of Object.entries(EW_STREET_NAMES)) {
      const sy = Number(yStr);
      if (sy < minY || sy > maxY) continue;
      const py = toPy(sy);
      const labelWx = Math.max(-680, Math.min(200, cx));
      const px = toPx(labelWx);
      if (px < 40 || px > width - 40 || py < 20 || py > height - 20) continue;
      ctx.strokeStyle = 'rgba(9, 14, 26, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(name, px, py);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.78)';
      ctx.fillText(name, px, py);
    }

    // North-South Avenue Labels
    for (const [xStr, name] of Object.entries(NS_STREET_NAMES)) {
      const sx = Number(xStr);
      if (sx < minX || sx > maxX) continue;
      const px = toPx(sx);
      const labelWy = Math.max(-440, Math.min(900, cy));
      const py = toPy(labelWy);
      if (px < 40 || px > width - 40 || py < 20 || py > height - 20) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-Math.PI / 2);
      ctx.strokeStyle = 'rgba(9, 14, 26, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(name, 0, 0);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }
}
