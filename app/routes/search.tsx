import type { Route } from "./+types/search";
import { searchTracks, isSpotifyConfigured } from "~/lib/spotify.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  if (!isSpotifyConfigured()) {
    return Response.json({
      tracks: [],
      error: "Spotify not configured",
    });
  }

  if (!query.trim()) {
    return Response.json({ tracks: [] });
  }

  try {
    const tracks = await searchTracks(query);
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
