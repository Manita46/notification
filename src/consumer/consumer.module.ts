import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { QueueModule } from '../queue/queue.module';
import { DbModule } from '../db/db.module';
import { NotificationRepo } from '../repo/notification.repo';
import { NotificationProcessorService } from '../notification/notification-processor.service';

@Module({
  imports: [QueueModule, DbModule],
  providers: [ConsumerService, NotificationProcessorService, NotificationRepo],
})
export class ConsumerModule {}
