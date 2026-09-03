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
  return (
    <div className="mx-5 flex w-fit gap-1 overflow-x-auto rounded-xl bg-bg-surface-alt p-1 no-scrollbar md:mx-0">
      {tabs.map((tab) => (
        <button
          key={tab.key}
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
