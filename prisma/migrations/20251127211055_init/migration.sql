-- CreateTable
CREATE TABLE "SongSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spotifyTrackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "addedToPlaylist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suggestionId" TEXT NOT NULL,
    "voterToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_suggestionId_voterToken_key" ON "Vote"("suggestionId", "voterToken");
