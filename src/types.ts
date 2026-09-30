export type Alliance = 'blue' | 'red';

export type GameId = 'frc2026' | 'ftc2027';

export type Mode = 'add' | 'drag' | 'rotate' | 'delete';

export type TabKey = 'waypoints' | 'output' | 'settings' | 'obstacles' | 'import' | 'paths';

export interface Waypoint {
  x: number;
  y: number;
  heading: number;
}

export interface Obstacle {
  id: string;
  label: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
  color: string;
  blocked: boolean;
  category: 'hub' | 'bump' | 'trench' | 'depot' | 'fuel' | 'hive' | 'flower' | 'balls' | 'other';
  // For category 'balls': how many circles to spread evenly along the rect's long axis.
  count?: number;
}

export interface PlannerSettings {
  robotW: number;
  robotL: number;
  showGrid: boolean;
  showGhost: boolean;
  snap: number;
  maxVel: number;
  maxAccel: number;
  maxDecel: number;
  maxTurnRate: number;
}

export interface PathSample {
  x: number;
  y: number;
  heading: number;
  t: number;
}

export interface SimPath {
  samples: PathSample[];
  totalTime: number;
  totalDist: number;
}
