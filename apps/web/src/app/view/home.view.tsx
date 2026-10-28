import { reatomComponent } from "@reatom/react";
import { useEffect, type ReactNode } from "react";

import type { AppModule } from "@family-hub/contract";

import { Albums, type AlbumsScreenModel } from "@/modules/albums";
import {
  CommandSheet,
  Microphone,
  type CommandSheetModel,
  type MicrophoneModel,
} from "@/modules/command";
import type { FamilyModel } from "@/modules/family";
import { Feed, type FeedModel } from "@/modules/feed";
import { Goals, type GoalsScreenModel } from "@/modules/goals";
import type { InvitesModel } from "@/modules/invites";
import {
  NotificationsBanner,
  type DigestModel,
  type HomeScreenModel,
  type NotificationsModel,
  type TimeZoneModel,
} from "@/modules/member-settings";
import { PetTab, type PetTabModel } from "@/modules/pets";
import type { PhotoStorageModel } from "@/modules/photo-storage";
import { Recipes, type RecipesScreenModel } from "@/modules/recipes";
import type { SessionModel } from "@/modules/session";
import {
  Sections,
  TabBar,
  TabBarMenu,
  type SectionsModel,
  type TabBarMenuModel,
  type TabBarModel,
} from "@/modules/tab-bar";
import { Tasks, type TasksScreenModel } from "@/modules/tasks";
import { Today, type TodayModel } from "@/modules/today";
import { ModulePage } from "@/pages/module";
import { ProfilePage } from "@/pages/profile";

import type { NavigationModel, Screen } from "../app.route.ts";

export type HomeProps = {
  navigation: NavigationModel;
  session: SessionModel;
  tabBar: TabBarModel;
  tabBarMenu: TabBarMenuModel;
  today: TodayModel;
  sections: SectionsModel;
  notifications: NotificationsModel;
  timeZone: TimeZoneModel;
  digest: DigestModel;
  homeScreen: HomeScreenModel;
  family: FamilyModel;
  invites: InvitesModel;
  pet: PetTabModel;
  feed: FeedModel;
  goals: GoalsScreenModel;
  albums: AlbumsScreenModel;
  recipes: RecipesScreenModel;
  tasks: TasksScreenModel;
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
  tasks: ({ tasks }) => ({ title: tasks.title(), content: <Tasks model={tasks} /> }),
  pet: ({ pet }) => ({ title: pet.title(), content: <PetTab model={pet} /> }),
  goals: ({ goals }) => ({ title: goals.title(), content: <Goals model={goals} /> }),
  albums: ({ albums }) => ({ title: albums.title(), content: <Albums model={albums} /> }),
  recipes: ({ recipes }) => ({ title: recipes.title(), content: <Recipes model={recipes} /> }),
};

function pageOf(props: HomeProps, { title, subtitle, content }: ModuleContent): ReactNode {
  const { navigation, notifications } = props;

  return (
    <ModulePage
      title={title}
      subtitle={subtitle}
      banner={<NotificationsBanner model={notifications} />}
      onOpenProfile={navigation.hasProfileButton ? navigation.openProfile : undefined}
    >
      {content}
    </ModulePage>
  );
}

function contentOf(props: HomeProps): ReactNode {
  const screen = props.navigation.screen();

  if (screen.kind === "today") {
    return pageOf(props, {
      title: "Сегодня",
      subtitle: props.today.header(),
      content: <Today model={props.today} />,
    });
  }

  if (screen.kind === "sections") {
    return <Sections model={props.sections} />;
  }

  if (screen.kind === "tab-bar-menu") {
    return <TabBarMenu model={props.tabBarMenu} />;
  }

  return screen.kind === "profile"
    ? profileOf(props)
    : pageOf(props, contents[screen.module](props));
}

// Every screen keeps the tab bar and the microphone: there are no hidden modules any more.
function screenOf(props: HomeProps): ReactNode {
  return (
    <>
      {contentOf(props)}
      <TabBar model={props.tabBar} center={<Microphone model={props.microphone} />} />
      <CommandSheet model={props.commandSheet} />
    </>
  );
}

function screenKeyOf(screen: Screen): string {
  return screen.kind === "module" ? `${screen.module}:${screen.petId ?? ""}` : screen.kind;
}

// A new screen takes focus to its heading, so a screen reader announces where the Member is.
export const Home = reatomComponent((props: HomeProps) => {
  const screenKey = screenKeyOf(props.navigation.screen());

  useEffect(() => {
    document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
  }, [screenKey]);

  return (
    <main className="min-h-svh bg-secondary pt-safe-top pb-safe-bottom has-[>nav]:pb-[calc(var(--safe-area-bottom)+6rem)] has-[>nav]:has-[[data-undo]]:pb-[calc(var(--safe-area-bottom)+10rem)]">
      {screenOf(props)}
    </main>
  );
}, "Home");
