import { reatomComponent } from "@reatom/react";
import type { ReactNode } from "react";

import type { FamilyModel } from "@/modules/family";
import type { InvitesModel } from "@/modules/invites";
import { NotificationsBanner, type NotificationsModel } from "@/modules/notifications";
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
  family: FamilyModel;
  invites: InvitesModel;
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
        banner={<NotificationsBanner model={notifications} />}
        onOpenProfile={navigation.hasProfileButton ? navigation.openProfile : undefined}
      />
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
