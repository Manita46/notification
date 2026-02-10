import { Module } from '@nestjs/common';
import { EventInboxController } from './event-inbox.controller';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [RepoModule],
  controllers: [EventInboxController],
})
export class EventInboxModule {}
