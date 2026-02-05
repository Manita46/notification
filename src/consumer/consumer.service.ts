import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { NotificationProcessorService } from '../notification/notification-processor.service';

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly queue: QueueService,
    private readonly processor: NotificationProcessorService,
  ) {}

  async onModuleInit() {
    await this.queue.consume(async ({ body, raw, ack, nack }) => {
      if (!body) {
        this.logger.warn(`non-json -> ack raw=${raw}`);
        ack();
        return;
      }

      try {
        await this.processor.process(body);
        ack();
      } catch (e: any) {
        this.logger.error(`process error -> requeue: ${e?.message ?? e}`);
        nack(true);
      }
    });
  }
}
