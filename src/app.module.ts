import { Module } from "@nestjs/common"
import { ArtistModule } from "./api/artist/artist.module"
import { TrackModule } from "./api/track/track.module"
import { PrismaModule } from "./prisma.module"

@Module({
  imports: [PrismaModule, ArtistModule, TrackModule],
})
export class AppModule {}
