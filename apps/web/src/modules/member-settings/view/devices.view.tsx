import { reatomComponent } from "@reatom/react";
import { MonitorSmartphone } from "lucide-react";

import { Button, FieldError, Section, SectionItem } from "@/modules/ui";

import type { DevicesModel } from "../vm/devices.vm.ts";

export type DevicesProps = { model: DevicesModel };

export const Devices = reatomComponent(({ model }: DevicesProps) => {
  const devices = model.devices();

  // A Member who never installed the app has nothing to list here.
  if (devices.length === 0) {
    return null;
  }

  return (
    <Section title="Устройства">
      {devices.map(({ id, title, lastUsed, signOutLabel }) => (
        <SectionItem
          key={id}
          icon={MonitorSmartphone}
          title={title}
          subtitle={lastUsed}
          after={
            <Button
              size="sm"
              variant="secondary"
              aria-label={signOutLabel}
              onClick={() => {
                model.revoke(id);
              }}
            >
              Выйти
            </Button>
          }
        />
      ))}
      <FieldError className="px-4 py-2">{model.failure()}</FieldError>
    </Section>
  );
}, "Devices");
