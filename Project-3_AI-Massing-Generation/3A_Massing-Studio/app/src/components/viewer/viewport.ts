// Pure tile-rect -> scissor-rect maths for the options grid.
// Replaces drei <View>'s own calculation, which compares viewport-space tile coordinates against the
// canvas SIZE (not its position) and so wrongly culls tiles when the canvas is not at x = 0 / y = 0.
export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface Scissor {
  /** CSS pixels from the canvas's left edge. */
  left: number;
  /** CSS pixels from the canvas's BOTTOM edge (GL convention). */
  bottom: number;
  width: number;
  height: number;
  offscreen: boolean;
}

/** Both rects are in the same (viewport) coordinate space, e.g. from getBoundingClientRect(). */
export function tileScissor(track: RectLike, canvas: RectLike): Scissor {
  const offscreen =
    track.width <= 0 ||
    track.height <= 0 ||
    track.bottom < canvas.top ||
    track.top > canvas.bottom ||
    track.right < canvas.left ||
    track.left > canvas.right;
  return {
    left: track.left - canvas.left,
    bottom: canvas.bottom - track.bottom,
    width: track.width,
    height: track.height,
    offscreen,
  };
}
