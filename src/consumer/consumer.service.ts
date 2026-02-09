import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { NotificationProcessorService } from '../notification/notification-processor.service';

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly queue: QueueService,
    private readonly processor: NotificationProcessorService,
  ) { }

  async onModuleInit() {
    await this.queue.consume(async ({ raw, body, ack, nack }) => {
      try {
        await this.processor.process(body);
        ack(); 
      } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
          this.logger.warn(`duplicate -> ack. ${err.message}`);
          ack(); 
          return;
        }

        this.logger.error(`process error -> requeue: ${err?.message ?? err}`);
        nack(true); 
      }
    });
  }
}
