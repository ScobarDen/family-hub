import { useState, type ReactNode } from "react";

import { Chip } from "./chip.view.tsx";

type LayoutTab = { key: string; title: string; content: ReactNode };

type SectionLayoutProps = {
  summary: ReactNode;
  // One primary action, a verb with its object: «Добавить запись», «Внести взнос».
  action?: ReactNode;
  // A single tab needs no switch: its content shows on its own. The switch is a row of toggle
  // chips that wraps, so no tab hides past the screen's edge.
  tabs: LayoutTab[];
};

export function SectionLayout({ summary, action, tabs }: SectionLayoutProps) {
  const [chosenKey, setChosenKey] = useState(tabs[0]?.key);
  const shown = tabs.find(({ key }) => key === chosenKey) ?? tabs[0];

  return (
    <>
      {summary}
      {action !== undefined && <div className="px-4 pb-5">{action}</div>}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {tabs.map(({ key, title }) => (
            <Chip
              key={key}
              isSelected={key === shown?.key}
              onClick={() => {
                setChosenKey(key);
              }}
            >
              {title}
            </Chip>
          ))}
        </div>
      )}
      {shown?.content}
    </>
  );
}
