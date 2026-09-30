import { DEFAULT_OBSTACLES, DEFAULT_SETTINGS, FIELD } from './plannerConfig';
import type { Alliance, GameId, Obstacle, PlannerSettings, Waypoint } from './types';

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export interface FieldSize {
  width: number;
  height: number;
}

export interface GameConfig {
  id: GameId;
  shortLabel: string;
  headerLabel: string;
  field: FieldSize;
  // Background reference-grid line spacing, in inches. Should match the real tile size so the
  // grid stays visually aligned with tile-based obstacles/waypoints instead of drifting off them.
  gridSpacing: number;
  // Waypoint marker radius, in field inches (scaled to pixels like everything else, with a small
  // pixel floor for visibility). Smaller fields need a smaller marker so it doesn't dwarf the tiles.
  waypointMarkerIn: number;
  defaultSettings: PlannerSettings;
  defaultObstacles: Obstacle[];
  // Bump this whenever defaultObstacles' geometry changes, so a stale locally-persisted obstacle
  // layout from a previous version of this file gets replaced by the fresh defaults on load
  // instead of silently sticking around (see the game-state load effect in App.tsx).
  obstaclesVersion: number;
  originInfoTitle: string;
  originInfoLines: string[];
  // Whether internal waypoint.x is stored as the *negative* of the real/robot X coordinate.
  // (Legacy convention kept for FRC 2026 so existing saved paths / behavior don't change.)
  negateX: boolean;
  // 'direct'   -> heading 0deg already lines up with the canvas +x axis (no calibration needed)
  // 'hubCalibrated' -> heading 0deg is calibrated against a reference obstacle (FRC hub)
  zeroAngleMode: 'direct' | 'hubCalibrated';
  userToImg: (ux: number, uy: number, field: FieldSize) => { imgX: number; imgY: number };
  imgToUser: (ix: number, iy: number, field: FieldSize) => { x: number; y: number };
  generateCode: (waypoints: Waypoint[], alliance: Alliance, settings: PlannerSettings) => string;
}

const FRC_GAME: GameConfig = {
  id: 'frc2026',
  shortLabel: 'FRC 2026',
  headerLabel: 'FRC 2026 // REBUILT Path Planner',
  field: FIELD,
  gridSpacing: 24,
  waypointMarkerIn: 4.2,
  defaultSettings: DEFAULT_SETTINGS,
  defaultObstacles: DEFAULT_OBSTACLES,
  obstaclesVersion: 1,
  originInfoTitle: 'Blue outpost corner (top-right) - (0,0)',
  originInfoLines: ['+X right and +Y forward', 'θ heading with max turn-rate limiting in simulation'],
  negateX: true,
  zeroAngleMode: 'hubCalibrated',
  userToImg: (ux, uy, field) => ({ imgX: field.width - uy, imgY: ux }),
  imgToUser: (ix, iy, field) => ({ x: iy, y: field.width - ix }),
  generateCode: (waypoints, alliance, settings) => {
    if (!waypoints.length) return '// No waypoints yet';
    const s = waypoints[0];
    const e = waypoints[waypoints.length - 1];
    const lines: string[] = [
      '// FRC 2026 REBUILT - Auto Path',
      `// Alliance: ${alliance.toUpperCase()} | WPs: ${waypoints.length} | theta CW+, 0°=toward RED HUB`,
      `// Limits: v=${fmt(settings.maxVel)} in/s, a=${fmt(settings.maxAccel)} in/s^2, decel=${fmt(settings.maxDecel)} in/s^2, turn=${fmt(settings.maxTurnRate)} deg/s`,
      '',
      `TrcPose2D startPose = new TrcPose2D(${fmt(-s.x)}, ${fmt(s.y)}, ${fmt(s.heading)});`,
      `TrcPose2D endPose   = new TrcPose2D(${fmt(-e.x)}, ${fmt(e.y)}, ${fmt(e.heading)});`,
    ];
    if (waypoints.length > 2) {
      lines.push('');
      lines.push('// Intermediate waypoints');
      waypoints.slice(1, -1).forEach((wp, i) => {
        lines.push(`TrcPose2D wp${i + 1} = new TrcPose2D(${fmt(-wp.x)}, ${fmt(wp.y)}, ${fmt(wp.heading)});`);
      });
    }
    lines.push('');
    lines.push('// Pure Pursuit path array');
    if (waypoints.length === 2) {
      lines.push('TrcPose2D[] path = new TrcPose2D[] { startPose, endPose };');
    } else {
      const mids = waypoints.slice(1, -1).map((_, i) => `wp${i + 1}`).join(', ');
      lines.push('TrcPose2D[] path = new TrcPose2D[] {');
      lines.push(`    startPose, ${mids}, endPose`);
      lines.push('};');
    }
    return lines.join('\n');
  },
};

