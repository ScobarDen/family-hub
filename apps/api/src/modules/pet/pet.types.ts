import type { Pet } from "@family-hub/contract";

import type { Clock } from "@/common/clock.lib.ts";
import type { PhotoLinks } from "@/modules/photo";

import type { PetRepo } from "./pet.repo.ts";

// A Pet's birthday and its Tasks' Reminders live in the reminder module; the app wires this port.
type PetSchedule = {
  sourceChanged(familyId: string, source: { kind: "pet"; id: string }): Promise<void>;
};

export type PetDependencies = {
  pets: PetRepo;
  clock: Clock;
  schedule: PetSchedule;
  links: PhotoLinks;
};

export type PetRefusal =
  | "not-found"
  | "archived"
  | "not-owner"
  | "name-mismatch"
  | "photo-not-found";

export type PetResult = { status: "ok"; pet: Pet } | { status: PetRefusal };
