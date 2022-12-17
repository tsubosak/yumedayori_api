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
import { Track } from "@prisma/client"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime"
import { Neo4JService } from "../../neo4j.service"
import { Integer, Node, Relationship } from "neo4j-driver"
import { TrimedEdge, TrimedNode } from "../../types"

const numericString = z.string().transform((x) => parseInt(x, 10))

const findOneParams = z.object({
  id: numericString,
})
class FindOneParamsDto extends createZodDto(findOneParams) {}

const creditEnums = z.enum([
  "PRODUCER",
  "WRITER",
  "COMPOSER",
  "ARRANGER",
  "PERFORMER",
  "MIXER",
  "MASTERER",
  "ENGINEER",
  "LYRICIST",
  "OTHER",
])

const createBody = z.object({
  title: z.string(),
  artistIds: z.optional(z.array(z.number())),
  albumIds: z.optional(z.array(z.number())),
  credits: z.array(z.object({ artistId: z.number(), creditedAs: creditEnums })),
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

const addCredittBody = z.object({
  credits: z.array(z.object({ artistId: z.number(), creditedAs: creditEnums })),
})
class AddCreditBodyDto extends createZodDto(addCredittBody) {}

const removeCreditParam = z.object({
  id: numericString,
  artistId: numericString,
  creditedAs: creditEnums,
})
class RemoveCreditParamDto extends createZodDto(removeCreditParam) {}

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
  p: z.optional(numericString),
})
class FindManyQueryDto extends createZodDto(findManyQuery) {}

