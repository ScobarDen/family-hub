import { context, noop } from "@reatom/core";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import type { FamilyMemberList } from "@family-hub/contract";

import { createHttpClient } from "@/common/http-client";

import { createFamilyApi } from "../family.api.ts";
import { reatomFamily } from "./family.vm.ts";

const members: FamilyMemberList = [
  { id: "member-1", name: "Денис", isFamilyOwner: true },
  { id: "member-2", name: "Ася", isFamilyOwner: false },
];

function startFamily(reply: FamilyMemberList | Error = members) {
  const client = createHttpClient({
    baseUrl: "https://api.family-hub.test",
    fetch: async () => {
      if (reply instanceof Error) {
        throw reply;
      }

      return Response.json(reply);
    },
  });
  const model = reatomFamily({ api: createFamilyApi(client) });

  model.members.subscribe(noop);

  return model;
}

beforeEach(() => {
  context.reset();
});

describe("the Family's Members in the Profile", () => {
  test("lists everyone and marks the Family Owner", async () => {
    const model = startFamily();

    await vi.waitFor(() => {
      expect(model.members()).toEqual([
        { id: "member-1", name: "Денис", isFamilyOwner: true, role: "Владелец" },
        { id: "member-2", name: "Ася", isFamilyOwner: false, role: undefined },
      ]);
    });
  });

  test("says so when the list cannot load", async () => {
    const model = startFamily(new TypeError("Failed to fetch"));

    await vi.waitFor(() => {
      expect(model.failure()).toBe("Не получилось загрузить участников.");
    });
  });
});
