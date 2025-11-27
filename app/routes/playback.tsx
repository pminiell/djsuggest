import type { Route } from "./+types/playback";
import { getCurrentlyPlaying, getUpcomingTracks } from "~/lib/spotify.server";

export async function loader({ request }: Route.LoaderArgs) {
  const [nowPlaying, upNext] = await Promise.all([
    getCurrentlyPlaying(),
    getUpcomingTracks(5),
  ]);

  return Response.json({ nowPlaying, upNext });
}

// API-only route
export default function Playback() {
  return null;
}
