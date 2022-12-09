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
import { Artist } from "@prisma/client"
import { RedirectResponse } from "../../types"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"
import { IntersectionDicService } from "../../intersection-dic.service"
import { Neo4JService } from "../../neo4j.service"
import { Integer } from "neo4j-driver"

const numericString = z.string().transform((x) => parseInt(x, 10))

const findOneParams = z.object({
  id: numericString,
})
class FindOneParamsDto extends createZodDto(findOneParams) {}

const ParentTypeEnum = z.enum(["CONSIST_OF", "VOICED_BY"])

const createBody = z.object({
  name: z.string(),
  yomi: z.optional(z.string()),
  type: z.enum(["INDIVIDUAL", "GROUP"]),
  parents: z.optional(
    z.array(
      z.object({
        artistId: z.number(),
        type: z.optional(ParentTypeEnum),
      })
    )
  ),
})
class CreateBodyDto extends createZodDto(createBody) {}

const patchBody = z.object({
  name: z.optional(z.string()),
  yomi: z.optional(z.string()),
})
class PatchBodyDto extends createZodDto(patchBody) {}

const addParentBody = z.object({
  parents: z.optional(
    z.array(
      z.object({
        artistId: z.number(),
        type: z.optional(ParentTypeEnum),
      })
    )
  ),
})
class AddParentBodyDto extends createZodDto(addParentBody) {}

const removeParentParam = z.object({
  id: numericString,
  parentId: numericString,
})
class RemoveParentParamDto extends createZodDto(removeParentParam) {}

const findManyQuery = z.object({
  q: z.optional(z.string().min(1)),
})
class FindManyQueryDto extends createZodDto(findManyQuery) {}

@Controller("artists")
@UsePipes(ZodValidationPipe)
export class ArtistController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly intersectionDicService: IntersectionDicService,
    private readonly neo4jService: Neo4JService
  ) {}

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
      include: {
        parents: {
          include: { parent: true },
        },
        children: { include: { child: true } },
        tracks: { include: { albums: true } },
      },
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
    @Body() { parents }: AddParentBodyDto
  ) {
    const artist = await this.prismaService.artist.update({
      where: { id },
      data: {
        parents: {
          create: parents?.map((parent) => ({
            parentId: parent.artistId,
            parentType: parent.type,
          })),
        },
      },
      include: { parents: { include: { parent: true } } },
    })

    return artist.parents
  }

  @Delete(":id/parents/:parentId")
  async removeParent(@Param() { id, parentId }: RemoveParentParamDto) {
    const artist = await this.prismaService.artist.update({
      where: { id },
      data: {
        parents: {
          delete: { parentId_childId: { parentId, childId: id } },
        },
      },
      include: { parents: { include: { parent: true } } },
    })

    return artist.parents
  }

  @Post()
  @Redirect()
  async create(@Body() data: CreateBodyDto): Promise<RedirectResponse> {
    try {
      const artist = await this.prismaService.artist.upsert({
        where: { name: data.name },
        update: {},
        create: {
          name: data.name,
          yomi: data.yomi || this.intersectionDicService.map[data.name],
          type: data.type,
          parents: {
            create: data.parents?.map((parent) => ({
              parentId: parent.artistId,
              parentType: parent.type,
            })),
          },
        },
        include: { parents: { include: { parent: true } } },
      })
      const session = this.neo4jService.driver.session()
      const txc = session.beginTransaction()
      try {
        await txc.run(
          `
        MERGE (a:Artist {id: $id, name: $name, yomi: $yomi, type: $type})
        `,
          {
            id: new Integer(artist.id),
            name: artist.name,
            yomi: artist.yomi,
            type: artist.type,
          }
        )
        for (const parent of artist.parents) {
          await txc.run(
            `
          MATCH (a:Artist {id: $id}), (b:Artist {id: $parentId})
          MERGE (a)-[r:${parent.parentType}]->(b)
          `,
            {
              id: new Integer(artist.id),
              parentId: new Integer(parent.parentId),
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
