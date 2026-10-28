import { reatomComponent } from "@reatom/react";
import { ImagePlus, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";

import { SignedPhoto } from "@/common/photo";
import { Button, FilePick } from "@/common/ui";

import type { PetCard } from "../pets.lib.ts";
import type { PetsScreenModel } from "../vm/pets.vm.ts";

type PetAvatarProps = { card: PetCard; model: PetsScreenModel };

const overlayButton = "flex size-9 items-center justify-center rounded-full bg-background/80";

const AvatarImage = reatomComponent(({ src, card, model }: PetAvatarProps & { src: string }) => {
  const change = model.avatarChange();
  const isSaving = model.isAvatarSaving();

  return (
    <div className="relative">
      <SignedPhoto
        src={src}
        alt={card.name}
        className="aspect-square w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
      />
      {change !== undefined && (
        <div className="absolute top-2 right-2 flex gap-2 [&_svg]:size-4">
          {isSaving && (
            <span className={overlayButton}>
              <LoaderCircle className="animate-spin" aria-label="Сохраняем" />
            </span>
          )}
          {!isSaving && change.canUpload && (
            <FilePick className={overlayButton} onPick={model.uploadAvatar}>
              <RefreshCw aria-hidden />
              <span className="sr-only">Заменить фото</span>
            </FilePick>
          )}
          {!isSaving && (
            <Button
              size="icon"
              variant="secondary"
              className={overlayButton}
              aria-label="Убрать фото"
              onClick={model.removeAvatar}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}, "AvatarImage");

const AvatarPlaceholder = reatomComponent(({ model }: Pick<PetAvatarProps, "model">) => {
  if (model.avatarChange()?.canUpload !== true) {
    return null;
  }

  if (model.isAvatarSaving()) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed text-muted-foreground">
        <LoaderCircle className="animate-spin" aria-label="Загружаем" />
      </div>
    );
  }

  return (
    <FilePick
      className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground"
      onPick={model.uploadAvatar}
    >
      <ImagePlus aria-hidden />
      <span className="text-sm">Добавить фото</span>
    </FilePick>
  );
}, "AvatarPlaceholder");

export const PetAvatar = reatomComponent(({ card, model }: PetAvatarProps) => {
  const change = model.avatarChange();

  if (card.avatar === undefined && change === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      {card.avatar === undefined ? (
        <AvatarPlaceholder model={model} />
      ) : (
        <AvatarImage src={card.avatar} card={card} model={model} />
      )}
      {change?.hint !== undefined && <p className="text-sm text-muted-foreground">{change.hint}</p>}
    </div>
  );
}, "PetAvatar");
