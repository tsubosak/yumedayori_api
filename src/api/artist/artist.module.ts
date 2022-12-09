import { Module } from "@nestjs/common"
import { IntersectionDicModule } from "../../intersection-dic.module"
import { Neo4jModule } from "../../neo4j.module"
import { PrismaModule } from "../../prisma.module"
import { ArtistController } from "./artist.controller"

@Module({
  imports: [PrismaModule, IntersectionDicModule, Neo4jModule],
  controllers: [ArtistController],
})
export class ArtistModule {}
