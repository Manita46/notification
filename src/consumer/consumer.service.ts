import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(private readonly queue: QueueService) {}

  async onModuleInit() {
    await this.queue.consume(async ({ raw, body, ack, nack }) => {
      if (body) {
        this.logger.log(
          `got eventTypeCode=${body.eventTypeCode ?? '-'} messageId=${body.messageId ?? '-'} correlationId=${body.correlationId ?? '-'}`
        );
        ack();
        return;
      }

      this.logger.warn(`got (non-json) raw=${raw}`);
      ack();

    });
  }
}
