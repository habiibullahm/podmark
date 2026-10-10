import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, CircleAlert, Link2, Plus, Search, SearchX } from "lucide-react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { searchPodcastEpisodes } from "../lib/itunesApi";
import { fetchYouTubeEpisode, isYouTubeUrl } from "../lib/youtubeApi";
import { formatTime } from "../lib/format";
import { BUTTON_PRIMARY, CARD } from "../lib/ui";
import type { Episode } from "../data/types";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { PodcastCard } from "../components/PodcastCard";
import { EmptyState } from "../components/EmptyState";

// Starting points that run a real iTunes search — not curated content.
const TOPICS = ["Productivity", "Artificial intelligence", "Investing", "Psychology", "History", "Startups"];

function AddButton({ added, onAdd, episodeId }: { added: boolean; onAdd: () => void; episodeId: string }) {
  const navigate = useNavigate();
  // Once added, the button names where it went and opens it — a disabled
  // "Added" pill hid that the card was now the way in.
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (added) navigate(`/episode/${episodeId}`);
        else onAdd();
      }}
      title={added ? "Open in your Library" : undefined}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-control px-3 py-2 text-xs font-bold transition-colors ${
        added ? "bg-success/15 text-success hover:bg-success/25" : "bg-accent text-white hover:bg-accent/90"
      }`}
    >
      {added ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
      {added ? "In Library" : "Add to Library"}
    </button>
  );
}

function ResultCard({ episode, added, onAdd }: { episode: Episode; added: boolean; onAdd: () => void }) {
  const navigate = useNavigate();
  return (
    <PodcastCard
      episode={episode}
      href={added ? `/episode/${episode.id}` : undefined}
      onCardClick={added ? () => navigate(`/episode/${episode.id}`) : undefined}
      meta={episode.durationSec > 0 ? formatTime(episode.durationSec) : episode.sourceUrl ? "YouTube video" : null}
      actions={<AddButton added={added} onAdd={onAdd} episodeId={episode.id} />}
    />
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" aria-label="Loading results">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`${CARD} animate-pulse p-3`}>
          <div className="aspect-square w-full rounded-2xl bg-bg-surface-alt" />
          <div className="mt-3 h-3.5 w-4/5 rounded bg-bg-surface-alt" />
          <div className="mt-2 h-3 w-1/2 rounded bg-bg-surface-alt" />
          <div className="mt-4 h-8 w-full rounded-control bg-bg-surface-alt" />
        </div>
      ))}
    </div>
  );
}

export function Discover() {
  const location = useLocation();
  const episodes = useEpisodesStore((s) => s.episodes);
  const addEpisode = useEpisodesStore((s) => s.addEpisode);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedTerm, setSearchedTerm] = useState<string | null>(null);

  const pastedYoutubeLink = isYouTubeUrl(query);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeResult, setYoutubeResult] = useState<Episode | null>(null);

  // One field, two kinds of result, and requests can overlap (a slow search,
  // then a corrected one). Every new search or lookup takes over the screen:
  // it clears whatever the other kind left behind, and only the newest
  // request's response is ever applied — a slower, older one is dropped.
  const latestRequest = useRef(0);
  const startRequest = () => {
    latestRequest.current += 1;
    setResults([]);
    setSearchedTerm(null);
    setSearchError(null);
    setYoutubeResult(null);
    setYoutubeError(null);
    setLoading(false);
    setYoutubeLoading(false);
    return latestRequest.current;
  };
  const isCurrent = (requestId: number) => requestId === latestRequest.current;

  // Looking up a link only previews it — nothing is added until the user
  // presses "Add to Library" on the card, exactly as with a search result.
  // Adding straight from the field made the two paths behave differently
  // despite sharing one input, and left people unsure whether they'd just
  // committed something.
  const lookupYoutubeVideo = async (value: string) => {
    const url = value.trim();
    if (!url) return;
    const requestId = startRequest();
    setYoutubeLoading(true);
    try {
      const episode = await fetchYouTubeEpisode(url);
      if (!isCurrent(requestId)) return;
      setYoutubeResult(episode);
      setQuery("");
    } catch (err) {
      if (!isCurrent(requestId)) return;
      setYoutubeError(err instanceof Error ? err.message : "Couldn't look up that YouTube video.");
    } finally {
      if (isCurrent(requestId)) setYoutubeLoading(false);
    }
  };

  const runSearch = async (value: string) => {
    const term = value.trim();
    if (!term) return;
    const requestId = startRequest();
    setLoading(true);
    try {
      const found = await searchPodcastEpisodes(term);
      if (!isCurrent(requestId)) return;
      setResults(found);
      setSearchedTerm(term);
    } catch (err) {
      if (!isCurrent(requestId)) return;
      console.error("Podcast search failed:", err);
      setSearchError("Couldn't reach the podcast search service — check your connection and try again.");
    } finally {
      if (isCurrent(requestId)) setLoading(false);
    }
  };

  const submit = (value: string) => (isYouTubeUrl(value) ? lookupYoutubeVideo(value) : runSearch(value));

  // A query handed over from Home's quick search runs once on arrival.
  const handedOver = useRef(false);
  useEffect(() => {
    const incoming = (location.state as { query?: string } | null)?.query;
    if (!incoming || handedOver.current) return;
    handedOver.current = true;
    setQuery(incoming);
    void submit(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isInLibrary = (id: string) => episodes.some((e) => e.id === id);

  return (
    <div>
      <PageHeader
        title="Discover"
        subtitle="Search real podcast episodes, or paste a YouTube link to take notes on a video."
      />

      {/* One field for both ways in: a pasted link is looked up, anything
          else is searched. Either way the result is a preview card and
          "Add to Library" is the only thing that adds. The icon and button
          label switch as you type, so the field says which it's about to do. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(query);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="min-w-0 flex-1">
          <SearchInput
            value={query}
            onChange={setQuery}
            size="lg"
            placeholder="Search podcasts, or paste a YouTube link..."
            icon={pastedYoutubeLink ? Link2 : Search}
          />
        </div>
        <button type="submit" disabled={!query.trim()} className={`${BUTTON_PRIMARY} px-6 py-3.5`}>
          {youtubeLoading ? "Looking up…" : loading ? "Searching…" : pastedYoutubeLink ? "Look up" : "Search"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Suggested topics">
        {TOPICS.map((topic) => (
          <button
            key={topic}
            type="button"
            onClick={() => {
              setQuery(topic);
              void runSearch(topic);
            }}
            className="rounded-full border border-border bg-bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-secondary shadow-card transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-60"
          >
            {topic}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        {(youtubeError || searchError) && (
          <div role="alert" className="flex items-start gap-2.5 rounded-control border border-danger/30 bg-danger/5 px-4 py-3">
            <CircleAlert size={18} className="mt-px shrink-0 text-danger" aria-hidden="true" />
            <p className="text-sm text-text-primary">{youtubeError ?? searchError}</p>
          </div>
        )}

        {youtubeResult && (
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight text-text-primary">From YouTube</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              <ResultCard
                episode={youtubeResult}
                added={isInLibrary(youtubeResult.id)}
                onAdd={() => addEpisode(youtubeResult)}
              />
            </div>
          </section>
        )}

        {loading && <SkeletonGrid />}

        {!loading && results.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold tracking-tight text-text-primary">
              Results{searchedTerm ? ` for “${searchedTerm}”` : ""}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {results.map((ep) => (
                <ResultCard key={ep.id} episode={ep} added={isInLibrary(ep.id)} onAdd={() => addEpisode(ep)} />
              ))}
            </div>
          </section>
        )}

        {searchedTerm !== null && !loading && results.length === 0 && !searchError && (
          <EmptyState icon={SearchX} text="No episodes found for that search — try a different term." />
        )}

        {searchedTerm === null && !loading && !youtubeResult && !searchError && !youtubeError && (
          <p className="text-center text-sm text-text-tertiary">
            Search real podcasts via iTunes — added episodes play with real audio. Or paste a YouTube link to keep
            notes on a video you watch there.
          </p>
        )}
      </div>
    </div>
  );
}
