import type { Route } from "./+types/admin";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { getSuggestions, deleteSuggestion, VOTE_THRESHOLD } from "~/lib/db.server";
import { createCookie } from "react-router";

// Cookie to store admin session
const adminSession = createCookie("admin_session", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24, // 24 hours
});

const ADMIN_PIN = process.env.ADMIN_PIN || "1234";

async function isAuthorized(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const pinFromUrl = url.searchParams.get("pin");
  
  // Check URL param first
  if (pinFromUrl === ADMIN_PIN) {
    return true;
  }
  
  // Check cookie
  const cookieHeader = request.headers.get("Cookie");
  const sessionPin = await adminSession.parse(cookieHeader);
  return sessionPin === ADMIN_PIN;
}

export async function loader({ request }: Route.LoaderArgs) {
  const authorized = await isAuthorized(request);

  if (!authorized) {
    return Response.json({ authorized: false, suggestions: [], voteThreshold: VOTE_THRESHOLD });
  }

  const suggestions = await getSuggestions();
  
  // Set cookie if authorized via URL param
  const url = new URL(request.url);
  if (url.searchParams.get("pin") === ADMIN_PIN) {
    return Response.json(
      { authorized: true, suggestions, voteThreshold: VOTE_THRESHOLD },
      { headers: { "Set-Cookie": await adminSession.serialize(ADMIN_PIN) } }
    );
  }
  
  return Response.json({ authorized: true, suggestions, voteThreshold: VOTE_THRESHOLD });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const pin = formData.get("pin") as string;
  const suggestionId = formData.get("suggestionId") as string;
  const actionType = formData.get("action") as string;

  // For login action
  if (actionType === "login") {
    if (pin === ADMIN_PIN) {
      const suggestions = await getSuggestions();
      return Response.json(
        { authorized: true, suggestions, voteThreshold: VOTE_THRESHOLD },
        { headers: { "Set-Cookie": await adminSession.serialize(ADMIN_PIN) } }
      );
    }
    return Response.json({ authorized: false, error: "Invalid PIN" }, { status: 401 });
  }

  // For other actions, check authorization via cookie
  const authorized = await isAuthorized(request);
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (actionType === "delete" && suggestionId) {
    await deleteSuggestion(suggestionId);
    const suggestions = await getSuggestions();
    return Response.json({ success: true, deleted: suggestionId, suggestions });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
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
  authorized: boolean;
  suggestions: Suggestion[];
  voteThreshold?: number;
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  const data = loaderData as unknown as LoaderData;
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState("");
  const [authorized, setAuthorized] = useState(data.authorized);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(data.suggestions);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Update state when loaderData changes (e.g., after URL param login)
  useEffect(() => {
    setAuthorized(data.authorized);
    setSuggestions(data.suggestions);
  }, [data.authorized, data.suggestions]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("pin", pin);
    formData.append("action", "login");

    const res = await fetch("/admin", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    setLoading(false);

    if (result.authorized) {
      setAuthorized(true);
      setSuggestions(result.suggestions);
      setPin(""); // Clear PIN from state
    } else {
      setError("Invalid PIN");
    }
  }

  async function handleDelete(suggestionId: string) {
    if (!confirm("Are you sure you want to delete this suggestion?")) return;

    const formData = new FormData();
    formData.append("suggestionId", suggestionId);
    formData.append("action", "delete");

    const res = await fetch("/admin", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (result.success) {
      setSuggestions(result.suggestions);
    } else if (result.error === "Unauthorized") {
      setAuthorized(false);
      setError("Session expired. Please log in again.");
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 mb-4"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed rounded-lg font-medium transition"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400">
            Manage suggestions and monitor the queue
          </p>
        </header>

        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          <p>
            <strong>Vote Threshold:</strong> {data.voteThreshold} votes
          </p>
          <p>
            <strong>Total Suggestions:</strong> {suggestions.length}
          </p>
          <p>
            <strong>Added to Playlist:</strong>{" "}
            {suggestions.filter((s) => s.addedToPlaylist).length}
          </p>
        </div>

        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No suggestions yet</p>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  suggestion.addedToPlaylist
                    ? "bg-green-900/20 border-green-700"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{suggestion.title}</p>
                    {suggestion.addedToPlaylist && (
                      <span className="text-green-500 text-sm">✓ In Playlist</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {suggestion.artist}
                  </p>
                  <p className="text-xs text-gray-500">
                    Spotify ID: {suggestion.spotifyTrackId}
                  </p>
                </div>
                <div className="text-center px-4">
                  <p className="text-xl font-bold text-purple-400">
                    {suggestion.votes}
                  </p>
                  <p className="text-xs text-gray-500">votes</p>
                </div>
                <button
                  onClick={() => handleDelete(suggestion.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-8">
          <a
            href="/"
            className="text-purple-400 hover:text-purple-300 transition"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
