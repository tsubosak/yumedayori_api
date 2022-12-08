import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
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
  parentId: z.optional(z.number()),
})
class CreateBodyDto extends createZodDto(createBody) {}

const addParentBody = z.object({
  parentId: z.number(),
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
      include: { parent: true },
    })

    return artists
  }

  @Get(":id")
  async findOne(@Param() { id }: FindOneParamsDto): Promise<Artist> {
    const artist = await this.prismaService.artist.findUnique({
      include: { parent: true },
      where: { id },
    })
    if (!artist)
      throw new HttpException("artist not found", HttpStatus.NOT_FOUND)

    return artist
  }

  @Post(":id/parent")
  async addParent(
    @Param() { id }: FindOneParamsDto,
    @Body() { parentId }: AddParentBodyDto
  ) {
    const artist = await this.prismaService.artist.update({
      where: { id },
      data: { parent: { connect: { id: parentId } } },
    })

    return { parentId: artist.parentId }
  }

  @Post()
  @Redirect()
  async create(@Body() data: CreateBodyDto): Promise<RedirectResponse> {
    try {
      const artist = await this.prismaService.artist.create({
        data: {
          name: data.name,
          parent: data.parentId
            ? { connect: { id: data.parentId } }
            : undefined,
        },
      })
      return { url: `/artists/${artist.id}`, statusCode: 201 }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
