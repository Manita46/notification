import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { NotificationRepo } from './notification.repo';

@Module({
  imports: [DbModule],
  providers: [NotificationRepo],
  exports: [NotificationRepo], 
})
export class RepoModule {}
