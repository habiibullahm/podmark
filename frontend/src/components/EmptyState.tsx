export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="mx-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center md:col-span-full md:mx-0">
      <span className="text-2xl">{icon}</span>
      <p className="max-w-[240px] text-sm text-text-secondary">{text}</p>
    </div>
  );
}
