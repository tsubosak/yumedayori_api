import { Module } from "@nestjs/common"
import { PrismaModule } from "../../prisma.module"
import { TrackController } from "./track.controller"

@Module({ imports: [PrismaModule], controllers: [TrackController] })
export class TrackModule {}
