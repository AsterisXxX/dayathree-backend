import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DAYATHREE Backend API')
    .setDescription('Kopi Kuy Operations Platform')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  if (config.get<string>('NODE_ENV') !== 'production') {
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '127.0.0.1');
}

void bootstrap();