interface AppHeaderProps {
  greeting: string;
  streak: number;
}

export function AppHeader({ greeting, streak }: AppHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
          A
        </div>
        <div>
          <p className="text-[13px] text-text-secondary">{greeting}</p>
          <p className="text-[17px] font-semibold text-text-primary">Alex</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-bg-surface-alt px-3 py-1.5 text-sm font-medium text-text-primary">
          <span>🔥</span>
          <span>{streak}</span>
        </div>
      </div>
    </div>
  );
}
