import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConsumerModule } from './consumer/consumer.module';
import { EventInboxModule } from './controller/event-inbox.module';
import { DbModule } from './db/db.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    DbModule,
    QueueModule,

    ConsumerModule,
    EventInboxModule,
  ],
})
export class AppModule {}
