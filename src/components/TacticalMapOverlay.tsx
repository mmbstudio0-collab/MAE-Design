import React, { useEffect, useRef, useState } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { soundEngine } from '../audio/soundEngine';
import { MapProjector, TacticalZombieEngine } from '../game/engine';
import {
  googleMapsPixelsPerMeter,
  metersToLatLng,
  pixelsPerMeterToGoogleZoom,
} from '../game/geo';
import { CameraTiltDeg, screenPointToStageCanvas } from '../game/perspective';
import { GameState, GeoOrigin, PlacementValidation, ToolSelection } from '../game/types';

interface TacticalMapOverlayProps {
  engine: TacticalZombieEngine;
  origin: GeoOrigin;
  recommendedZoom: number;
  mapTypeId: 'satellite' | 'hybrid';
  gameState: GameState;
  showObstacles: boolean;
  tiltDeg: CameraTiltDeg;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  toolSelection: ToolSelection;
  onResetTool: () => void;
  onStatusToast: (msg: string) => void;
  minimapCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  jumpToMetersRef: React.MutableRefObject<((xMeters: number, yMeters: number) => void) | null>;
}

const MIN_PPM = 0.06;
const MAX_PPM = 6.0;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export const TacticalMapOverlay: React.FC<TacticalMapOverlayProps> = ({
  engine,
  origin,
  recommendedZoom,
  mapTypeId,
  gameState,
  showObstacles,
  tiltDeg,
  viewportRef,
  stageRef,
  toolSelection,
  onResetTool,
  onStatusToast,
  minimapCanvasRef,
  jumpToMetersRef,
}) => {
  const googleMap = useMap('tactical-sat-map');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<{ cx: number; cy: number; ppm: number }>({
    cx: 0,
    cy: 0,
    ppm: googleMapsPixelsPerMeter(origin.lat, recommendedZoom),
  });
  const lastSyncRef = useRef<{ lat: number; lng: number; zoom: number }>({
    lat: NaN,
    lng: NaN,
    zoom: NaN,
  });

  const selectionDragRef = useRef<{
    active: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const lineDragRef = useRef<{
    active: boolean;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const panDragRef = useRef<{
    active: boolean;
    lastPx: number;
    lastPy: number;
  } | null>(null);

  const hoverMetersRef = useRef<{ x: number; y: number } | null>(null);
  const keysPressedRef = useRef<Set<string>>(new Set());

  const [size, setSize] = useState({ width: 1200, height: 800 });

  const propsRef = useRef({
    origin,
    gameState,
    showObstacles,
    tiltDeg,
    toolSelection,
  });
  useEffect(() => {
    propsRef.current = { origin, gameState, showObstacles, tiltDeg, toolSelection };
  }, [origin, gameState, showObstacles, tiltDeg, toolSelection]);

  useEffect(() => {
    engine.setCameraTilt(tiltDeg);
  }, [engine, tiltDeg]);

  // Recenter both canvas projection and Google Map whenever origin / recommendedZoom changes
  useEffect(() => {
    const targetPpm = clamp(googleMapsPixelsPerMeter(origin.lat, recommendedZoom), MIN_PPM, MAX_PPM);
    camRef.current = { cx: 0, cy: 0, ppm: targetPpm };
    lastSyncRef.current = { lat: NaN, lng: NaN, zoom: NaN };
    if (googleMap) {
      googleMap.moveCamera({
        center: { lat: origin.lat, lng: origin.lng },
        zoom: recommendedZoom,
        tilt: 0,
        heading: 0,
      });
      lastSyncRef.current = { lat: origin.lat, lng: origin.lng, zoom: recommendedZoom };
    }
  }, [origin.lat, origin.lng, recommendedZoom, googleMap]);

  useEffect(() => {
    jumpToMetersRef.current = (xMeters: number, yMeters: number) => {
      const half = engine.getHalfSize();
      camRef.current.cx = clamp(xMeters, -half, half);
      camRef.current.cy = clamp(yMeters, -half, half);
    };
  }, [engine, jumpToMetersRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const parent = canvas.parentElement;
    const updateSize = () => {
      setSize({
        width: parent.clientWidth || 1200,
        height: parent.clientHeight || 800,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName || '')) return;
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code
        )
      ) {
        keysPressedRef.current.add(e.code);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };
    const onBlur = () => {
      keysPressedRef.current.clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const clientToStageCanvas = (clientX: number, clientY: number): { px: number; py: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const vpEl = viewportRef.current;
    const stEl = stageRef.current;

    if (vpEl && stEl) {
      const vpRect = vpEl.getBoundingClientRect();
      return screenPointToStageCanvas(
        clientX,
        clientY,
        vpRect,
        stEl.offsetLeft,
        stEl.offsetTop,
        stEl.offsetWidth || canvas.width,
        stEl.offsetHeight || canvas.height,
        propsRef.current.tiltDeg
      );
    }

    const rect = canvas.getBoundingClientRect();
    return {
      px: clientX - rect.left,
      py: clientY - rect.top,
    };
  };

  const stageCanvasToMeters = (px: number, py: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    const w = canvas?.width || size.width;
    const h = canvas?.height || size.height;
    const cam = camRef.current;
    return {
      x: cam.cx + (px - w * 0.5) / cam.ppm,
      y: cam.cy + (py - h * 0.5) / cam.ppm,
    };
  };

  const screenToMeters = (
    clientX: number,
    clientY: number
  ): { x: number; y: number; px: number; py: number } | null => {
    const pt = clientToStageCanvas(clientX, clientY);
    if (!pt) return null;
    const m = stageCanvasToMeters(pt.px, pt.py);
    return { x: m.x, y: m.y, px: pt.px, py: pt.py };
  };

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const cam = camRef.current;
      const half = engine.getHalfSize();

      if (propsRef.current.gameState === 'PLAYING') {
        const keys = keysPressedRef.current;
        let dx = 0;
        let dy = 0;
        const panSpeedMeters = (540 / cam.ppm) * Math.min(dt, 0.05);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= panSpeedMeters;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += panSpeedMeters;
        if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= panSpeedMeters;
        if (keys.has('KeyS') || keys.has('ArrowDown')) dy += panSpeedMeters;
        if (dx !== 0 || dy !== 0) {
          cam.cx = clamp(cam.cx + dx, -half, half);
          cam.cy = clamp(cam.cy + dy, -half, half);
        }
      }

      // Sync Google Maps Satellite View 1:1 with canvas Web Mercator camera
      if (googleMap) {
        const curOrigin = propsRef.current.origin;
        const centerLatLng = metersToLatLng(cam.cx, cam.cy, curOrigin);
        const zoomLevel = clamp(pixelsPerMeterToGoogleZoom(curOrigin.lat, cam.ppm), 12, 21);
        const prev = lastSyncRef.current;
        if (
          Math.abs(centerLatLng.lat - prev.lat) > 1e-7 ||
          Math.abs(centerLatLng.lng - prev.lng) > 1e-7 ||
          Math.abs(zoomLevel - prev.zoom) > 1e-4
        ) {
          googleMap.moveCamera({
            center: centerLatLng,
            zoom: zoomLevel,
            tilt: 0,
            heading: 0,
          });
          lastSyncRef.current = { lat: centerLatLng.lat, lng: centerLatLng.lng, zoom: zoomLevel };
        }
      }

      engine.update(dt);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;

          const px0 = w * 0.5 - cam.cx * cam.ppm;
          const py0 = h * 0.5 - cam.cy * cam.ppm;

          const projector: MapProjector = {
            pixelsPerMeter: cam.ppm,
            affine: {
              px0,
              py0,
              scaleX: cam.ppm,
              scaleY: cam.ppm,
              quadY: 0,
            },
            project: (xMeters: number, yMeters: number) => ({
              px: px0 + xMeters * cam.ppm,
              py: py0 + yMeters * cam.ppm,
            }),
          };

          let viewBoundsMeters: { minX: number; maxX: number; minY: number; maxY: number };
          const vpEl = viewportRef.current;
          const stEl = stageRef.current;
          const curTilt = propsRef.current.tiltDeg;

          if (vpEl && stEl && curTilt === 45) {
            const vpRect = vpEl.getBoundingClientRect();
            const corners = [
              { cx: vpRect.left, cy: vpRect.top },
              { cx: vpRect.right, cy: vpRect.top },
              { cx: vpRect.left, cy: vpRect.bottom },
              { cx: vpRect.right, cy: vpRect.bottom },
            ];
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            for (const c of corners) {
              const mapped = screenPointToStageCanvas(
                c.cx,
                c.cy,
                vpRect,
                stEl.offsetLeft,
                stEl.offsetTop,
                stEl.offsetWidth || w,
                stEl.offsetHeight || h,
                curTilt
              );
              const mx = cam.cx + (mapped.px - w * 0.5) / cam.ppm;
              const my = cam.cy + (mapped.py - h * 0.5) / cam.ppm;
              if (mx < minX) minX = mx;
              if (mx > maxX) maxX = mx;
              if (my < minY) minY = my;
              if (my > maxY) maxY = my;
            }
            viewBoundsMeters = { minX, maxX, minY, maxY };
          } else {
            const halfW = w / (2 * cam.ppm);
            const halfH = h / (2 * cam.ppm);
            viewBoundsMeters = {
              minX: cam.cx - halfW,
              maxX: cam.cx + halfW,
              minY: cam.cy - halfH,
              maxY: cam.cy + halfH,
            };
          }

          soundEngine.updateListener(cam.cx, cam.cy, cam.ppm, viewBoundsMeters);

          // Render transparent simulation overlay directly over Google Maps Satellite tiles
          const box = selectionDragRef.current?.active ? selectionDragRef.current : null;
          const curTool = propsRef.current.toolSelection.tool;
          const hoverHeli =
            curTool === 'call_heli' && propsRef.current.gameState === 'PLAYING'
              ? hoverMetersRef.current
              : null;

          const activeLine = lineDragRef.current?.active ? lineDragRef.current : null;
          const linePreview =
            activeLine && curTool === 'airstrike'
              ? { ...activeLine, color: '#ef4444' }
              : null;

          engine.renderOnMap(ctx, w, h, projector, {
            showObstacles: propsRef.current.showObstacles,
            selectionBox: box,
            heliPlacementHover: hoverHeli,
            linePreview,
            viewBounds: viewBoundsMeters,
            skipClear: false,
          });

          // Live Green / Red Placement Validation Previews for Barricade & Quarantine Zone
          if (propsRef.current.gameState === 'PLAYING' && (curTool === 'barricade' || curTool === 'quarantine')) {
            if (curTool === 'barricade') {
              const seg = activeLine
                ? { x1: activeLine.x1, y1: activeLine.y1, x2: activeLine.x2, y2: activeLine.y2 }
                : hoverMetersRef.current
                  ? {
                      x1: hoverMetersRef.current.x - 7,
                      y1: hoverMetersRef.current.y,
                      x2: hoverMetersRef.current.x + 7,
                      y2: hoverMetersRef.current.y,
                    }
                  : null;

              if (seg) {
                const check: PlacementValidation = engine.validateBarricadeSegment(
                  seg.x1,
                  seg.y1,
                  seg.x2,
                  seg.y2
                );
                const dx = seg.x2 - seg.x1;
                const dy = seg.y2 - seg.y1;
                const rawLen = Math.hypot(dx, dy);
                const len = rawLen < 3 ? 14 : Math.max(8, Math.min(48, rawLen));
                const angle = rawLen < 3 ? 0 : Math.atan2(dy, dx);
                const cx = rawLen < 3 ? seg.x1 : (seg.x1 + seg.x2) / 2;
                const cy = rawLen < 3 ? seg.y1 : (seg.y1 + seg.y2) / 2;
                const p = projector.project(cx, cy);
                if (p) {
                  const lenPx = len * cam.ppm;
                  const widPx = Math.max(6, 2.2 * cam.ppm);
                  const strokeCol = check.valid ? '#22c55e' : '#ef4444';
                  const fillCol = check.valid ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.34)';

                  ctx.save();
                  ctx.translate(p.px, p.py);
                  ctx.rotate(angle);
                  ctx.fillStyle = fillCol;
                  ctx.strokeStyle = strokeCol;
                  ctx.lineWidth = 2;
                  ctx.fillRect(-lenPx / 2, -widPx / 2, lenPx, widPx);
                  ctx.strokeRect(-lenPx / 2, -widPx / 2, lenPx, widPx);
                  ctx.restore();

                  // Reason badge
                  const label = check.valid ? 'Uygun · Barikat Kurulabilir' : check.reason || 'Engel Var';
                  ctx.save();
                  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
                  const tw = ctx.measureText(label).width;
                  const bx = p.px - (tw + 14) / 2;
                  const by = p.py - widPx / 2 - 28;
                  ctx.fillStyle = 'rgba(9, 13, 20, 0.9)';
                  ctx.strokeStyle = strokeCol;
                  ctx.lineWidth = 1.2;
                  ctx.fillRect(bx, by, tw + 14, 20);
                  ctx.strokeRect(bx, by, tw + 14, 20);
                  ctx.fillStyle = check.valid ? '#86efac' : '#fca5a5';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(label, p.px, by + 10);
                  ctx.restore();
                }
              }
            } else if (curTool === 'quarantine') {
              const qx = activeLine ? activeLine.x1 : hoverMetersRef.current?.x;
              const qy = activeLine ? activeLine.y1 : hoverMetersRef.current?.y;
              if (qx !== undefined && qy !== undefined) {
                const rad = activeLine
                  ? clamp(Math.hypot(activeLine.x2 - activeLine.x1, activeLine.y2 - activeLine.y1), 45, 220)
                  : 90;
                const check = engine.validateQuarantineArea(qx, qy, rad);
                const p = projector.project(qx, qy);
                if (p) {
                  const radPx = rad * cam.ppm;
                  const strokeCol = check.valid ? '#22c55e' : '#ef4444';
                  const fillCol = check.valid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.16)';

                  ctx.save();
                  ctx.fillStyle = fillCol;
                  ctx.strokeStyle = strokeCol;
                  ctx.lineWidth = 2.2;
                  ctx.setLineDash([10, 6]);
                  ctx.beginPath();
                  ctx.arc(p.px, p.py, radPx, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();

                  // Preview 4 watchtower perimeter corners
                  for (let ti = 0; ti < 4; ti++) {
                    const a = (ti / 4) * Math.PI * 2 + Math.PI * 0.25;
                    const tp = projector.project(qx + Math.cos(a) * rad * 0.84, qy + Math.sin(a) * rad * 0.84);
                    if (tp) {
                      ctx.fillStyle = strokeCol;
                      ctx.beginPath();
                      ctx.arc(tp.px, tp.py, 4, 0, Math.PI * 2);
                      ctx.fill();
                    }
                  }
                  ctx.restore();

                  const label = check.valid
                    ? `Uygun (${Math.round(rad)}m) · Bırakınca Arazi Taranır`
                    : check.reason || 'Alan Uygun Değil';
                  ctx.save();
                  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
                  const tw = ctx.measureText(label).width;
                  const bx = p.px - (tw + 14) / 2;
                  const by = p.py - 30;
                  ctx.fillStyle = 'rgba(9, 13, 20, 0.9)';
                  ctx.strokeStyle = strokeCol;
                  ctx.lineWidth = 1.2;
                  ctx.fillRect(bx, by, tw + 14, 20);
                  ctx.strokeRect(bx, by, tw + 14, 20);
                  ctx.fillStyle = check.valid ? '#86efac' : '#fca5a5';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(label, p.px, by + 10);
                  ctx.restore();
                }
              }
            }
          }

          const mini = minimapCanvasRef.current;
          if (mini) {
            const mctx = mini.getContext('2d');
            if (mctx) {
              engine.renderMinimap(mctx, mini.width, mini.height, viewBoundsMeters);
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [engine, googleMap, minimapCanvasRef, viewportRef, stageRef, size.width, size.height]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    soundEngine.preloadAssets();
    if (e.button === 1 || (e.button === 0 && e.altKey) || (gameState === 'TITLE_MENU' && e.button === 0)) {
      e.preventDefault();
      const pt = clientToStageCanvas(e.clientX, e.clientY);
      if (pt) {
        panDragRef.current = { active: true, lastPx: pt.px, lastPy: pt.py };
      }
      return;
    }

    if (gameState !== 'PLAYING' || e.button !== 0) return;

    const pos = screenToMeters(e.clientX, e.clientY);
    if (!pos) return;

    const t = toolSelection.tool;
    if (t === 'command') {
      selectionDragRef.current = { active: true, x1: pos.px, y1: pos.py, x2: pos.px, y2: pos.py };
      return;
    }

    if (t === 'airstrike' || t === 'barricade' || t === 'quarantine') {
      lineDragRef.current = { active: true, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
      return;
    }

    if (t === 'call_heli') {
      const res = engine.callHelicopterAt(pos.x, pos.y, toolSelection.heliMode);
      if (!res.ok && res.reason) onStatusToast(res.reason);
      else onResetTool();
      return;
    }

    if (t === 'spawn_zombie') {
      engine.spawnZombieAt(pos.x, pos.y, toolSelection.zombieVariant);
    } else if (t === 'spawn_civilian') {
      engine.spawnCivilianAt(pos.x, pos.y, toolSelection.civilianPreset);
    } else if (t === 'spawn_police') {
      engine.deployPoliceAt(pos.x, pos.y, toolSelection.policeRole);
    } else if (t === 'spawn_soldier') {
      engine.deploySoldierAt(pos.x, pos.y, toolSelection.soldierRole);
    } else if (t === 'spawn_vehicle') {
      engine.spawnVehicleAt(pos.x, pos.y, toolSelection.vehicleKind);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panDragRef.current?.active) {
      const pt = clientToStageCanvas(e.clientX, e.clientY);
      if (pt) {
        const dxPx = pt.px - panDragRef.current.lastPx;
        const dyPx = pt.py - panDragRef.current.lastPy;
        panDragRef.current.lastPx = pt.px;
        panDragRef.current.lastPy = pt.py;
        const cam = camRef.current;
        const half = engine.getHalfSize();
        cam.cx = clamp(cam.cx - dxPx / cam.ppm, -half, half);
        cam.cy = clamp(cam.cy - dyPx / cam.ppm, -half, half);
      }
      return;
    }

    const pos = screenToMeters(e.clientX, e.clientY);
    if (!pos) return;
    hoverMetersRef.current = { x: pos.x, y: pos.y };

    if (selectionDragRef.current?.active) {
      selectionDragRef.current.x2 = pos.px;
      selectionDragRef.current.y2 = pos.py;
    }
    if (lineDragRef.current?.active) {
      lineDragRef.current.x2 = pos.x;
      lineDragRef.current.y2 = pos.y;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panDragRef.current?.active) {
      panDragRef.current = null;
      return;
    }

    if (lineDragRef.current?.active) {
      const ld = lineDragRef.current;
      lineDragRef.current = null;
      const t = toolSelection.tool;
      if (t === 'airstrike') {
        engine.callA10Strike(ld.x1, ld.y1, ld.x2, ld.y2);
      } else if (t === 'barricade') {
        const res = engine.buildBarricade(ld.x1, ld.y1, ld.x2, ld.y2);
        if (!res.valid && res.reason) {
          onStatusToast(`Barikat kurulamadı: ${res.reason}`);
        }
      } else if (t === 'quarantine') {
        const dragDist = Math.hypot(ld.x2 - ld.x1, ld.y2 - ld.y1);
        const rad = dragDist < 8 ? 90 : clamp(dragDist, 45, 220);
        const res = engine.createQuarantineZone(ld.x1, ld.y1, rad);
        if (!res.valid && res.reason) {
          onStatusToast(`Karantina kurulamadı: ${res.reason}`);
        } else {
          onStatusToast('Bölge taranıyor... Engel analizi sonrası kule ve barikatlar konuşlanacak.');
        }
      }
      return;
    }

    if (selectionDragRef.current?.active) {
      const sd = selectionDragRef.current;
      selectionDragRef.current = null;
      const dragDist = Math.hypot(sd.x2 - sd.x1, sd.y2 - sd.y1);

      if (dragDist < 8) {
        const m = stageCanvasToMeters(sd.x2, sd.y2);
        engine.selectAt(m.x, m.y, e.shiftKey);
      } else {
        const m1 = stageCanvasToMeters(sd.x1, sd.y1);
        const m2 = stageCanvasToMeters(sd.x2, sd.y2);
        engine.selectInBox(
          Math.min(m1.x, m2.x),
          Math.min(m1.y, m2.y),
          Math.max(m1.x, m2.x),
          Math.max(m1.y, m2.y),
          e.shiftKey
        );
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (toolSelection.tool !== 'command') {
      onResetTool();
      return;
    }
    if (gameState !== 'PLAYING') return;
    const pos = screenToMeters(e.clientX, e.clientY);
    if (!pos) return;
    engine.commandRightClick(pos.x, pos.y);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const before = screenToMeters(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    const cam = camRef.current;
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const nextPpm = clamp(cam.ppm * factor, MIN_PPM, MAX_PPM);

    if (before && canvas) {
      const half = engine.getHalfSize();
      cam.cx = clamp(before.x - (before.px - canvas.width * 0.5) / nextPpm, -half, half);
      cam.cy = clamp(before.y - (before.py - canvas.height * 0.5) / nextPpm, -half, half);
    }
    cam.ppm = nextPpm;
  };

  const isActionTool = gameState === 'PLAYING' && toolSelection.tool !== 'command';

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <GoogleMap
          id="tactical-sat-map"
          defaultCenter={origin}
          defaultZoom={recommendedZoom}
          mapTypeId={mapTypeId}
          gestureHandling="none"
          disableDefaultUI={true}
          tilt={0}
          heading={0}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          panDragRef.current = null;
          hoverMetersRef.current = null;
        }}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        className={`relative z-10 block w-full h-full pointer-events-auto ${
          gameState === 'TITLE_MENU'
            ? 'cursor-grab active:cursor-grabbing'
            : isActionTool
              ? 'cursor-crosshair'
              : 'cursor-default'
        }`}
      />
    </div>
  );
};
