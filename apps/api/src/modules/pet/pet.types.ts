import type { Pet } from "@family-hub/contract";

import type { Clock } from "@/common/clock";

import type { PetRepo } from "./pet.repo.ts";

// A Pet's birthday and Due Date Reminders live in the reminder module; the app wires this port.
export type PetSchedule = { petChanged(familyId: string, petId: string): Promise<void> };

export type PetDependencies = { pets: PetRepo; clock: Clock; schedule: PetSchedule };

export type PetRefusal = "not-found" | "archived" | "not-owner" | "name-mismatch";

export type PetResult = { status: "ok"; pet: Pet } | { status: PetRefusal };
