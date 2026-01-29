import { Module } from '@nestjs/common';
import { ConsumerService } from './consumer.service';
import { QueueModule } from 'src/queue/queue.module';

@Module({
    imports: [QueueModule],
    providers: [ConsumerService],
})
export class ConsumerModule { }
