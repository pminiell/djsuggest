// Simple in-memory event emitter for SSE broadcasts

type EventHandler = (data: SSEEvent) => void;

export interface SSEEvent {
  type: "new-suggestion" | "new-vote" | "added-to-playlist";
  data: unknown;
}

class EventEmitter {
  private handlers: Set<EventHandler> = new Set();

  subscribe(handler: EventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(event: SSEEvent) {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}

// Global singleton for the event emitter
let emitter: EventEmitter;

declare global {
  var __eventEmitter__: EventEmitter | undefined;
}

if (process.env.NODE_ENV === "production") {
  emitter = new EventEmitter();
} else {
  if (!global.__eventEmitter__) {
    global.__eventEmitter__ = new EventEmitter();
  }
  emitter = global.__eventEmitter__;
}

export { emitter };

// Helper to broadcast a new suggestion
export function broadcastNewSuggestion(suggestion: unknown) {
  emitter.emit({ type: "new-suggestion", data: suggestion });
}

// Helper to broadcast a new vote
export function broadcastNewVote(data: { suggestionId: string; votes: number }) {
  emitter.emit({ type: "new-vote", data });
}

// Helper to broadcast when a song is added to playlist
export function broadcastAddedToPlaylist(suggestion: unknown) {
  emitter.emit({ type: "added-to-playlist", data: suggestion });
}
