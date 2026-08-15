import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { environment } from "./config/environment.js";

async function bootstrap(): Promise<void> {
  const config = environment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.enableCors({
    origin: config.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  });
  app.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle("Smart Home API")
    .setDescription("Bilingual smart-plug energy management API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, () =>
    SwaggerModule.createDocument(app, openApiConfig)
  );

  await app.listen(config.PORT, "0.0.0.0");
}

void bootstrap();
