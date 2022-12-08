import { Module } from "@nestjs/common"
import { PrismaModule } from "../../prisma.module"
import { AlbumController } from "./album.controller"

@Module({ imports: [PrismaModule], controllers: [AlbumController] })
export class AlbumModule {}
