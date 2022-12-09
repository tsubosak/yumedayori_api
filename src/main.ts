import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"
import { patchNestjsSwagger } from "@abitia/zod-dto"

async function bootstrap() {
  patchNestjsSwagger()
  const app = await NestFactory.create(AppModule)

  const config = new DocumentBuilder()
    .setTitle("kizuna-music API")
    .setVersion("2.0")
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup("", app, document)

  await app.listen(7000)
}
bootstrap()