@Controller("tracks")
@UsePipes(ZodValidationPipe)
export class TrackController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly neo4jService: Neo4JService
  ) {}

  @Get()
  async findMany(@Query() { q, p }: FindManyQueryDto): Promise<Track[]> {
    const tracks = await this.prismaService.track.findMany({
      where: q ? { title: { contains: q, mode: "insensitive" } } : {},
      take: 100,
      skip: (p ?? 0) * 100,
    })

    return tracks
  }

  @Get(":id")
  async findOne(@Param() { id }: FindOneParamsDto): Promise<Track> {
    const track = await this.prismaService.track.findUnique({
      include: {
        albums: true,
        artists: true,
        credits: {
          include: { artist: true },
        },
      },
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

  @Get(":id/relationships")
  async relationships(@Param() { id }: FindOneParamsDto) {
    const session = this.neo4jService.driver.session()
    try {
      const result = await session.run(
        `
MATCH (n: Track{id: $id})
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

    const session = this.neo4jService.driver.session()
    const txc = session.beginTransaction()
    try {
      for (const artist of track.artists) {
        await txc.run(
          `
            MATCH (a:Track {id: $id}), (b:Artist {id: $artistId})
            MERGE (a)-[r:BY]->(b)
            `,
          {
            id: new Integer(track.id),
            artistId: new Integer(artist.id),
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

    const session = this.neo4jService.driver.session()
    try {
      await session.run(
        `
          MATCH (a:Track {id: $id}), (b:Artist {id: $artistId})
          MERGE (a)-[r:BY]->(b)
          DELETE r
          `,
        {
          id: new Integer(id),
          artistId: new Integer(artistId),
        }
      )
    } catch (error) {
      console.error(error)
    } finally {
      await session.close()
    }

    return track.artists
  }

  @Post(":id/credits")
  async addCredit(
    @Param() { id }: FindOneParamsDto,
    @Body() { credits }: AddCreditBodyDto
  ) {
    const track = await this.prismaService.track.update({
      where: { id },
      data: {
        credits: {
          create: credits.map((credit) => ({
            artistId: credit.artistId,
            creditedAs: credit.creditedAs,
          })),
        },
      },
      include: { credits: { include: { artist: true } } },
    })

    const session = this.neo4jService.driver.session()
    const txc = session.beginTransaction()
    try {
      for (const credit of track.credits) {
        await txc.run(
          `
            MATCH (a:Track {id: $id}), (b:Artist {id: $artistId})
            MERGE (b)-[r:${credit.creditedAs}]->(a)
            `,
          {
            id: new Integer(track.id),
            artistId: new Integer(credit.artist.id),
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

    return track.credits
  }

  @Delete(":id/credits/:artistId/:creditedAs")
  async removeCredit(
    @Param() { id, artistId, creditedAs }: RemoveCreditParamDto
  ) {
    const currentTrack = await this.prismaService.track.findUnique({
      where: { id },
      include: { credits: { include: { artist: true } } },
    })
    const credit = currentTrack?.credits.find(
      (parent) =>
        parent.artistId === artistId && parent.creditedAs === creditedAs
    )
    if (!credit) {
      throw new HttpException("parent not found", HttpStatus.NOT_FOUND)
    }
    const track = await this.prismaService.track.update({
      where: { id },
      data: {
        credits: {
          delete: {
            artistId_trackId_creditedAs: {
              artistId,
              trackId: id,
              creditedAs,
            },
          },
        },
      },
      include: { credits: { include: { artist: true } } },
    })

    const session = this.neo4jService.driver.session()
    try {
      await session.run(
        `
          MATCH (a:Track {id: $id}), (b:Artist {id: $artistId})
          MERGE (b)-[r:${credit.creditedAs}]->(a)
          DELETE r
          `,
        {
          id: new Integer(id),
          artistId: new Integer(credit.artistId),
        }
      )
    } catch (error) {
      console.error(error)
    } finally {
      await session.close()
    }

    return track.credits
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

    const session = this.neo4jService.driver.session()
    const txc = session.beginTransaction()
    try {
      for (const album of track.albums) {
        await txc.run(
          `
            MATCH (a:Track {id: $id}), (b:Album {id: $albumId})
            MERGE (a)-[r:TRACK_OF]->(b)
            `,
          {
            id: new Integer(track.id),
            albumId: new Integer(album.id),
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

    const session = this.neo4jService.driver.session()
    try {
      await session.run(
        `
          MATCH (a:Track {id: $id}), (b:Album {id: $albumId})
          MERGE (a)-[r:TRACK_OF]->(b)
          DELETE r
          `,
        {
          id: new Integer(id),
          albumId: new Integer(albumId),
        }
      )
    } catch (error) {
      console.error(error)
    } finally {
      await session.close()
    }

    return track.albums
  }

  @Post()
  async create(@Body() data: CreateBodyDto) {
    try {
      // TODO: prisma no issue ni subeki
      const currentTrack = await this.prismaService.track.findUnique({
        where: { title: data.title },
      })
      const track = await this.prismaService.track.upsert({
        where: { title: data.title },
        update: {
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
          credits: {
            connectOrCreate: data.credits?.map((credit) => ({
              where: {
                artistId_trackId_creditedAs: {
                  artistId: credit.artistId,
                  trackId: currentTrack?.id || -1,
                  creditedAs: credit.creditedAs,
                },
              },
              create: {
                artist: { connect: { id: credit.artistId } },
                creditedAs: credit.creditedAs,
              },
            })),
          },
        },
        create: {
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
          credits: {
            create: data.credits?.map((credit) => ({
              artist: { connect: { id: credit.artistId } },
              creditedAs: credit.creditedAs,
            })),
          },
        },
        include: {
          artists: true,
          albums: true,
          credits: { include: { artist: true } },
        },
      })
      const session = this.neo4jService.driver.session()
      const txc = session.beginTransaction()
      try {
        await txc.run(`MERGE (a:Track {id: $id, title: $title})`, {
          id: new Integer(track.id),
          title: track.title,
        })
        for (const artist of track.artists) {
          await txc.run(
            `
            MATCH (a:Track {id: $id}), (b:Artist {id: $artistId})
            MERGE (a)-[r:BY]->(b)
            `,
            {
              id: new Integer(track.id),
              artistId: new Integer(artist.id),
            }
          )
        }
        for (const album of track.albums) {
          await txc.run(
            `
            MATCH (a:Track {id: $id}), (b:Album {id: $albumId})
            MERGE (a)-[r:TRACK_OF]->(b)
            `,
            {
              id: new Integer(track.id),
              albumId: new Integer(album.id),
            }
          )
        }
        for (const credit of track.credits) {
          await txc.run(
            `
            MATCH (a:Track {id: $id}), (b:Artist {id: $artistId})
            MERGE (b)-[r:${credit.creditedAs}]->(a)
            `,
            {
              id: new Integer(track.id),
              artistId: new Integer(credit.artistId),
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
      return track
    } catch (error) {
      console.error(error)
      if (error instanceof PrismaClientKnownRequestError) {
        throw new HttpException(error.code, HttpStatus.BAD_REQUEST)
      }
      throw error
    }
  }
}
