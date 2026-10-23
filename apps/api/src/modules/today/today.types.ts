import type { TodayTiles } from "@family-hub/contract";

import type { Membership } from "@/common/auth";

// The viewer's today in their zone and the moment the hub is asked for.
export type TileWindow = { today: string; timeZone: string; now: number };

export type TileSource<Section extends keyof TodayTiles> = {
  tile(viewer: Membership, window: TileWindow): Promise<TodayTiles[Section]>;
};

export type TileSources = { [Section in keyof TodayTiles]: TileSource<Section> };
