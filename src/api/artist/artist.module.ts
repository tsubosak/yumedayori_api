import { Module } from "@nestjs/common"
import { IntersectionDicModule } from "../../intersection-dic.module"
import { PrismaModule } from "../../prisma.module"
import { ArtistController } from "./artist.controller"

@Module({
  imports: [PrismaModule, IntersectionDicModule],
  controllers: [ArtistController],
})
export class ArtistModule {}
