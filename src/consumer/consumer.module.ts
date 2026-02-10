import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { QueueModule } from '../queue/queue.module';
import { DbModule } from '../db/db.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [QueueModule, DbModule, NotificationModule],
  providers: [ConsumerService],
})
export class ConsumerModule {}
