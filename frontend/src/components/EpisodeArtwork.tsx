import type { Episode } from "../data/types";

export function EpisodeArtwork({
  episode,
  className = "",
}: {
  episode: Pick<Episode, "artworkGradient" | "artworkImageUrl">;
  className?: string;
}) {
  if (episode.artworkImageUrl) {
    return <img src={episode.artworkImageUrl} alt="" className={`object-cover ${className}`} />;
  }
  return <div className={className} style={{ background: episode.artworkGradient }} />;
}
