import { Module } from "@nestjs/common"
import { Neo4jModule } from "../../neo4j.module"
import { PrismaModule } from "../../prisma.module"
import { TrackController } from "./track.controller"

@Module({
  imports: [PrismaModule, Neo4jModule],
  controllers: [TrackController],
})
export class TrackModule {}
