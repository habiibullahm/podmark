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
    <div className="mx-5 inline-flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-border bg-bg-surface p-1 no-scrollbar md:mx-0">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          ref={active === tab.key ? activeRef : undefined}
          type="button"
          onClick={() => onChange(tab.key)}
          className={[
            "shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            active === tab.key
              ? "bg-accent text-white"
              : "text-text-secondary hover:text-text-primary",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
