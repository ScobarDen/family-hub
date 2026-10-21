import { reatomComponent } from "@reatom/react";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import type { ChangeEvent } from "react";

import { Button, Label } from "@/common/ui";

import type { Attachment, EntryPhotosModel } from "../vm/entry-photos.vm.ts";

type AttachmentsProps = { model: EntryPhotosModel; hint: string | undefined };

function Tile({ item, onRemove }: { item: Attachment; onRemove: () => void }) {
  return (
    <div className="relative size-20 overflow-hidden rounded-lg bg-muted">
      {item.status === "ready" && (
        <img src={item.photo.urls.thumb} alt="" className="size-full object-cover" />
      )}
      {item.status === "uploading" && (
        <LoaderCircle className="absolute inset-0 m-auto animate-spin text-muted-foreground" />
      )}
      {item.status === "failed" && (
        <span className="absolute inset-0 flex items-center p-1 text-center text-xs text-destructive">
          {item.reason}
        </span>
      )}
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        className="absolute top-1 right-1 size-6 rounded-full"
        aria-label="Убрать фото"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

export const PhotoAttachments = reatomComponent(({ model, hint }: AttachmentsProps) => {
  function pick(event: ChangeEvent<HTMLInputElement>) {
    model.add([...(event.target.files ?? [])]);
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Фото</Label>
      <div className="flex flex-wrap gap-2">
        {model.items().map((item) => (
          <Tile
            key={item.key}
            item={item}
            onRemove={() => {
              model.remove(item.key);
            }}
          />
        ))}
        {model.canAdd() && (
          <label className="flex size-20 cursor-pointer items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            <ImagePlus aria-label="Добавить фото" />
            <input type="file" accept="image/*" multiple className="hidden" onChange={pick} />
          </label>
        )}
      </div>
      {hint !== undefined && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}, "PhotoAttachments");
