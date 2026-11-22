import { ARENA_HEIGHT, ARENA_WIDTH } from './types.ts';

export interface TableSeatCoord {
  x: number;
  y: number;
  angle: number; // angle from table center outward
}

export const TABLE_CENTER_X = ARENA_WIDTH / 2;
export const TABLE_CENTER_Y = ARENA_HEIGHT / 2 + 8;

/**
 * Computes exact seat coordinates around the oval card table for `total` players.
 * Shared by both server flying-card physics and client table canvas renderers.
 */
export function getCardSeatPosition(index: number, total: number): TableSeatCoord {
  const n = Math.max(1, total);
  // Start P1 at bottom-center (PI/2) and step clockwise around the oval table
  const angle = Math.PI * 0.5 + (index / n) * Math.PI * 2;
  const rx = n <= 2 ? 360 : n <= 4 ? 415 : 445;
  const ry = n <= 2 ? 215 : 230;
  return {
    x: TABLE_CENTER_X + Math.cos(angle) * rx,
    y: TABLE_CENTER_Y + Math.sin(angle) * ry,
    angle,
  };
}
