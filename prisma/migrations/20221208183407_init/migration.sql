-- CreateTable
CREATE TABLE "Album" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "artwork" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumsToTracks" (
    "albumId" INTEGER NOT NULL,
    "trackId" INTEGER NOT NULL,

    CONSTRAINT "AlbumsToTracks_pkey" PRIMARY KEY ("albumId","trackId")
);

-- CreateTable
CREATE TABLE "AlbumsToArtists" (
    "albumId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,

    CONSTRAINT "AlbumsToArtists_pkey" PRIMARY KEY ("albumId","artistId")
);

-- CreateTable
CREATE TABLE "Track" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TracksToArtists" (
    "trackId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,

    CONSTRAINT "TracksToArtists_pkey" PRIMARY KEY ("trackId","artistId")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "artwork" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArtistParents" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Album_title_key" ON "Album"("title");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumsToTracks_albumId_key" ON "AlbumsToTracks"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumsToTracks_trackId_key" ON "AlbumsToTracks"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumsToArtists_albumId_key" ON "AlbumsToArtists"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumsToArtists_artistId_key" ON "AlbumsToArtists"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_title_key" ON "Track"("title");

-- CreateIndex
CREATE UNIQUE INDEX "TracksToArtists_trackId_key" ON "TracksToArtists"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "TracksToArtists_artistId_key" ON "TracksToArtists"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_name_key" ON "Artist"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_ArtistParents_AB_unique" ON "_ArtistParents"("A", "B");

-- CreateIndex
CREATE INDEX "_ArtistParents_B_index" ON "_ArtistParents"("B");

-- AddForeignKey
ALTER TABLE "AlbumsToTracks" ADD CONSTRAINT "AlbumsToTracks_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumsToTracks" ADD CONSTRAINT "AlbumsToTracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumsToArtists" ADD CONSTRAINT "AlbumsToArtists_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumsToArtists" ADD CONSTRAINT "AlbumsToArtists_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TracksToArtists" ADD CONSTRAINT "TracksToArtists_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TracksToArtists" ADD CONSTRAINT "TracksToArtists_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistParents" ADD CONSTRAINT "_ArtistParents_A_fkey" FOREIGN KEY ("A") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArtistParents" ADD CONSTRAINT "_ArtistParents_B_fkey" FOREIGN KEY ("B") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
