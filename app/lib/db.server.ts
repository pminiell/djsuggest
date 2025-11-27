import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

// Avoid instantiating too many instances of Prisma in development
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  prisma = global.__db__;
}

export { prisma };

// Vote threshold to add track to playlist
export const VOTE_THRESHOLD = 3;

// Get all suggestions ordered by votes (descending) and creation date
export async function getSuggestions() {
  return prisma.songSuggestion.findMany({
    orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
  });
}

// Get a single suggestion by ID
export async function getSuggestion(id: string) {
  return prisma.songSuggestion.findUnique({
    where: { id },
  });
}

// Create a new song suggestion
export async function createSuggestion(data: {
  spotifyTrackId: string;
  title: string;
  artist: string;
}) {
  // Check if song already suggested
  const existing = await prisma.songSuggestion.findFirst({
    where: { spotifyTrackId: data.spotifyTrackId },
  });

  if (existing) {
    return { suggestion: existing, created: false };
  }

  const suggestion = await prisma.songSuggestion.create({
    data: {
      spotifyTrackId: data.spotifyTrackId,
      title: data.title,
      artist: data.artist,
    },
  });

  return { suggestion, created: true };
}

// Check if a user has already voted for a suggestion
export async function hasVoted(suggestionId: string, voterToken: string) {
  const vote = await prisma.vote.findUnique({
    where: {
      suggestionId_voterToken: {
        suggestionId,
        voterToken,
      },
    },
  });
  return !!vote;
}

// Add a vote and increment the suggestion's vote count
export async function addVote(suggestionId: string, voterToken: string) {
  // Check if already voted
  const alreadyVoted = await hasVoted(suggestionId, voterToken);
  if (alreadyVoted) {
    return { success: false, error: "Already voted" };
  }

  // Create vote and increment count in a transaction
  const [vote, suggestion] = await prisma.$transaction([
    prisma.vote.create({
      data: {
        suggestionId,
        voterToken,
      },
    }),
    prisma.songSuggestion.update({
      where: { id: suggestionId },
      data: { votes: { increment: 1 } },
    }),
  ]);

  return {
    success: true,
    suggestion,
    shouldAddToPlaylist:
      suggestion.votes >= VOTE_THRESHOLD && !suggestion.addedToPlaylist,
  };
}

// Mark a suggestion as added to playlist
export async function markAddedToPlaylist(suggestionId: string) {
  return prisma.songSuggestion.update({
    where: { id: suggestionId },
    data: { addedToPlaylist: true },
  });
}

// Delete a suggestion (admin function)
export async function deleteSuggestion(id: string) {
  // Delete associated votes first
  await prisma.vote.deleteMany({
    where: { suggestionId: id },
  });

  return prisma.songSuggestion.delete({
    where: { id },
  });
}

// Get vote count for a suggestion
export async function getVoteCount(suggestionId: string) {
  return prisma.vote.count({
    where: { suggestionId },
  });
}