// FTC 2027 BIOBUZZ field geometry, derived from the team's own RobotParams.java constants:
// fullFieldInches = 141.24, tile = fullFieldInches / 6 = 23.54, origin = center of field (0,0).
const FTC_FULL = 141.24;
const FTC_HALF = FTC_FULL / 2; // 70.62

export const FTC_FIELD: FieldSize = { width: FTC_FULL, height: FTC_FULL };

export const FTC_DEFAULT_SETTINGS: PlannerSettings = {
  robotW: 18,
  robotL: 18,
  showGrid: true,
  showGhost: true,
  snap: 0,
  maxVel: 40,
  maxAccel: 60,
  maxDecel: 60,
  maxTurnRate: 360,
};

// Game manual dimensions (BIOBUZZ, Section 9 ARENA).
const LZ_LEN = 23; // LOADING ZONE: ~23in along the wall
const LZ_DEPTH = 11; // ~11in deep into the field
const GARDEN_LEN = 23; // GARDEN: ~23in along the wall
const GARDEN_DEPTH = 2; // ~2in deep (thin tape strip)
const HIVE_FRAME_W = 49.46; // combined red+blue HIVE frame width
const HIVE_FRAME_D = 38.95; // combined red+blue HIVE frame depth
const FLOWER_D = 5; // ~4in FLOWER opening, drawn slightly larger for visibility
const TILE = FTC_FULL / 6; // ~23.54in, used to snap FLOWER positions exactly onto tile gridlines
// Starting game pieces (manual 9.8 / 10.3.1). Each group is one 'balls' obstacle: `count` circles
// spread along its long axis, touching. POLLEN (yellow, 2.8in): 4 in a line in each GARDEN, starting in
// the corner nearest that alliance's area and against the wall. NECTAR (3.6in): 3 in a line in the
// upward-facing CELL of each HIVE, against the cell side nearest the matching ALLIANCE AREA.
const GARDEN_BALL_D = 2.8;
const GARDEN_BALL_COUNT = 4;
const GARDEN_BALLS_LEN = GARDEN_BALL_COUNT * GARDEN_BALL_D;
const HIVE_BALL_D = 3.6;
const HIVE_BALL_COUNT = 3;
const HIVE_BALLS_LEN = HIVE_BALL_COUNT * HIVE_BALL_D;
// These mirror the hive shape drawn in App.tsx (cell centers offset 0.26*depth from the hive center;
// each cell is a hexagon 0.95*width wide that narrows toward the pivot bar).
const HIVE_CELL_OFFSET = HIVE_FRAME_D * 0.26;
const HIVE_CELL_HALF_W = ((HIVE_FRAME_W / 2) * 0.95) / 2;
const HIVE_BALL_ROW_HALF_W = HIVE_CELL_HALF_W * 0.71; // cell half-width at the ball row
const HIVE_BALL_ROW_TOWARD_PIVOT = 2.5; // balls rest toward the pivot end of the cell
const HIVE_BALL_INSET = 0.8; // keeps the end ball inside the slanted cell edge

