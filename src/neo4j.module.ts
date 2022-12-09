import { Module } from "@nestjs/common"
import { Neo4JService } from "./neo4j.service"

@Module({ providers: [Neo4JService], exports: [Neo4JService] })
export class Neo4jModule {}
