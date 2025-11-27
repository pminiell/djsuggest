import type { Route } from "./+types/search";
import { searchTracks, isSpotifyConfigured } from "~/lib/spotify.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  console.log("Search request:", { query, configured: isSpotifyConfigured() });

  if (!isSpotifyConfigured()) {
    console.log("Spotify not configured");
    return Response.json({
      tracks: [],
      error: "Spotify not configured",
    });
  }

  if (!query.trim()) {
    return Response.json({ tracks: [] });
  }

  try {
    console.log("Searching Spotify for:", query);
    const tracks = await searchTracks(query);
    console.log("Found tracks:", tracks.length);
    return Response.json({ tracks });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json({
      tracks: [],
      error: "Failed to search Spotify",
    });
  }
}

// This route is API-only, no component needed
export default function Search() {
  return null;
}
