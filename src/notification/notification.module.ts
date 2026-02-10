import { Module } from '@nestjs/common';
import { NotificationProcessorService } from './notification-processor.service';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [RepoModule],
  providers: [NotificationProcessorService],
  exports: [NotificationProcessorService],
})
export class NotificationModule {}
