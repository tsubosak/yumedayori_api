import {
  Body,
  Controller,
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
import { Artist } from "@prisma/client"
import { RedirectResponse } from "../../types"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"

const numericString = z.string().transform((x) => parseInt(x, 10))

const findOneParams = z.object({
  id: numericString,
})
class FindOneParamsDto extends createZodDto(findOneParams) {}

const createBody = z.object({
  name: z.string(),
  artwork: z.optional(z.string()),
  parentIds: z.optional(z.array(z.number())),
})
class CreateBodyDto extends createZodDto(createBody) {}

const patchBody = z.object({
  name: z.optional(z.string()),
  artwork: z.optional(z.string()),
})
class PatchBodyDto extends createZodDto(patchBody) {}

const addParentBody = z.object({
  parentIds: z.array(z.number()),
})
class AddParentBodyDto extends createZodDto(addParentBody) {}

const findManyQuery = z.object({
  q: z.optional(z.string().min(1)),
})
class FindManyQueryDto extends createZodDto(findManyQuery) {}

@Controller("artists")
@UsePipes(ZodValidationPipe)
export class ArtistController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async findMany(@Query() { q }: FindManyQueryDto): Promise<Artist[]> {
    const artists = await this.prismaService.artist.findMany({
      where: { name: { contains: q } },
    })

    return artists
  }

  @Get(":id")
  async findOne(@Param() { id }: FindOneParamsDto): Promise<Artist> {
    const artist = await this.prismaService.artist.findUnique({
      include: { parents: true, children: true, tracks: true, albums: true },
      where: { id },
    })
    if (!artist)
      throw new HttpException("artist not found", HttpStatus.NOT_FOUND)

    return artist
  }

  @Patch(":id")
  async patchOne(
    @Param() { id }: FindOneParamsDto,
    @Body() data: PatchBodyDto
  ) {
    const artist = await this.prismaService.artist.update({
      where: { id },
      data,
    })
    if (!artist) {
      throw new HttpException("artist not found", HttpStatus.NOT_FOUND)
    }

    return artist
  }

  @Post(":id/parents")
  async addParent(
    @Param() { id }: FindOneParamsDto,
    @Body() { parentIds }: AddParentBodyDto
  ) {
    const artist = await this.prismaService.artist.update({
      where: { id },
      data: {
        parents: {
          connect: parentIds.map((parentId) => ({
            id: parentId,
          })),
        },
      },
      include: { parents: true },
    })

    return artist.parents
  }

  @Post()
  @Redirect()
  async create(@Body() data: CreateBodyDto): Promise<RedirectResponse> {
    try {
      const artist = await this.prismaService.artist.create({
        data: {
          name: data.name,
          artwork: data.artwork,
          parents: {
            connect: data.parentIds?.map((parentId) => ({
              id: parentId,
            })),
          },
        },
      })
      return { url: `/artists/${artist.id}`, statusCode: 201 }
    } catch (error) {
      console.error(error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
