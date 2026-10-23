import { reatomComponent } from "@reatom/react";
import {
  Bell,
  Cake,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CookingPot,
  Images,
  ListTodo,
  NotebookPen,
  PawPrint,
  PiggyBank,
  Syringe,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { PhotoThumbs, PhotoViewer } from "@/common/photo-viewer";
import { Button, CheckButton, Chip, PersonAvatar, Section, SectionItem } from "@/common/ui";

import type { FeedRow } from "../feed.lib.ts";
import { feedFilters, type FeedModel } from "../vm/feed.vm.ts";

const icons: Record<FeedRow["kind"], LucideIcon> = {
  event: CalendarDays,
  reminder: Bell,
  plan: ListTodo,
  due: Syringe,
  birthday: Cake,
  care: PawPrint,
  goal: PiggyBank,
  upload: Images,
  cooked: CookingPot,
  done: CircleCheck,
  joined: UserPlus,
};

type RowProps = { row: FeedRow; model: FeedModel };

function RecordAction({ row, model }: RowProps) {
  return row.canRecord ? (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        model.record(row.key);
      }}
    >
      <NotebookPen /> Записать
    </Button>
  ) : undefined;
}

function checkOf({ row, model }: RowProps) {
  return (
    row.canComplete && (
      <CheckButton
        label={`Отметить выполненным: ${row.title}`}
        isAlert={row.isOverdue}
        disabled={model.isChanging()}
        onClick={() => {
          model.complete(row.key);
        }}
      />
    )
  );
}

// A Plan closes with the circle at its start and opens from the rest of the row. A Due Date has a
// button of its own, so its row cannot be a button too and opens through a chevron instead.
const FeedRowItem = reatomComponent(({ row, model }: RowProps) => {
  const check = checkOf({ row, model });

  function open() {
    model.open(row.key);
  }

  return (
    <>
      <SectionItem
        icon={row.isOverdue ? TriangleAlert : icons[row.kind]}
        isAlert={row.isOverdue}
        {...(row.author === undefined ? {} : { leading: <PersonAvatar member={row.author} /> })}
        {...(check === false ? {} : { control: check })}
        title={row.title}
        subtitle={row.subtitle}
        after={
          row.canRecord && (
            <>
              <RecordAction row={row} model={model} />
              <Button size="icon-sm" variant="ghost" aria-label="Открыть" onClick={open}>
                <ChevronRight />
              </Button>
            </>
          )
        }
        onClick={row.canRecord ? undefined : open}
      />
      <PhotoThumbs
        photos={row.photos}
        more={row.morePhotos}
        className="flex gap-1 pr-4 pb-2 pl-14"
        thumbClassName="size-16 rounded-md"
        onOpen={(photoId) => {
          model.viewer.open(row.photos, photoId);
        }}
      />
    </>
  );
}, "FeedRowItem");

export const Feed = reatomComponent(({ model }: { model: FeedModel }) => {
  const blocks = model.blocks();

  return (
    <>
      <div className="-mt-1 flex flex-wrap gap-2 px-4 pb-5">
        {feedFilters.map(({ value, title }) => (
          <Chip
            key={value}
            isSelected={model.filter() === value}
            onClick={() => {
              model.choose(value);
            }}
          >
            {title}
          </Chip>
        ))}
      </div>
      {blocks.length === 0 && !model.isLoading() && (
        <Section>
          <SectionItem title="Пока пусто: планы, события и записи о питомце появятся здесь" />
        </Section>
      )}
      {blocks.map((block) => (
        <Section key={block.title} title={block.title}>
          {block.rows.map((row) => (
            <FeedRowItem key={row.key} row={row} model={model} />
          ))}
        </Section>
      ))}
      {model.canLoadMore() && (
        <div className="px-4 pb-6">
          <Button className="w-full" variant="secondary" onClick={model.loadMore}>
            Показать ещё
          </Button>
        </div>
      )}
      <PhotoViewer model={model.viewer} />
    </>
  );
}, "Feed");
