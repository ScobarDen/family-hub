import type { Pet } from "@family-hub/contract";

import type { Clock } from "@/common/clock";

import type { PetRepo } from "./pet.repo.ts";

export type PetDependencies = { pets: PetRepo; clock: Clock };

export type PetRefusal = "not-found" | "archived" | "not-owner" | "name-mismatch";

export type PetResult = { status: "ok"; pet: Pet } | { status: PetRefusal };
