// Spotify API integration module

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

// Read env vars lazily to ensure .env is loaded
function getConfig() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN || "",
    playlistId: process.env.SPOTIFY_PLAYLIST_ID || "",
  };
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  uri: string;
  external_urls: { spotify: string };
  duration_ms?: number;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Get a fresh access token using refresh token
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const config = getConfig();
  const basic = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString("base64");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data: SpotifyTokenResponse = await response.json();

  // Cache token with 5 minute buffer before expiry
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

  return data.access_token;
}

// Search for tracks on Spotify
export async function searchTracks(query: string, limit: number = 10) {
  if (!query.trim()) {
    return [];
  }

  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: String(limit),
  });

  const response = await fetch(`${API_BASE}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Spotify search failed: ${error}`);
  }

  const data: SpotifySearchResponse = await response.json();

  return data.tracks.items.map((track) => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArt: track.album.images[0]?.url || "",
    uri: track.uri,
    spotifyUrl: track.external_urls.spotify,
  }));
}

// Add a track to the configured playlist
export async function addTrackToPlaylist(trackId: string) {
  const token = await getAccessToken();
  const config = getConfig();

  const response = await fetch(
    `${API_BASE}/playlists/${config.playlistId}/tracks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add track to playlist: ${error}`);
  }

  return { success: true };
}

// Check if Spotify is configured
export function isSpotifyConfigured(): boolean {
  const config = getConfig();
  return !!(
    config.clientId &&
    config.clientSecret &&
    config.refreshToken &&
    config.playlistId
  );
}

// Get currently playing track
export async function getCurrentlyPlaying() {
  if (!isSpotifyConfigured()) return null;

  try {
    const token = await getAccessToken();

    const response = await fetch(`${API_BASE}/me/player/currently-playing`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // 204 means nothing is playing
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      console.error("Failed to get currently playing:", await response.text());
      return null;
    }

    const data = await response.json();

    if (!data.item) return null;

    const track = data.item as SpotifyTrack;
    return {
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || "",
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: track.duration_ms,
    };
  } catch (error) {
    console.error("Error getting currently playing:", error);
    return null;
  }
}

// Get upcoming tracks from the player queue
export async function getUpcomingTracks(limit: number = 5) {
  if (!isSpotifyConfigured()) return [];

  try {
    const token = await getAccessToken();

    const response = await fetch(`${API_BASE}/me/player/queue`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // 204 means no active device
    if (response.status === 204) {
      return [];
    }

    if (!response.ok) {
      console.error("Failed to get queue:", await response.text());
      return [];
    }

    const data = await response.json();

    // data.queue contains upcoming tracks
    return (data.queue || []).slice(0, limit).map((track: SpotifyTrack) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a: { name: string }) => a.name).join(", "),
      album: track.album.name,
      albumArt: track.album.images[0]?.url || "",
    }));
  } catch (error) {
    console.error("Error getting queue:", error);
    return [];
  }
}
