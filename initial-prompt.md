Tech Stack

React Router v7 (Framework Mode, TypeScript, with loaders/actions support) 
React Router
+1

Prisma ORM with SQLite

TailwindCSS for styling

A single Dockerfile to run the app

SSE (Server-Sent Events) endpoint for live updates

Spotify Web API integration (search + add track to playlist)

Data Models (Prisma)

Define the following schema:

model SongSuggestion {
  id             String   @id @default(uuid())
  spotifyTrackId String
  title          String
  artist         String
  votes          Int      @default(0)
  createdAt      DateTime @default(now())
}

model Vote {
  id            String   @id @default(uuid())
  suggestionId  String
  voterToken    String
  createdAt     DateTime @default(now())
}

Core Routes / Route Modules

Implement the following routes (UI can initially be minimal — focus on server logic):

/
– Shows list of suggestions + a form to suggest a new song (loader + action)

/search
– Loader that queries the Spotify Search API server-side and returns suggestions matching search string

/suggest
– POST action: insert a new suggestion into the DB

/vote
– POST action: increment vote count, ensuring one vote per suggestion per user token; if votes ≥ threshold (e.g. 3), trigger logic to add the track to the Spotify playlist

/events
– SSE endpoint to broadcast real-time updates: new suggestions, new votes, songs added to playlist

/admin
– A password-protected admin page (use an environment variable or simple PIN) to review suggestions, remove inappropriate ones, and manage queue/threshold

Spotify Integration

Create a spotify.server.ts (or .js) module that includes:

Spotify client setup with credentials from environment variables

Token refresh logic

Exposed methods: searchTracks(query: string) and addTrackToPlaylist(trackId: string)

Expect the following environment variables:

SPOTIFY_CLIENT_ID  
SPOTIFY_CLIENT_SECRET  
SPOTIFY_REFRESH_TOKEN  
SPOTIFY_PLAYLIST_ID  


These are only used on the server side.

Database Layer

Create a db.server.ts file exporting a configured Prisma client. Provide helper functions such as:

createSuggestion(...)

addVote(...)

getSuggestions()

hasVoted(suggestionId: string, voterToken: string)

Session / Voter Identity Handling

Implement a minimal session system:

On first visit, generate a UUID for the user and set a cookie (e.g. voterToken)

Use this token to enforce one vote per user per suggestion

Dockerfile & Deployment

Add a Dockerfile that:

Installs dependencies

Runs database migrations (via Prisma)

Builds the app (using Vite or default React Router build)

Starts the Node server to serve the app

Project Structure

The scaffold should roughly create this layout:

/app
  /routes
     (route modules: index.tsx, search.tsx, suggest.tsx, vote.tsx, events.ts, admin.tsx)
/components
/lib
  db.server.ts
  spotify.server.ts
/utils
root.tsx (or entry file as needed)
prisma/schema.prisma
vite.config.ts (configured for React Router v7 + Vite plugin)
/Dockerfile
README.md

Expected Outcome

At the end, you should have a working skeleton that:

Can run locally with npm run dev (or node)

Can build a Docker image that runs the app

Supports song search via Spotify API

Supports suggestion + voting

Automatically adds top-voted songs to a specified Spotify playlist

Offers a minimal UI + SSE live-update support for guests