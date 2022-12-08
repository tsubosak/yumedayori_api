-- CreateTable
CREATE TABLE "Album" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumsToTracks" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "trackId" INTEGER NOT NULL,

    CONSTRAINT "AlbumsToTracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumsToArtists" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,

    CONSTRAINT "AlbumsToArtists_pkey" PRIMARY KEY ("id")
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
    "id" SERIAL NOT NULL,
    "trackId" INTEGER NOT NULL,
    "artistId" INTEGER NOT NULL,

    CONSTRAINT "TracksToArtists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Album_title_key" ON "Album"("title");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumsToTracks_albumId_trackId_key" ON "AlbumsToTracks"("albumId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "AlbumsToArtists_albumId_artistId_key" ON "AlbumsToArtists"("albumId", "artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_title_key" ON "Track"("title");

-- CreateIndex
CREATE UNIQUE INDEX "TracksToArtists_trackId_artistId_key" ON "TracksToArtists"("trackId", "artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_name_key" ON "Artist"("name");

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
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
