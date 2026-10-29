import type { TodayTiles } from "@family-hub/contract";

import type { Membership } from "@/modules/auth";

export type TileWindow = { today: string; timeZone: string };

export type TileSource<Section extends keyof TodayTiles> = {
  tile(viewer: Membership, window: TileWindow): Promise<NonNullable<TodayTiles[Section]>>;
};

export type TileSources = { [Section in keyof TodayTiles]: TileSource<Section> };
