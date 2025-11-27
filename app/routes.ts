import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("search", "routes/search.tsx"),
  route("suggest", "routes/suggest.tsx"),
  route("vote", "routes/vote.tsx"),
  route("events", "routes/events.tsx"),
  route("admin", "routes/admin.tsx"),
  route("playback", "routes/playback.tsx"),
] satisfies RouteConfig;
