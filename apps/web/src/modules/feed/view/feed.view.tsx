import { reatomComponent } from "@reatom/react";
import {
  Bell,
  Cake,
  CalendarDays,
  ChevronRight,
  Circle,
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

import { PhotoViewer } from "@/common/photo-viewer";
import { Button, Chip, PersonAvatar, Section, SectionItem } from "@/common/ui";

import type { FeedRow } from "../feed.lib.ts";
import { feedFilters, type FeedModel } from "../vm/feed.vm.ts";
import { FeedPhotos } from "./feed-photos.view.tsx";

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

function RowActions({ row, model }: RowProps) {
  if (row.canComplete) {
    return (
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Выполнено"
        disabled={model.isChanging()}
        onClick={() => {
          model.complete(row.key);
        }}
      >
        <Circle />
      </Button>
    );
  }

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

// A row with its own buttons cannot be a button too, so it opens through a chevron instead.
const FeedRowItem = reatomComponent(({ row, model }: RowProps) => {
  const hasActions = row.canComplete || row.canRecord;

  function open() {
    model.open(row.key);
  }

  return (
    <>
      <SectionItem
        icon={row.isOverdue ? TriangleAlert : icons[row.kind]}
        isAlert={row.isOverdue}
        {...(row.author === undefined ? {} : { leading: <PersonAvatar name={row.author} /> })}
        title={row.title}
        subtitle={row.subtitle}
        after={
          hasActions && (
            <>
              <RowActions row={row} model={model} />
              <Button size="icon-sm" variant="ghost" aria-label="Открыть" onClick={open}>
                <ChevronRight />
              </Button>
            </>
          )
        }
        onClick={hasActions ? undefined : open}
      />
      <FeedPhotos row={row} model={model} />
    </>
  );
}, "FeedRowItem");

export const Feed = reatomComponent(({ model }: { model: FeedModel }) => {
  const blocks = model.blocks();

  return (
    <>
      <div className="-mt-1 flex gap-2 overflow-x-auto px-4 pb-5 [scrollbar-width:none]">
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
