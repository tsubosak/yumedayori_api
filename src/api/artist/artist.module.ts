import { Module } from "@nestjs/common"
import { PrismaModule } from "../../prisma.module"
import { ArtistController } from "./artist.controller"

@Module({ imports: [PrismaModule], controllers: [ArtistController] })
export class ArtistModule {}
