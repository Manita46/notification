import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { QueueModule } from '../queue/queue.module';
import { DbModule } from '../db/db.module';
import { NotificationRepo } from '../repo/notification.repo';

@Module({
  imports: [QueueModule, DbModule],
  providers: [ConsumerService, NotificationRepo],
})
export class ConsumerModule {}
