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
  Redirect,
  UsePipes,
} from "@nestjs/common"
import { PrismaService } from "../../prisma.service"
import { createZodDto, ZodValidationPipe } from "@abitia/zod-dto"
import { z } from "zod"
import { Album } from "@prisma/client"
import { RedirectResponse } from "../../types"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"

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
})
class FindManyQueryDto extends createZodDto(findManyQuery) {}

@Controller("albums")
@UsePipes(ZodValidationPipe)
export class AlbumController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async findMany(@Query() { q }: FindManyQueryDto): Promise<Album[]> {
    const albums = await this.prismaService.album.findMany({
      where: { title: { contains: q } },
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
  @Redirect()
  async create(@Body() data: CreateBodyDto): Promise<RedirectResponse> {
    try {
      const track = await this.prismaService.album.create({
        data: {
          title: data.title,
          artwork: data.artwork,
          tracks: {
            connect: data.trackIds?.map((id) => ({
              id,
            })),
          },
        },
      })
      return { url: `/albums/${track.id}`, statusCode: 201 }
    } catch (error) {
      console.error(error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
