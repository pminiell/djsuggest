import type { Route } from "./+types/vote";
import { addVote, getSuggestion, markAddedToPlaylist } from "~/lib/db.server";
import { ensureVoterToken } from "~/lib/session.server";
import { addTrackToPlaylist, isSpotifyConfigured } from "~/lib/spotify.server";
import { broadcastNewVote, broadcastAddedToPlaylist } from "~/lib/events.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { token, headers } = ensureVoterToken(request);

  try {
    const body = await request.json();
    const { suggestionId } = body;

    if (!suggestionId) {
      return Response.json(
        { error: "Missing suggestionId" },
        { status: 400, headers }
      );
    }

    const result = await addVote(suggestionId, token);

    if (!result.success) {
      return Response.json(
        { error: result.error, success: false },
        { status: 400, headers }
      );
    }

    // Broadcast vote update
    broadcastNewVote({
      suggestionId,
      votes: result.suggestion!.votes,
    });

    // Check if we should add to playlist
    if (result.shouldAddToPlaylist && isSpotifyConfigured()) {
      const suggestion = await getSuggestion(suggestionId);
      if (suggestion) {
        try {
          await addTrackToPlaylist(suggestion.spotifyTrackId);
          await markAddedToPlaylist(suggestionId);
          broadcastAddedToPlaylist({ ...suggestion, addedToPlaylist: true });
        } catch (error) {
          console.error("Failed to add to playlist:", error);
          // Don't fail the vote if playlist add fails
        }
      }
    }

    return Response.json(
      { success: true, votes: result.suggestion!.votes },
      { headers }
    );
  } catch (error) {
    console.error("Vote error:", error);
    return Response.json(
      { error: "Failed to vote", success: false },
      { status: 500, headers }
    );
  }
}

// API-only route
export default function Vote() {
  return null;
}
