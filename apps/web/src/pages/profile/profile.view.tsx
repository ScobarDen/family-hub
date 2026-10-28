import { ScreenTitle, Section } from "@/common/ui";
import { Family, FamilyExit, type FamilyModel } from "@/modules/family";
import { Invites, type InvitesModel } from "@/modules/invites";
import {
  DigestSetting,
  HomeScreenSetting,
  NotificationsSetting,
  TimeZone,
  type DigestModel,
  type HomeScreenModel,
  type NotificationsModel,
  type TimeZoneModel,
} from "@/modules/member-settings";
import { PhotoStorage, type PhotoStorageModel } from "@/modules/photo-storage";

type ProfilePageProps = {
  memberName: string;
  familyName: string;
  notifications: NotificationsModel;
  timeZone: TimeZoneModel;
  digest: DigestModel;
  homeScreen: HomeScreenModel;
  family: FamilyModel;
  invites: InvitesModel;
  photoStorage: PhotoStorageModel;
};

export function ProfilePage({
  memberName,
  familyName,
  notifications,
  timeZone,
  digest,
  homeScreen,
  family,
  invites,
  photoStorage,
}: ProfilePageProps) {
  return (
    <>
      <ScreenTitle title={memberName} subtitle={familyName} />
      <Section title="Уведомления">
        <NotificationsSetting model={notifications} />
        <DigestSetting model={digest} />
      </Section>
      <Section title="Время">
        <TimeZone model={timeZone} />
      </Section>
      <Section title="Приложение">
        <HomeScreenSetting model={homeScreen} />
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
