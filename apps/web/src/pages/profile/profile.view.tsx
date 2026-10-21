import { PanelBottom } from "lucide-react";

import { ScreenTitle, Section, SectionItem } from "@/common/ui";
import { Family, FamilyExit, type FamilyModel } from "@/modules/family";
import { Invites, type InvitesModel } from "@/modules/invites";
import { NotificationsSetting, type NotificationsModel } from "@/modules/notifications";
import { PhotoStorage, type PhotoStorageModel } from "@/modules/photo-storage";
import { HiddenModules, type TabBarModel } from "@/modules/tab-bar";
import { TimeZone, type TimeZoneModel } from "@/modules/time-zone";

type ProfilePageProps = {
  memberName: string;
  familyName: string;
  tabBar: TabBarModel;
  notifications: NotificationsModel;
  timeZone: TimeZoneModel;
  family: FamilyModel;
  invites: InvitesModel;
  photoStorage: PhotoStorageModel;
  onOpenTabBarMenu: () => void;
};

export function ProfilePage({
  memberName,
  familyName,
  tabBar,
  notifications,
  timeZone,
  family,
  invites,
  photoStorage,
  onOpenTabBarMenu,
}: ProfilePageProps) {
  return (
    <>
      <ScreenTitle title={memberName} subtitle={familyName} />
      <Section title="Разделы">
        <HiddenModules model={tabBar} />
        <SectionItem
          icon={PanelBottom}
          tone="blue"
          title="Нижнее меню"
          onClick={onOpenTabBarMenu}
        />
      </Section>
      <Section title="Уведомления">
        <NotificationsSetting model={notifications} />
      </Section>
      <Section title="Время">
        <TimeZone model={timeZone} />
      </Section>
      <Section title="Семья">
        <Family model={family} />
      </Section>
      <Invites model={invites} />
      <PhotoStorage model={photoStorage} />
      <FamilyExit model={family} />
    </>
  );
}
