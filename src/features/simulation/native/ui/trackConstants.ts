import type { ObstacleKind, Surface, TrackCondition } from "../../engine/engine";

export const CONDITION_LABEL: Record<TrackCondition, string> = { GOOD: "Tốt (khô)", WET: "Ướt", HEAVY: "Lầy" };
export const OBSTACLE_LABEL: Record<ObstacleKind, string> = { RAIL: "Rào thấp", HAY: "Kiện rơm", MUD: "Vũng bùn" };
export const SURFACE_LABEL: Record<Surface, string> = { GRASS: "Cỏ", SAND: "Cát", MIXED: "Hỗn hợp" };
export const DISTANCES: number[] = [800, 1000, 1200, 1600, 2000];
