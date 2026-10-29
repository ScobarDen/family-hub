import { Family, FamilyExit, type FamilyModel } from "@/modules/family";
import { Invites, type InvitesModel } from "@/modules/invites";
import {
  AppSetting,
  Devices,
  DigestSetting,
  NotificationsSetting,
  PushSetting,
  ReminderChannelSetting,
  TimeZone,
  type DevicesModel,
  type DigestModel,
  type HomeScreenModel,
  type InstallEntryModel,
  type NotificationsModel,
  type PushModel,
  type ReminderChannelModel,
  type TimeZoneModel,
} from "@/modules/member-settings";
import { PhotoStorage, type PhotoStorageModel } from "@/modules/photo-storage";
import { ScreenTitle, Section } from "@/modules/ui";

type ProfilePageProps = {
  memberName: string;
  familyName: string;
  notifications: NotificationsModel;
  timeZone: TimeZoneModel;
  digest: DigestModel;
  homeScreen: HomeScreenModel;
  installEntry: InstallEntryModel;
  devices: DevicesModel;
  reminderChannel: ReminderChannelModel;
  push: PushModel | undefined;
  family: FamilyModel;
  invites: InvitesModel;
  photoStorage: PhotoStorageModel;
};

export function ProfilePage({ memberName, familyName, ...models }: ProfilePageProps) {
  return (
    <>
      <ScreenTitle title={memberName} subtitle={familyName} />
      <Section title="Уведомления">
        {models.push === undefined ? (
          <NotificationsSetting model={models.notifications} />
        ) : (
          <PushSetting model={models.push} />
        )}
        <DigestSetting model={models.digest} />
        <ReminderChannelSetting model={models.reminderChannel} />
      </Section>
      <Section title="Время">
        <TimeZone model={models.timeZone} />
      </Section>
      <AppSetting installEntry={models.installEntry} homeScreen={models.homeScreen} />
      <Devices model={models.devices} />
      <Section title="Семья">
        <Family model={models.family} />
      </Section>
      <Invites model={models.invites} />
      <PhotoStorage model={models.photoStorage} />
      <FamilyExit model={models.family} />
    </>
  );
}
