import { useState, type ReactNode } from "react";

import { Button } from "./button.view.tsx";
import { Chip } from "./chip.view.tsx";

type LayoutTab = { key: string; title: string; content: ReactNode };

type SectionLayoutProps = {
  summary: ReactNode;
  tabs: LayoutTab[];
  // One primary action, a verb with its object: «Добавить запись», «Внести взнос».
  action?: { title: string; onClick: () => void } | undefined;
};

// The shared layout of a section with a summary: the summary, one primary button, then tabs.
export function SectionLayout({ summary, tabs, action }: SectionLayoutProps) {
  const [chosenKey, setChosenKey] = useState(tabs[0]?.key);
  const shown = tabs.find(({ key }) => key === chosenKey) ?? tabs[0];

  return (
    <>
      {summary}
      {action !== undefined && (
        <div className="px-4 pb-5">
          <Button className="h-11 w-full" onClick={action.onClick}>
            {action.title}
          </Button>
        </div>
      )}
      <div role="tablist" className="flex gap-1.5 overflow-x-auto px-4 pb-4">
        {tabs.map(({ key, title }) => (
          <Chip
            key={key}
            role="tab"
            aria-selected={key === shown?.key}
            isSelected={key === shown?.key}
            onClick={() => {
              setChosenKey(key);
            }}
          >
            {title}
          </Chip>
        ))}
      </div>
      <div role="tabpanel">{shown?.content}</div>
    </>
  );
}
