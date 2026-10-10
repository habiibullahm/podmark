import { useEffect, useRef } from "react";

interface SegmentedTabSwitcherProps<T extends string> {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}

export function SegmentedTabSwitcher<T extends string>({
  tabs,
  active,
  onChange,
}: SegmentedTabSwitcherProps<T>) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);

  // Clicking a tab near the scroll edge doesn't bring it into view on its
  // own — without this, the newly-active tab can end up partially clipped
  // by the container instead of fully visible. Skipped on mount so a
  // caller whose default `active` isn't the first tab doesn't trigger an
  // unsolicited scroll jump before the user has done anything.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [active]);

  return (
    <div className="inline-flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-control border border-border bg-bg-surface p-1 shadow-card no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          ref={active === tab.key ? activeRef : undefined}
          type="button"
          aria-pressed={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors",
            active === tab.key
              ? "bg-accent text-white"
              : "text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
