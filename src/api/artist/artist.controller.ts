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
import { Artist } from "@prisma/client"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"
import { IntersectionDicService } from "../../intersection-dic.service"
import { Neo4JService } from "../../neo4j.service"
import { Integer, Node, Relationship } from "neo4j-driver"

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
  p: z.optional(numericString),
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
  async findMany(@Query() { q, p }: FindManyQueryDto): Promise<Artist[]> {
    const artists = await this.prismaService.artist.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { yomi: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      take: 100,
      skip: (p ?? 0) * 100,
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
        credits: { include: { track: true } },
      },
      where: { id },
    })
    if (!artist)
      throw new HttpException("artist not found", HttpStatus.NOT_FOUND)

    return artist
  }

  @Get(":id/relationships")
  async relationships(@Param() { id }: FindOneParamsDto) {
    const session = this.neo4jService.driver.session()
    try {
      const result = await session.run(
        `
MATCH (n: Artist{id: $id})
OPTIONAL MATCH (ni)-[r1]->(n)
OPTIONAL MATCH (no)<-[r2]-(n)
OPTIONAL MATCH (ni)-[r3]->(nio)
OPTIONAL MATCH (nii)<-[r4]-(nii)
OPTIONAL MATCH (no)<-[r5]-(noi)
OPTIONAL MATCH (noo)-[r6]->(no)
WITH collect(n)+collect(ni)+collect(no)+collect(nio)+collect(nii)+collect(noi)+collect(noo) as nodez,
 collect(r1)+collect(r2)+collect(r3)+collect(r4)+collect(r5)+collect(r6) as edgez
RETURN
  REDUCE(s = [], n in nodez |
    CASE WHEN NOT n IN s THEN s + n ELSE s END) as nodez,
  REDUCE(s = [], n in edgez |
    CASE WHEN NOT n IN s THEN s + n ELSE s END) as edgez
    `,
        {
          id: new Integer(id),
        },
        { timeout: 6000 }
      )
      const nodes = (result.records[0].get("nodez") as Node[])
        .filter((n): n is Node => n instanceof Node)
        .map((node) => ({
          groupId: node.labels[0],
          id: node.elementId,
          label: node.properties.name || node.properties.title,
        }))

      const edges = (result.records[0].get("edgez") as Relationship[])
        .filter((n): n is Relationship => n instanceof Relationship)
        .map((edge) => ({
          source: edge.startNodeElementId,
          target: edge.endNodeElementId,
          label: edge.type,
        }))
      return { nodes, edges }
    } finally {
      session.close()
    }
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

  @Get(":id/recommends")
  async getRecommends(@Param() { id }: FindOneParamsDto) {
    const session = this.neo4jService.driver.session()
    try {
      const result = await session.run(
        `
    MATCH (a:Artist {id: $id})-[r]->(t:Track)<-[r2]-(b:Artist)

    WITH a, b, count(t) as i

    MATCH (a)-[r]-(c)
    WITH a, b, i, COLLECT(c) as s1c

    MATCH (b)-[r]-(d) WHERE NOT d IN s1c
    WITH a, b, i, s1c, COLLECT(d) as s2c

    RETURN b.id AS id, ((i * 1.0) / (SIZE(s1c) + SIZE(s2c))) AS score
    ORDER BY score DESC, id
    LIMIT $limit
    `,
        {
          id: new Integer(id),
          limit: Integer.fromNumber(10),
        }
      )
      const artists = await this.prismaService.artist.findMany({
        where: {
          id: { in: result.records.map((r) => r.get("id").toNumber()) },
        },
      })
      return artists
    } finally {
      session.close()
    }
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
          connectOrCreate: parents?.map((parent) => ({
            where: {
              parentId_childId: {
                parentId: parent.artistId,
                childId: id,
              },
            },
            create: {
              parentId: parent.artistId,
              parentType: parent.type,
            },
          })),
        },
      },
      include: { parents: { include: { parent: true } } },
    })
    const session = this.neo4jService.driver.session()
    const txc = session.beginTransaction()
    try {
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

    return artist.parents
  }

  @Delete(":id/parents/:parentId")
  async removeParent(@Param() { id, parentId }: RemoveParentParamDto) {
    const currentArtist = await this.prismaService.artist.findUnique({
      where: { id },
      include: { parents: { include: { parent: true } } },
    })
    const parent = currentArtist?.parents.find(
      (parent) => parent.parentId === parentId
    )
    if (!parent) {
      throw new HttpException("parent not found", HttpStatus.NOT_FOUND)
    }
    const artist = await this.prismaService.artist.update({
      where: { id },
      data: {
        parents: {
          delete: { parentId_childId: { parentId, childId: id } },
        },
      },
      include: { parents: { include: { parent: true } } },
    })

    const session = this.neo4jService.driver.session()
    try {
      await session.run(
        `
          MATCH (a:Artist {id: $id}), (b:Artist {id: $parentId})
          MATCH (a)-[r:${parent.parentType}]->(b)
          DELETE r
          `,
        {
          id: new Integer(artist.id),
          parentId: new Integer(parent.parentId),
        }
      )
    } catch (error) {
      console.error(error)
    } finally {
      await session.close()
    }

    return artist.parents
  }

  @Post()
  async create(@Body() data: CreateBodyDto) {
    try {
      const artist = await this.prismaService.artist.upsert({
        where: { name: data.name },
        update: {},
        create: {
          name: data.name,
          yomi:
            data.yomi ||
            this.intersectionDicService.map[data.name] ||
            this.intersectionDicService.map[data.name.replace(/\s/g, "")],
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
      return artist
    } catch (error) {
      console.error(error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
