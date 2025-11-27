import type { Route } from "./+types/suggest";
import { createSuggestion } from "~/lib/db.server";
import { ensureVoterToken } from "~/lib/session.server";
import { broadcastNewSuggestion } from "~/lib/events.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { token, headers } = ensureVoterToken(request);

  try {
    const body = await request.json();
    const { spotifyTrackId, title, artist } = body;

    if (!spotifyTrackId || !title || !artist) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400, headers }
      );
    }

    const { suggestion, created } = await createSuggestion({
      spotifyTrackId,
      title,
      artist,
    });

    if (created) {
      // Broadcast to all connected clients
      broadcastNewSuggestion(suggestion);
    }

    return Response.json({ suggestion, created }, { headers });
  } catch (error) {
    console.error("Suggest error:", error);
    return Response.json(
      { error: "Failed to create suggestion" },
      { status: 500, headers }
    );
  }
}

// API-only route
export default function Suggest() {
  return null;
}
