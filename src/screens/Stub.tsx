export function Stub({ title }: { title: string }) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">Not part of this prototype pass yet.</p>
    </div>
  );
}
