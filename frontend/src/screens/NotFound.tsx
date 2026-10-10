import { useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { BUTTON_PRIMARY } from "../lib/ui";

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-3 px-5 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Compass size={26} aria-hidden="true" />
      </span>
      <h1 className="text-xl font-extrabold tracking-tight text-text-primary">Page not found</h1>
      <p className="max-w-[280px] text-sm text-text-secondary">That link doesn't lead anywhere in PodMark.</p>
      <button type="button" onClick={() => navigate("/")} className={`mt-2 ${BUTTON_PRIMARY}`}>
        Go home
      </button>
    </div>
  );
}
