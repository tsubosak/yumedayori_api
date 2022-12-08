import { Module } from "@nestjs/common"
import { AlbumModule } from "./api/album/album.module"
import { ArtistModule } from "./api/artist/artist.module"
import { TrackModule } from "./api/track/track.module"
import { PrismaModule } from "./prisma.module"

@Module({
  imports: [PrismaModule, ArtistModule, TrackModule, AlbumModule],
})
export class AppModule {}
