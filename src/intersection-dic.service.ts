import {
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Injectable,
} from "@nestjs/common"
import fs from "fs"

@Injectable()
export class IntersectionDicService implements OnModuleInit, OnModuleDestroy {
  map: Record<string, string> = {}
  constructor() {}
  async onModuleInit() {
    this.map = JSON.parse(
      await fs.promises.readFile("./data/intersection-dic.json", "utf-8")
    )
    Logger.log(
      "IntersectionDicModule: loaded " +
        Object.keys(this.map).length +
        " entries."
    )
  }

  async onModuleDestroy() {}
}
