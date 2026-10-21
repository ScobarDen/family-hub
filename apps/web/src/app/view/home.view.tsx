import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import type { AppModule } from "@family-hub/contract";

import { deviceTimeZone } from "@/common/format-date";
import { Albums, type AlbumsScreenModel } from "@/modules/albums";
import { Calendar, type CalendarModel } from "@/modules/calendar";
import { Care, ExpensesBlock, JournalBlock, PhotosBlock, type CareModel } from "@/modules/care";
import type { DigestModel } from "@/modules/digest";
import type { FamilyModel } from "@/modules/family";
import { Feed, type FeedModel } from "@/modules/feed";
import { Goals, type GoalsScreenModel } from "@/modules/goals";
import type { InvitesModel } from "@/modules/invites";
import { NotificationsBanner, type NotificationsModel } from "@/modules/notifications";
import { Pets, type PetsScreenModel } from "@/modules/pets";
import type { PhotoStorageModel } from "@/modules/photo-storage";
import { Plans, type PlansScreenModel } from "@/modules/plans";
import { Recipes, type RecipesScreenModel } from "@/modules/recipes";
import type { SessionModel } from "@/modules/session";
import { TabBar, TabBarMenu, type TabBarMenuModel, type TabBarModel } from "@/modules/tab-bar";
import type { TimeZoneModel } from "@/modules/time-zone";
import { ModulePage } from "@/pages/module";
import { ProfilePage } from "@/pages/profile";

import type { NavigationModel } from "../app.route.ts";

export type HomeProps = {
  navigation: NavigationModel;
  session: SessionModel;
  tabBar: TabBarModel;
  tabBarMenu: TabBarMenuModel;
  notifications: NotificationsModel;
  timeZone: TimeZoneModel;
  digest: DigestModel;
  family: FamilyModel;
  invites: InvitesModel;
  pets: PetsScreenModel;
  care: CareModel;
  calendar: CalendarModel;
  feed: FeedModel;
  goals: GoalsScreenModel;
  albums: AlbumsScreenModel;
  recipes: RecipesScreenModel;
  plans: PlansScreenModel;
  photoStorage: PhotoStorageModel;
};

function profileOf(props: HomeProps): ReactNode {
  const member = props.session.member();

  return (
    <ProfilePage
      {...props}
      memberName={member?.member.name ?? ""}
      familyName={member?.family.name ?? ""}
      onOpenTabBarMenu={props.navigation.openTabBarMenu}
    />
  );
}

type ModuleContent = { title: string; content: ReactNode };

function petContentOf(pets: PetsScreenModel, care: CareModel): ModuleContent {
  if (care.canGoBack()) {
    return { title: care.title() ?? pets.title(), content: <Care model={care} /> };
  }

  return {
    title: pets.title(),
    content: (
      <Pets
        model={pets}
        expenses={<ExpensesBlock model={care} />}
        journal={<JournalBlock model={care} />}
        photos={<PhotosBlock model={care} />}
      />
    ),
  };
}

function contentOf(
  { pets, plans, care, calendar, feed, goals, albums, recipes, photoStorage }: HomeProps,
  module: AppModule,
): ModuleContent | undefined {
  if (module === "recipes") {
    return {
      title: recipes.title(),
      content: (
        <Recipes
          model={recipes}
          photoHint={photoStorage.uploadHint()}
          timeZone={deviceTimeZone()}
        />
      ),
    };
  }

  if (module === "albums") {
    return { title: albums.title(), content: <Albums model={albums} /> };
  }

  if (module === "goals") {
    return { title: goals.title(), content: <Goals model={goals} /> };
  }

  if (module === "feed") {
    return { title: "Лента", content: <Feed model={feed} /> };
  }

  if (module === "calendar") {
    return { title: calendar.title(), content: <Calendar model={calendar} /> };
  }

  if (module === "pet") {
    return petContentOf(pets, care);
  }

  if (module === "plans") {
    return { title: plans.title(), content: <Plans model={plans} /> };
  }

  return undefined;
}

function screenOf(props: HomeProps): ReactNode {
  const { navigation, tabBar, tabBarMenu, notifications } = props;
  const screen = navigation.screen();

  if (screen.kind === "tab-bar-menu") {
    return <TabBarMenu model={tabBarMenu} />;
  }

  if (screen.kind === "profile") {
    return profileOf(props);
  }

  return (
    <>
      <ModulePage
        module={screen.module}
        title={contentOf(props, screen.module)?.title}
        banner={<NotificationsBanner model={notifications} />}
        onOpenProfile={navigation.hasProfileButton ? navigation.openProfile : undefined}
      >
        {contentOf(props, screen.module)?.content}
      </ModulePage>
      {screen.isOnTabBar && <TabBar model={tabBar} />}
    </>
  );
}

export const Home = reatomComponent(
  (props: HomeProps) => (
    <main className="min-h-svh bg-secondary pt-safe-top pb-safe-bottom has-[>nav]:pb-[calc(var(--safe-area-bottom)+6rem)]">
      {screenOf(props)}
    </main>
  ),
  "Home",
);
