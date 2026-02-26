import "dotenv/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { ValidationPipe } from "@nestjs/common";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { PermissionGuard } from "./auth/guards/permission.guard";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Conference CFP Server API")
    .setDescription("The Conference CFP Server API description")
    .setVersion("1.0")
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, documentFactory);

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new PermissionGuard(reflector),
  );

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
