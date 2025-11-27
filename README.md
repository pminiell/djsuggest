# DJ Suggest

A real-time song suggestion and voting app for DJs. Guests can search for songs on Spotify, suggest them, and vote for their favorites. When a song reaches the vote threshold, it's automatically added to the DJ's Spotify playlist.

## Features

- 🎵 Spotify integration for song search
- 🗳️ Real-time voting system
- 📡 Server-Sent Events (SSE) for live updates
- 🔐 Admin dashboard for queue management
- 🐳 Docker support for easy deployment
- 💾 SQLite database with Prisma ORM

## Tech Stack

- React Router v7 (Framework Mode)
- TypeScript
- Prisma ORM with SQLite
- TailwindCSS
- Spotify Web API

## Getting Started

### Prerequisites

- Node.js 20+
- Spotify Developer Account (for API credentials)

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="file:./dev.db"

# Spotify API credentials
SPOTIFY_CLIENT_ID="your_client_id"
SPOTIFY_CLIENT_SECRET="your_client_secret"
SPOTIFY_REFRESH_TOKEN="your_refresh_token"
SPOTIFY_PLAYLIST_ID="your_playlist_id"

# Admin PIN for /admin route
ADMIN_PIN="1234"
```

### Spotify Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:5173/callback` as a redirect URI
4. Copy your Client ID and Client Secret
5. To get a refresh token, you'll need to complete the OAuth flow once:
   - Use the [Spotify Authorization Code Flow](https://developer.spotify.com/documentation/general/guides/authorization/code-flow/)
   - Request the `playlist-modify-public playlist-modify-private` scopes

### Database Setup

```bash
npx prisma migrate dev
```

### Development

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Main page - search, suggest, and vote for songs |
| `/search` | API endpoint for Spotify search |
| `/suggest` | POST endpoint to suggest a song |
| `/vote` | POST endpoint to vote for a song |
| `/events` | SSE endpoint for real-time updates |
| `/admin` | Admin dashboard (PIN protected) |

## How It Works

1. **Search**: Users search for songs using the Spotify API
2. **Suggest**: Users can suggest songs they find
3. **Vote**: Each user gets one vote per suggestion (tracked via cookie)
4. **Threshold**: When a song reaches 3 votes, it's automatically added to the DJ's Spotify playlist
5. **Live Updates**: All connected clients receive real-time updates via SSE

## Building for Production

```bash
npm run build
```

## Docker Deployment

```bash
# Build the image
docker build -t djsuggest .

# Run with environment variables
docker run -p 3000:3000 \
  -e SPOTIFY_CLIENT_ID=your_client_id \
  -e SPOTIFY_CLIENT_SECRET=your_client_secret \
  -e SPOTIFY_REFRESH_TOKEN=your_refresh_token \
  -e SPOTIFY_PLAYLIST_ID=your_playlist_id \
  -e ADMIN_PIN=your_secure_pin \
  -v djsuggest-data:/app/prisma \
  djsuggest
```

The `-v` flag mounts a volume to persist the SQLite database.

## Project Structure

```
/app
  /lib
    db.server.ts        # Prisma client and database helpers
    spotify.server.ts   # Spotify API integration
    session.server.ts   # Voter token management
    events.server.ts    # SSE event emitter
  /routes
    home.tsx            # Main page
    search.tsx          # Spotify search API
    suggest.tsx         # Song suggestion API
    vote.tsx            # Voting API
    events.tsx          # SSE endpoint
    admin.tsx           # Admin dashboard
  root.tsx
  routes.ts
/prisma
  schema.prisma         # Database schema
```

## License

MIT
