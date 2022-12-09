import { Module } from "@nestjs/common"
import { IntersectionDicService } from "./intersection-dic.service"

@Module({
  providers: [IntersectionDicService],
  exports: [IntersectionDicService],
})
export class IntersectionDicModule {}
