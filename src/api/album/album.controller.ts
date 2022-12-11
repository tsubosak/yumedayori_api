import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from "@nestjs/common"
import { PrismaService } from "../../prisma.service"
import { createZodDto, ZodValidationPipe } from "@abitia/zod-dto"
import { z } from "zod"
import { Album } from "@prisma/client"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"
import { Neo4JService } from "../../neo4j.service"
import { Integer } from "neo4j-driver"

const numericString = z.string().transform((x) => parseInt(x, 10))

const findOneParams = z.object({
  id: numericString,
})
class FindOneParamsDto extends createZodDto(findOneParams) {}

const createBody = z.object({
  title: z.string(),
  artwork: z.optional(z.string()),
  trackIds: z.optional(z.array(z.number())),
})
class CreateBodyDto extends createZodDto(createBody) {}

const patchBody = z.object({
  title: z.optional(z.string()),
  artwork: z.optional(z.string()),
})
class PatchBodyDto extends createZodDto(patchBody) {}

const addTrackBody = z.object({
  trackIds: z.array(z.number()),
})
class AddTrackBodyDto extends createZodDto(addTrackBody) {}

const removeTrackParam = z.object({
  id: numericString,
  trackId: numericString,
})
class RemoveTrackParamDto extends createZodDto(removeTrackParam) {}

const findManyQuery = z.object({
  q: z.optional(z.string().min(1)),
  p: z.optional(numericString),
})
class FindManyQueryDto extends createZodDto(findManyQuery) {}

@Controller("albums")
@UsePipes(ZodValidationPipe)
export class AlbumController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly neo4jService: Neo4JService
  ) {}

  @Get()
  async findMany(@Query() { q, p }: FindManyQueryDto): Promise<Album[]> {
    const albums = await this.prismaService.album.findMany({
      where: q ? { title: { contains: q } } : {},
      take: 100,
      skip: (p ?? 0) * 100,
    })

    return albums
  }

  @Get(":id")
  async findOne(@Param() { id }: FindOneParamsDto): Promise<Album> {
    const album = await this.prismaService.album.findUnique({
      include: { tracks: { include: { artists: true } } },
      where: { id },
    })
    if (!album) {
      throw new HttpException("album not found", HttpStatus.NOT_FOUND)
    }

    return album
  }

  @Patch(":id")
  async patchOne(
    @Param() { id }: FindOneParamsDto,
    @Body() data: PatchBodyDto
  ) {
    const track = await this.prismaService.track.update({
      where: { id },
      data,
    })
    if (!track) {
      throw new HttpException("track not found", HttpStatus.NOT_FOUND)
    }

    return track
  }

  @Post(":id/tracks")
  async addAlbum(
    @Param() { id }: FindOneParamsDto,
    @Body() { trackIds }: AddTrackBodyDto
  ) {
    const track = await this.prismaService.album.update({
      where: { id },
      data: {
        tracks: {
          connect: trackIds.map((id) => ({
            id,
          })),
        },
      },
      include: { tracks: true },
    })

    return track.tracks
  }

  @Delete(":id/tracks/:trackId")
  async removeAlbum(@Param() { id, trackId }: RemoveTrackParamDto) {
    const track = await this.prismaService.album.update({
      where: { id },
      data: {
        tracks: {
          disconnect: { id: trackId },
        },
      },
      include: { tracks: true },
    })

    return track.tracks
  }

  @Post()
  async create(@Body() data: CreateBodyDto) {
    try {
      const album = await this.prismaService.album.upsert({
        where: { title: data.title },
        update: {},
        create: {
          title: data.title,
          artwork: data.artwork,
          tracks: {
            connect: data.trackIds?.map((id) => ({
              id,
            })),
          },
        },
        include: { tracks: true },
      })
      const session = this.neo4jService.driver.session()
      const txc = session.beginTransaction()
      try {
        await txc.run(`MERGE (a:Album {id: $id, title: $title})`, {
          id: new Integer(album.id),
          title: album.title,
        })
        for (const track of album.tracks) {
          await txc.run(
            `
            MATCH (a:Album {id: $id}), (b:Track {id: $trackId})
            MERGE (b)-[r:TRACK_OF]->(a)
            `,
            {
              id: new Integer(album.id),
              trackId: new Integer(track.id),
            }
          )
        }
        await txc.commit()
      } catch (error) {
        console.error(error)
        await txc.rollback()
      } finally {
        await session.close()
      }
      return album
    } catch (error) {
      console.error(error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
