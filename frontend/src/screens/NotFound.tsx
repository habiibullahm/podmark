import { useNavigate } from "react-router-dom";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-3 px-5 py-24 text-center">
      <span className="text-3xl">🧭</span>
      <h1 className="text-lg font-semibold text-text-primary">Page not found</h1>
      <p className="max-w-[280px] text-sm text-text-secondary">
        That link doesn't lead anywhere in PodMark.
      </p>
      <button
        type="button"
        onClick={() => navigate("/")}
        className="mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
      >
        Go home
      </button>
    </div>
  );
}
