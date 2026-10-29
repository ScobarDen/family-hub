import { eq } from "drizzle-orm";

import { createDb, families, familyMembers, members, pets, type Db } from "@/modules/db";

import type { FakeClock } from "./fake-clock.ts";

type MemberFixture = { telegramId: number; name: string };

function audit(clock: FakeClock, createdBy: string) {
  return { createdAt: clock.now(), createdBy, updatedAt: clock.now() };
}

async function insertMember(db: Db, clock: FakeClock, { telegramId, name }: MemberFixture) {
  const id = crypto.randomUUID();

  await db
    .insert(members)
    .values({ id, telegramId, name, createdAt: clock.now(), updatedAt: clock.now() });

  return id;
}

async function insertFamily(
  db: Db,
  clock: FakeClock,
  { name, ownerId }: { name: string; ownerId: string },
) {
  const id = crypto.randomUUID();

  await db.insert(families).values({ id, name, ownerMemberId: ownerId, ...audit(clock, ownerId) });

  return id;
}

async function join(
  db: Db,
  clock: FakeClock,
  { familyId, memberId }: { familyId: string; memberId: string },
) {
  await db.insert(familyMembers).values({ familyId, memberId, ...audit(clock, memberId) });
}

// The channel handshake has tests of its own; photo tests start from a connected channel.
async function setPhotoChannel(
  db: Db,
  { familyId, channelId }: { familyId: string; channelId: number | null },
) {
  await db
    .update(families)
    .set({
      photoChannelId: channelId,
      photoChannelTitle: channelId === null ? null : "Фото Гущиных",
      isPhotoChannelConnected: channelId !== null,
    })
    .where(eq(families.id, familyId));
}

export function createFamilyFixtures(d1: D1Database, clock: FakeClock) {
  const db = createDb(d1);

  return {
    async addFamily({ name, owner }: { name: string; owner: MemberFixture }) {
      const ownerId = await insertMember(db, clock, owner);
      const familyId = await insertFamily(db, clock, { name, ownerId });

      await join(db, clock, { familyId, memberId: ownerId });

      return { familyId, ownerId };
    },
    async addMember(familyId: string, member: MemberFixture) {
      const memberId = await insertMember(db, clock, member);

      await join(db, clock, { familyId, memberId });

      return memberId;
    },
    // What a 403 from the bot will leave behind once Reminders are delivered.
    async markUnreachable(memberId: string) {
      await db.update(members).set({ canMessage: false }).where(eq(members.id, memberId));
    },
    // A tab bar saved before the two slots, which the API no longer accepts.
    async setTabBar(memberId: string, tabBar: string[]) {
      await db.update(members).set({ tabBar }).where(eq(members.id, memberId));
    },
    async leaveFamily(memberId: string) {
      await db.delete(familyMembers).where(eq(familyMembers.memberId, memberId));
    },
    setPhotoChannel: async (familyId: string, channelId: number | null) =>
      setPhotoChannel(db, { familyId, channelId }),
    // Pet deletion arrives with the Pet archive; until then the cascade is checked straight in the database.
    async deletePet(petId: string) {
      await db.delete(pets).where(eq(pets.id, petId));
    },
    async rowCounts() {
      return {
        members: await db.$count(members),
        families: await db.$count(families),
        familyMembers: await db.$count(familyMembers),
      };
    },
  };
}