// All obstacle cx/cy/w/h are in field-IMAGE pixel space (origin top-left), matching how
// DEFAULT_OBSTACLES works for FRC. imgX = HALF + userY, imgY = HALF + userX (see userToImg below),
// so image-left = red alliance (Y-), image-right = blue alliance (Y+), image-top = X-, image-bottom = X+.
// LOADING ZONE sits against the wall shared with its own ALLIANCE AREA (left wall = red, right = blue),
// near one corner; GARDEN sits against the opposite (top/bottom) wall, near the diagonal corner.
// Exact positions below are hand-placed/verified by the team against the field reference
// (no longer derived purely from the corner-flush formulas), so they're written as literals.
export const FTC_DEFAULT_OBSTACLES: Obstacle[] = [
  { id: 'loadingzone_red', cx: 5.5, cy: 35.5, w: LZ_DEPTH, h: LZ_LEN, label: 'RED LOADING ZONE', color: '#ff5a5a', blocked: false, category: 'trench' },
  { id: 'garden_blue', cx: 129.74, cy: 1, w: GARDEN_LEN, h: GARDEN_DEPTH, label: 'BLUE GARDEN', color: '#4a9eff', blocked: false, category: 'depot' },
  { id: 'garden_red', cx: 11.5, cy: 140.24, w: GARDEN_LEN, h: GARDEN_DEPTH, label: 'RED GARDEN', color: '#ff5a5a', blocked: false, category: 'depot' },
  { id: 'loadingzone_blue', cx: 135.74, cy: FTC_FULL - 35.5, w: LZ_DEPTH, h: LZ_LEN, label: 'BLUE LOADING ZONE', color: '#4a9eff', blocked: false, category: 'trench' },
  // FLOWERs sit right on a tile gridline, flush against their wall (center offset = radius).
  { id: 'flower_nw', cx: 2 * TILE, cy: FLOWER_D / 2, w: FLOWER_D, h: FLOWER_D, label: 'FLOWER', color: '#f7b731', blocked: false, category: 'flower' },
  { id: 'flower_ne', cx: FTC_FULL - FLOWER_D / 2, cy: 2 * TILE, w: FLOWER_D, h: FLOWER_D, label: 'FLOWER', color: '#f7b731', blocked: false, category: 'flower' },
  { id: 'flower_sw', cx: FLOWER_D / 2, cy: 4 * TILE, w: FLOWER_D, h: FLOWER_D, label: 'FLOWER', color: '#f7b731', blocked: false, category: 'flower' },
  { id: 'flower_se', cx: 4 * TILE, cy: FTC_FULL - FLOWER_D / 2, w: FLOWER_D, h: FLOWER_D, label: 'FLOWER', color: '#f7b731', blocked: false, category: 'flower' },
  { id: 'hive_red', cx: FTC_HALF - HIVE_FRAME_W / 4, cy: FTC_HALF, w: HIVE_FRAME_W / 2, h: HIVE_FRAME_D, label: 'RED HIVE', color: '#ff5a5a', blocked: true, category: 'hive' },
  { id: 'hive_blue', cx: FTC_HALF + HIVE_FRAME_W / 4, cy: FTC_HALF, w: HIVE_FRAME_W / 2, h: HIVE_FRAME_D, label: 'BLUE HIVE', color: '#4a9eff', blocked: true, category: 'hive' },
  // Balls are listed last so they draw on top of the garden/hive shapes.
  { id: 'garden_blue_balls', cx: FTC_FULL - GARDEN_BALLS_LEN / 2, cy: GARDEN_BALL_D / 2, w: GARDEN_BALLS_LEN, h: GARDEN_BALL_D, label: 'BLUE GARDEN BALLS', color: '#ffd83d', blocked: false, category: 'balls', count: GARDEN_BALL_COUNT },
  { id: 'garden_red_balls', cx: GARDEN_BALLS_LEN / 2, cy: FTC_FULL - GARDEN_BALL_D / 2, w: GARDEN_BALLS_LEN, h: GARDEN_BALL_D, label: 'RED GARDEN BALLS', color: '#ffd83d', blocked: false, category: 'balls', count: GARDEN_BALL_COUNT },
  { id: 'hive_red_balls', cx: FTC_HALF - HIVE_FRAME_W / 4 - HIVE_BALL_ROW_HALF_W + HIVE_BALL_INSET + HIVE_BALLS_LEN / 2, cy: FTC_HALF + HIVE_CELL_OFFSET - HIVE_BALL_ROW_TOWARD_PIVOT, w: HIVE_BALLS_LEN, h: HIVE_BALL_D, label: 'RED HIVE BALLS', color: '#ff5a5a', blocked: false, category: 'balls', count: HIVE_BALL_COUNT },
  { id: 'hive_blue_balls', cx: FTC_HALF + HIVE_FRAME_W / 4 + HIVE_BALL_ROW_HALF_W - HIVE_BALL_INSET - HIVE_BALLS_LEN / 2, cy: FTC_HALF - HIVE_CELL_OFFSET + HIVE_BALL_ROW_TOWARD_PIVOT, w: HIVE_BALLS_LEN, h: HIVE_BALL_D, label: 'BLUE HIVE BALLS', color: '#4a9eff', blocked: false, category: 'balls', count: HIVE_BALL_COUNT },
];

