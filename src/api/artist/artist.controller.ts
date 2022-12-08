import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Redirect,
  UsePipes,
} from "@nestjs/common"
import { PrismaService } from "../../prisma.service"
import { createZodDto, ZodValidationPipe } from "@abitia/zod-dto"
import { z } from "zod"
import { Artist } from "@prisma/client"

type RedirectResponse = {
  url?: string | undefined
  statusCode?: number | undefined
}

const findOneParams = z.object({
  id: z.string().transform((x) => parseInt(x, 10)),
})
class FindOneParamsDto extends createZodDto(findOneParams) {}

const createBody = z.object({
  name: z.string(),
})
class CreateBodyDto extends createZodDto(createBody) {}

@Controller("artists")
@UsePipes(ZodValidationPipe)
export class ArtistController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async findMany(): Promise<Artist[]> {
    const artists = await this.prismaService.artist.findMany()

    return artists
  }

  @Get(":id")
  async findOne(@Param() { id }: FindOneParamsDto): Promise<Artist> {
    const artist = await this.prismaService.artist.findUnique({ where: { id } })
    if (!artist)
      throw new HttpException("artist not found", HttpStatus.NOT_FOUND)

    return artist
  }

  @Post()
  @Redirect()
  async create(
    @Body() data: CreateBodyDto
  ): Promise<RedirectResponse | undefined> {
    const artist = await this.prismaService.artist.create({ data })

    return { url: `/artists/${artist.id}`, statusCode: 201 }
  }
}
