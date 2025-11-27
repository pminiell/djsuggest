import type { Route } from "./+types/home";
import { getSuggestions, hasVoted, VOTE_THRESHOLD } from "~/lib/db.server";
import { ensureVoterToken } from "~/lib/session.server";
import { isSpotifyConfigured } from "~/lib/spotify.server";
import { useEffect, useState, useRef } from "react";
import { useFetcher } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DJ Suggest - Song Requests" },
    { name: "description", content: "Suggest and vote for songs to be played!" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { token, isNew, headers } = ensureVoterToken(request);
  const suggestions = await getSuggestions();

  // Check which suggestions user has voted for
  const votedFor = await Promise.all(
    suggestions.map(async (s) => ({
      id: s.id,
      hasVoted: await hasVoted(s.id, token),
    }))
  );

  const votedMap = Object.fromEntries(votedFor.map((v) => [v.id, v.hasVoted]));

  return Response.json(
    {
      suggestions,
      votedMap,
      voteThreshold: VOTE_THRESHOLD,
      spotifyConfigured: isSpotifyConfigured(),
    },
    { headers }
  );
}

interface Suggestion {
  id: string;
  spotifyTrackId: string;
  title: string;
  artist: string;
  votes: number;
  addedToPlaylist: boolean;
  createdAt: string;
}

interface LoaderData {
  suggestions: Suggestion[];
  votedMap: Record<string, boolean>;
  voteThreshold: number;
  spotifyConfigured: boolean;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const data = loaderData as unknown as LoaderData;
  const [suggestions, setSuggestions] = useState<Suggestion[]>(data.suggestions);
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>(data.votedMap);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use React Router's fetcher for search
  const searchFetcher = useFetcher<{ tracks: any[] }>();
  const isSearching = searchFetcher.state === "loading";

  // SSE connection for live updates
  useEffect(() => {
    const eventSource = new EventSource("/events");

    eventSource.onmessage = (event) => {
      const eventData = JSON.parse(event.data);

      switch (eventData.type) {
        case "new-suggestion":
          // Only add if not already in the list (prevents duplicates from own suggestions)
          setSuggestions((prev) => {
            if (prev.some((s) => s.id === eventData.data.id)) {
              return prev;
            }
            return [eventData.data, ...prev];
          });
          break;
        case "new-vote":
          // Only update if the server vote count is higher (handles race conditions)
          setSuggestions((prev) =>
            prev.map((s) =>
              s.id === eventData.data.suggestionId && eventData.data.votes > s.votes
                ? { ...s, votes: eventData.data.votes }
                : s
            )
          );
          break;
        case "added-to-playlist":
          setSuggestions((prev) =>
            prev.map((s) =>
              s.id === eventData.data.id ? { ...s, addedToPlaylist: true } : s
            )
          );
          setNotification(`🎉 "${eventData.data.title}" added to playlist!`);
          break;
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Debounced search using fetcher
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      return;
    }

    // Re-enable showing results when user types
    setShowSearchResults(true);

    searchTimeoutRef.current = setTimeout(() => {
      searchFetcher.load(`/search?q=${encodeURIComponent(searchQuery)}`);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Show search results only when query is long enough and not hidden
  const searchResults = (searchQuery.trim().length >= 2 && showSearchResults)
    ? (searchFetcher.data?.tracks || []) 
    : [];

  async function handleSuggest(track: any) {
    // Immediately hide search results and clear input for better feedback
    setShowSearchResults(false);
    setSearchQuery("");
    
    try {
      const res = await fetch("/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotifyTrackId: track.id,
          title: track.name,
          artist: track.artist,
        }),
      });
      const data = await res.json();
      if (data.created) {
        // Add the suggestion to the list and mark as voted (auto-vote on backend)
        setSuggestions((prev) => [data.suggestion, ...prev]);
        setVotedMap((prev) => ({ ...prev, [data.suggestion.id]: true }));
        setNotification(`Suggested: ${track.name}`);
      } else {
        setNotification(`"${track.name}" was already suggested`);
      }
    } catch (error) {
      console.error("Suggest error:", error);
    }
  }

  async function handleVote(suggestionId: string) {
    if (votedMap[suggestionId]) return;

    // Optimistically update UI
    setVotedMap((prev) => ({ ...prev, [suggestionId]: true }));
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId ? { ...s, votes: s.votes + 1 } : s
      )
    );

    try {
      const res = await fetch("/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId }),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert optimistic update on failure
        setVotedMap((prev) => ({ ...prev, [suggestionId]: false }));
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId ? { ...s, votes: s.votes - 1 } : s
          )
        );
        setNotification(data.error || "Vote failed");
      }
    } catch (error) {
      console.error("Vote error:", error);
      // Revert optimistic update on error
      setVotedMap((prev) => ({ ...prev, [suggestionId]: false }));
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestionId ? { ...s, votes: s.votes - 1 } : s
        )
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black text-white">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          {notification}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            DJ Suggest
          </h1>
          <p className="text-gray-400">
            Search for songs, suggest them, and vote for your favorites!
          </p>
          {!data.spotifyConfigured && (
            <p className="text-yellow-500 mt-2 text-sm">
              ⚠️ Spotify not configured - songs won't be added to playlist
            </p>
          )}
        </header>

        {/* Search Section */}
        <section className="mb-12">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a song..."
              className="w-full px-6 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
              {searchResults.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-700 transition border-b border-gray-700 last:border-b-0"
                >
                  {track.albumArt && (
                    <img
                      src={track.albumArt}
                      alt={track.album}
                      className="w-12 h-12 rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.name}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {track.artist}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSuggest(track)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition shrink-0"
                  >
                    Suggest
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Suggestions List */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Current Suggestions</h2>
          {suggestions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No suggestions yet. Be the first to suggest a song!
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions
                .sort((a, b) => b.votes - a.votes)
                .map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition ${
                      suggestion.addedToPlaylist
                        ? "bg-green-900/20 border-green-700"
                        : "bg-gray-800 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{suggestion.title}</p>
                        {suggestion.addedToPlaylist && (
                          <span className="text-green-500 text-sm">
                            ✓ In Playlist
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {suggestion.artist}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-400">
                          {suggestion.votes}
                        </p>
                        <p className="text-xs text-gray-500">
                          {suggestion.votes >= data.voteThreshold
                            ? "Threshold met!"
                            : `${data.voteThreshold - suggestion.votes} more needed`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleVote(suggestion.id)}
                        disabled={
                          votedMap[suggestion.id] || suggestion.addedToPlaylist
                        }
                        className={`px-6 py-2 rounded-lg font-medium transition ${
                          votedMap[suggestion.id]
                            ? "bg-gray-600 cursor-not-allowed"
                            : suggestion.addedToPlaylist
                            ? "bg-green-700 cursor-not-allowed"
                            : "bg-pink-600 hover:bg-pink-700"
                        }`}
                      >
                        {votedMap[suggestion.id] ? "Voted" : "Vote"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