const FTC_GAME: GameConfig = {
  id: 'ftc2027',
  shortLabel: 'FTC 2027',
  headerLabel: 'FTC 2027 // BIOBUZZ Path Planner',
  field: FTC_FIELD,
  gridSpacing: FTC_FULL / 6, // real FTC tile size (~23.54in), so the grid lines up with tiles
  waypointMarkerIn: 2.6, // smaller field, so a smaller marker keeps it from dwarfing the tiles
  defaultSettings: FTC_DEFAULT_SETTINGS,
  defaultObstacles: FTC_DEFAULT_OBSTACLES,
  obstaclesVersion: 9,
  originInfoTitle: 'Center of field - (0,0)',
  originInfoLines: ['+X toward LOADING ZONE / GARDEN wall (downfield), +Y toward BLUE alliance', 'θ: 0°=+Y (blue side), 90°=+X, CW+'],
  negateX: false,
  zeroAngleMode: 'direct',
  userToImg: (ux, uy, field) => ({ imgX: field.width / 2 + uy, imgY: field.height / 2 + ux }),
  imgToUser: (ix, iy, field) => ({ x: iy - field.height / 2, y: ix - field.width / 2 }),
  generateCode: (waypoints, alliance, settings) => {
    if (!waypoints.length) return '// No waypoints yet';
    const s = waypoints[0];
    const e = waypoints[waypoints.length - 1];
    const lines: string[] = [
      '// FTC 2027 BIOBUZZ - Auto Path',
      `// Alliance: ${alliance.toUpperCase()} | WPs: ${waypoints.length} | origin=field center, 0°=+Y, 90°=+X, CW+`,
      `// Limits: v=${fmt(settings.maxVel)} in/s, a=${fmt(settings.maxAccel)} in/s^2, decel=${fmt(settings.maxDecel)} in/s^2, turn=${fmt(settings.maxTurnRate)} deg/s`,
      '',
      `TrcPose2D startPose = new TrcPose2D(${fmt(s.x)}, ${fmt(s.y)}, ${fmt(s.heading)});`,
      `TrcPose2D endPose   = new TrcPose2D(${fmt(e.x)}, ${fmt(e.y)}, ${fmt(e.heading)});`,
    ];
    if (waypoints.length > 2) {
      lines.push('');
      lines.push('// Intermediate waypoints');
      waypoints.slice(1, -1).forEach((wp, i) => {
        lines.push(`TrcPose2D wp${i + 1} = new TrcPose2D(${fmt(wp.x)}, ${fmt(wp.y)}, ${fmt(wp.heading)});`);
      });
    }
    lines.push('');
    lines.push('// Pure Pursuit path array');
    if (waypoints.length === 2) {
      lines.push('TrcPose2D[] path = new TrcPose2D[] { startPose, endPose };');
    } else {
      const mids = waypoints.slice(1, -1).map((_, i) => `wp${i + 1}`).join(', ');
      lines.push('TrcPose2D[] path = new TrcPose2D[] {');
      lines.push(`    startPose, ${mids}, endPose`);
      lines.push('};');
    }
    return lines.join('\n');
  },
};

export const GAMES: Record<GameId, GameConfig> = {
  frc2026: FRC_GAME,
  ftc2027: FTC_GAME,
};

export const GAME_ORDER: GameId[] = ['frc2026', 'ftc2027'];
