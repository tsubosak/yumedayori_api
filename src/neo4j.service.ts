import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common"
import neo4j from "neo4j-driver"

@Injectable()
export class Neo4JService implements OnModuleInit, OnModuleDestroy {
  driver: typeof neo4j.Driver
  constructor() {
    this.driver = (null as unknown) as typeof neo4j.Driver
  }
  async onModuleInit() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URL!,
      neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
    )
  }

  async onModuleDestroy() {
    await this.driver.close()
  }
}
