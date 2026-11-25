export type CameraTiltDeg = 0 | 45;

export const PERSPECTIVE_DISTANCE_PX = 1800;
export const TILT_45_SCALE = 1.15;

/**
 * Converts a browser client (clientX, clientY) coordinate to the un-transformed
 * local canvas pixel coordinate (px, py) inside the Google Map + Canvas stage.
 *
 * Matches CSS:
 *   transform-origin: 50% 50%
 *   transform: perspective(1800px) rotateX(45deg) scale(1.15)
 */
export function screenPointToStageCanvas(
  clientX: number,
  clientY: number,
  viewportRect: { left: number; top: number },
  stageOffsetLeft: number,
  stageOffsetTop: number,
  stageWidth: number,
  stageHeight: number,
  tiltDeg: CameraTiltDeg
): { px: number; py: number } {
  const sx = clientX - viewportRect.left;
  const sy = clientY - viewportRect.top;

  if (tiltDeg === 0) {
    return {
      px: sx - stageOffsetLeft,
      py: sy - stageOffsetTop,
    };
  }

  const ox = stageOffsetLeft + stageWidth * 0.5;
  const oy = stageOffsetTop + stageHeight * 0.5;
  const dx = sx - ox;
  const dy = sy - oy;

  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const denom = Math.max(
    0.15,
    TILT_45_SCALE * (cos + (dy * sin) / PERSPECTIVE_DISTANCE_PX)
  );

  const xLocal = (dx * cos) / denom;
  const yLocal = dy / denom;

  return {
    px: stageWidth * 0.5 + xLocal,
    py: stageHeight * 0.5 + yLocal,
  };
}

/**
 * Forward projection matching CSS `perspective(1800px) rotateX(tiltDeg) scale(1.15)`
 * from local canvas (px, py) to viewport-relative (sx, sy).
 */
export function stageCanvasToViewportPoint(
  px: number,
  py: number,
  stageOffsetLeft: number,
  stageOffsetTop: number,
  stageWidth: number,
  stageHeight: number,
  tiltDeg: CameraTiltDeg
): { sx: number; sy: number } {
  if (tiltDeg === 0) {
    return {
      sx: stageOffsetLeft + px,
      sy: stageOffsetTop + py,
    };
  }

  const ox = stageOffsetLeft + stageWidth * 0.5;
  const oy = stageOffsetTop + stageHeight * 0.5;
  const xLocal = px - stageWidth * 0.5;
  const yLocal = py - stageHeight * 0.5;

  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const xScaled = TILT_45_SCALE * xLocal;
  const yScaled = TILT_45_SCALE * yLocal;
  const yRot = yScaled * cos;
  const zRot = yScaled * sin;
  const w = Math.max(0.15, 1 - zRot / PERSPECTIVE_DISTANCE_PX);

  return {
    sx: ox + xScaled / w,
    sy: oy + yRot / w,
  };
}
