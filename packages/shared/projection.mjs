export const PROJECTION_WIDTH = 1920;
export const PROJECTION_HEIGHT = 1080;
export function projectionScale(width, height) {
  return Math.min(Math.max(0, width) / PROJECTION_WIDTH, Math.max(0, height) / PROJECTION_HEIGHT);
}
