import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import type { AppModule } from "@family-hub/contract";

import { Albums, type AlbumsScreenModel } from "@/modules/albums";
import { Calendar, type CalendarModel } from "@/modules/calendar";
import {
  CommandSheet,
  Microphone,
  type CommandSheetModel,
  type MicrophoneModel,
} from "@/modules/command";
import type { DigestModel } from "@/modules/digest";
import type { FamilyModel } from "@/modules/family";
import { Feed, type FeedModel } from "@/modules/feed";
import { Goals, type GoalsScreenModel } from "@/modules/goals";
import type { InvitesModel } from "@/modules/invites";
import { NotificationsBanner, type NotificationsModel } from "@/modules/notifications";
import { PetTab, type PetTabModel } from "@/modules/pets";
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
  pet: PetTabModel;
  calendar: CalendarModel;
  feed: FeedModel;
  goals: GoalsScreenModel;
  albums: AlbumsScreenModel;
  recipes: RecipesScreenModel;
  plans: PlansScreenModel;
  photoStorage: PhotoStorageModel;
  microphone: MicrophoneModel;
  commandSheet: CommandSheetModel;
};

function profileOf(props: HomeProps): ReactNode {
  return (
    <ProfilePage
      {...props}
      memberName={props.session.memberName()}
      familyName={props.session.familyName()}
      onOpenTabBarMenu={props.navigation.openTabBarMenu}
    />
  );
}

type ModuleContent = { title: string; subtitle?: string | undefined; content: ReactNode };

const contents: Record<AppModule, (props: HomeProps) => ModuleContent> = {
  feed: ({ feed }) => ({
    title: "Лента",
    subtitle: feed.summary(),
    content: <Feed model={feed} />,
  }),
  plans: ({ plans }) => ({ title: plans.title(), content: <Plans model={plans} /> }),
  calendar: ({ calendar }) => ({ title: calendar.title(), content: <Calendar model={calendar} /> }),
  pet: ({ pet }) => ({ title: pet.title(), content: <PetTab model={pet} /> }),
  goals: ({ goals }) => ({ title: goals.title(), content: <Goals model={goals} /> }),
  albums: ({ albums }) => ({ title: albums.title(), content: <Albums model={albums} /> }),
  recipes: ({ recipes }) => ({ title: recipes.title(), content: <Recipes model={recipes} /> }),
};

function screenOf(props: HomeProps): ReactNode {
  const { navigation, tabBar, tabBarMenu, notifications } = props;
  const screen = navigation.screen();

  if (screen.kind === "tab-bar-menu") {
    return <TabBarMenu model={tabBarMenu} />;
  }

  if (screen.kind === "profile") {
    return profileOf(props);
  }

  const { title, subtitle, content } = contents[screen.module](props);

  return (
    <>
      <ModulePage
        title={title}
        subtitle={subtitle}
        banner={<NotificationsBanner model={notifications} />}
        onOpenProfile={navigation.hasProfileButton ? navigation.openProfile : undefined}
      >
        {content}
      </ModulePage>
      {screen.isOnTabBar && (
        <TabBar model={tabBar} center={<Microphone model={props.microphone} />} />
      )}
      <CommandSheet model={props.commandSheet} />
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
