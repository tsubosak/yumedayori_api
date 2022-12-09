import { Module } from "@nestjs/common"
import { Neo4jModule } from "../../neo4j.module"
import { PrismaModule } from "../../prisma.module"
import { AlbumController } from "./album.controller"

@Module({
  imports: [PrismaModule, Neo4jModule],
  controllers: [AlbumController],
})
export class AlbumModule {}
