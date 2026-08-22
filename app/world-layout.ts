export type WorldPoint = { x: number; y: number };

export const WORLD_SCALE = 1;
export const WORLD_CENTER = 50;
export const ROAD_WORLD_LINES = [-28, 0, 28] as const;
export const ROAD_WIDTH = 13;
export const WORLD_LIMIT = 46;
export const PLAYABLE_STREET_BOUNDS = { minX: 4, maxX: 96, minY: 4, maxY: 96 } as const;
export const SCREEN_ROAD_LINES = ROAD_WORLD_LINES.map((line) => WORLD_CENTER + line * WORLD_SCALE);
const WALKABLE_HALF_WIDTH = (ROAD_WIDTH / 2 + 2.4) * WORLD_SCALE;

export const STREET_NPC_POSITIONS: WorldPoint[] = [
  { x: 41, y: 51 },
  { x: 56, y: 81 },
  { x: 41, y: 19 },
];

function nearestRoad(value: number) {
  return SCREEN_ROAD_LINES.reduce((nearest, line) => Math.abs(value - line) < Math.abs(value - nearest) ? line : nearest);
}

export function toWorld(point: WorldPoint): [number, number, number] {
  return [(point.x - WORLD_CENTER) / WORLD_SCALE, 0, (point.y - WORLD_CENTER) / WORLD_SCALE];
}

export function clampToPlayableStreet(point: WorldPoint): WorldPoint {
  let x = Math.min(PLAYABLE_STREET_BOUNDS.maxX, Math.max(PLAYABLE_STREET_BOUNDS.minX, point.x));
  let y = Math.min(PLAYABLE_STREET_BOUNDS.maxY, Math.max(PLAYABLE_STREET_BOUNDS.minY, point.y));
  const nearestX = nearestRoad(x);
  const nearestY = nearestRoad(y);
  const xDistance = Math.abs(x - nearestX);
  const yDistance = Math.abs(y - nearestY);

  // Streets and pavements form a connected grid. If a movement would enter a
  // building block, slide it back to the nearest pavement edge instead.
  if (xDistance > WALKABLE_HALF_WIDTH && yDistance > WALKABLE_HALF_WIDTH) {
    if (xDistance < yDistance) x = nearestX + Math.sign(x - nearestX || 1) * WALKABLE_HALF_WIDTH;
    else y = nearestY + Math.sign(y - nearestY || 1) * WALKABLE_HALF_WIDTH;
  }

  return { x, y };
}

export function worldDistance(a: WorldPoint, b: WorldPoint) {
  return Math.hypot((a.x - b.x) / WORLD_SCALE, (a.y - b.y) / WORLD_SCALE);
}
