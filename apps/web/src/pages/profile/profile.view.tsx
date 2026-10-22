import { PanelBottom } from "lucide-react";

import { ScreenTitle, Section, SectionItem } from "@/common/ui";
import { Family, FamilyExit, type FamilyModel } from "@/modules/family";
import { Invites, type InvitesModel } from "@/modules/invites";
import {
  DigestSetting,
  NotificationsSetting,
  TimeZone,
  type DigestModel,
  type NotificationsModel,
  type TimeZoneModel,
} from "@/modules/member-settings";
import { PhotoStorage, type PhotoStorageModel } from "@/modules/photo-storage";
import { HiddenModules, type TabBarModel } from "@/modules/tab-bar";

type ProfilePageProps = {
  memberName: string;
  familyName: string;
  tabBar: TabBarModel;
  notifications: NotificationsModel;
  timeZone: TimeZoneModel;
  digest: DigestModel;
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
  digest,
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

          title="Нижнее меню"
          onClick={onOpenTabBarMenu}
        />
      </Section>
      <Section title="Уведомления">
        <NotificationsSetting model={notifications} />
        <DigestSetting model={digest} />
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
