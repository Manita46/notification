import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const PORT = process.env.PORT || 3001;

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(PORT);
  console.log(`Notification service listening on port ${PORT}`);
}

bootstrap();
