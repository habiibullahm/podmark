import type { Episode } from "../data/types";

// Always give it a fixed size (or aspect ratio) via className, so loading
// artwork never shifts the layout.
export function EpisodeArtwork({
  episode,
  className = "",
}: {
  episode: Pick<Episode, "artworkGradient" | "artworkImageUrl">;
  className?: string;
}) {
  if (episode.artworkImageUrl) {
    return (
      <img
        src={episode.artworkImageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`bg-bg-surface-alt object-cover ${className}`}
      />
    );
  }
  return <div aria-hidden="true" className={className} style={{ background: episode.artworkGradient }} />;
}
