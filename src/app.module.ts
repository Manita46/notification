import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsumerModule } from './consumer/consumer.module';
import { QueueModule } from './queue/queue.module';
import { DbModule } from './db/db.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), 
    QueueModule,
    DbModule,
    ConsumerModule,
  ],
})
export class AppModule {}
