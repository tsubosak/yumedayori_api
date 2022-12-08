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
import { Track } from "@prisma/client"
import { RedirectResponse } from "../../types"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"

const numericString = z.string().transform((x) => parseInt(x, 10))

const findOneParams = z.object({
  id: numericString,
})
class FindOneParamsDto extends createZodDto(findOneParams) {}

const createBody = z.object({
  title: z.string(),
  artistIds: z.optional(z.array(z.number())),
  albumIds: z.optional(z.array(z.number())),
})
class CreateBodyDto extends createZodDto(createBody) {}

const patchBody = z.object({
  title: z.optional(z.string()),
  artwork: z.optional(z.string()),
})
class PatchBodyDto extends createZodDto(patchBody) {}

const addArtistBody = z.object({
  artistIds: z.array(z.number()),
})
class AddArtistBodyDto extends createZodDto(addArtistBody) {}

const removeArtistParam = z.object({
  id: numericString,
  artistId: numericString,
})
class RemoveArtistParamDto extends createZodDto(removeArtistParam) {}

const addAlbumBody = z.object({
  albumIds: z.array(z.number()),
})
class AddAlbumBodyDto extends createZodDto(addAlbumBody) {}

const removeAlbumParam = z.object({
  id: numericString,
  albumId: numericString,
})
class RemoveAlbumParamDto extends createZodDto(removeAlbumParam) {}

const findManyQuery = z.object({
  q: z.optional(z.string().min(1)),
})
class FindManyQueryDto extends createZodDto(findManyQuery) {}

@Controller("tracks")
@UsePipes(ZodValidationPipe)
export class TrackController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async findMany(@Query() { q }: FindManyQueryDto): Promise<Track[]> {
    const tracks = await this.prismaService.track.findMany({
      where: { title: { contains: q } },
    })

    return tracks
  }

  @Get(":id")
  async findOne(@Param() { id }: FindOneParamsDto): Promise<Track> {
    const track = await this.prismaService.track.findUnique({
      include: { albums: true, artists: true },
      where: { id },
    })
    if (!track) {
      throw new HttpException("track not found", HttpStatus.NOT_FOUND)
    }

    return track
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

  @Post(":id/artists")
  async addArtist(
    @Param() { id }: FindOneParamsDto,
    @Body() { artistIds }: AddArtistBodyDto
  ) {
    const track = await this.prismaService.track.update({
      where: { id },
      data: {
        artists: {
          connect: artistIds.map((id) => ({
            id,
          })),
        },
      },
      include: { artists: true },
    })

    return track.artists
  }

  @Delete(":id/artists/:artistId")
  async removeArtist(@Param() { id, artistId }: RemoveArtistParamDto) {
    const track = await this.prismaService.track.update({
      where: { id },
      data: {
        artists: {
          disconnect: { id: artistId },
        },
      },
      include: { artists: true },
    })

    return track.artists
  }

  @Post(":id/albums")
  async addAlbum(
    @Param() { id }: FindOneParamsDto,
    @Body() { albumIds }: AddAlbumBodyDto
  ) {
    const track = await this.prismaService.track.update({
      where: { id },
      data: {
        albums: {
          connect: albumIds.map((id) => ({
            id,
          })),
        },
      },
      include: { albums: true },
    })

    return track.albums
  }

  @Delete(":id/albums/:albumId")
  async removeAlbum(@Param() { id, albumId }: RemoveAlbumParamDto) {
    const track = await this.prismaService.track.update({
      where: { id },
      data: {
        albums: {
          disconnect: { id: albumId },
        },
      },
      include: { albums: true },
    })

    return track.albums
  }

  @Post()
  @Redirect()
  async create(@Body() data: CreateBodyDto): Promise<RedirectResponse> {
    try {
      const track = await this.prismaService.track.create({
        data: {
          title: data.title,
          artists: {
            connect: data.artistIds?.map((parentId) => ({
              id: parentId,
            })),
          },
          albums: {
            connect: data.albumIds?.map((parentId) => ({
              id: parentId,
            })),
          },
        },
      })
      return { url: `/tracks/${track.id}`, statusCode: 201 }
    } catch (error) {
      console.error(error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
