import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { QueueModule } from '../queue/queue.module';
import { DbModule } from '../db/db.module';
import { NotificationRepo } from '../repo/notification.repo';
import { NotificationDeliveryRepo } from 'src/repo/notification-delivery.repo';

@Module({
  imports: [QueueModule, DbModule],
  providers: [ConsumerService, NotificationRepo, NotificationDeliveryRepo,],
})
export class ConsumerModule {}
