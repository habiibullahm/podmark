import type { Episode } from "../data/types";

// iTunes Search API — public, unauthenticated, CORS-enabled. `entity=podcastEpisode`
// returns individual episodes (not just shows) with a real playable audio URL,
// so no RSS-feed fetching/parsing (and its CORS headaches) is needed.
const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

interface ItunesEpisodeResult {
  trackId: number;
  trackName?: string;
  collectionName?: string;
  artworkUrl600?: string;
  artworkUrl160?: string;
  episodeUrl?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  genres?: { id: string; name: string }[];
}

interface ItunesSearchResponse {
  resultCount: number;
  results: ItunesEpisodeResult[];
}

function toEpisode(result: ItunesEpisodeResult): Episode | null {
  const audioUrl = result.episodeUrl ?? result.previewUrl;
  if (!audioUrl || !result.trackName) return null;

  return {
    id: `itunes-${result.trackId}`,
    title: result.trackName,
    show: result.collectionName ?? "Unknown show",
    artworkGradient: "linear-gradient(135deg, #6366F1, #312E81)",
    artworkImageUrl: result.artworkUrl600 ?? result.artworkUrl160,
    durationSec: result.trackTimeMillis ? Math.round(result.trackTimeMillis / 1000) : 0,
    progressSec: 0,
    status: "not-started",
    tags: (result.genres ?? []).slice(0, 2).map((g) => g.name.toLowerCase().replace(/\s+/g, "-")),
    publishedAt: result.releaseDate ? result.releaseDate.slice(0, 10) : "",
    audioUrl,
  };
}

export async function searchPodcastEpisodes(term: string): Promise<Episode[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];

  const url = `${ITUNES_SEARCH_URL}?${new URLSearchParams({
    term: trimmed,
    media: "podcast",
    entity: "podcastEpisode",
    limit: "20",
  })}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`iTunes search failed: ${res.status}`);
  }
  const data: ItunesSearchResponse = await res.json();
  return data.results.map(toEpisode).filter((e): e is Episode => e !== null);
}
