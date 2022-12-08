import { Module } from "@nestjs/common"
import { ArtistController } from "./api/artist/artist.controller"
import { ArtistModule } from "./api/artist/artist.module"
import { PrismaModule } from "./prisma.module"

@Module({
  imports: [PrismaModule, ArtistModule],
})
export class AppModule {}
