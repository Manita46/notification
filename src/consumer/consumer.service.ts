import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { NotificationRepo } from '../repo/notification.repo';
import { NotificationDeliveryRepo } from 'src/repo/notification-delivery.repo';

type IncomingMessage = {
  eventType: string;
  correlationId?: string;
  payload: Record<string, any>;
  messageId?: string;
};

function isValidIncoming(body: any): body is IncomingMessage {
  if (!body || typeof body !== 'object') return false;

  if (typeof body.eventType !== 'string' || !body.eventType.trim()) return false;

  const payload = body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;

  if (body.correlationId !== undefined && typeof body.correlationId !== 'string') return false;

  return true;
}

@Injectable()
export class ConsumerService implements OnModuleInit {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repo: NotificationRepo,
    private readonly deliveryRepo: NotificationDeliveryRepo,
  ) { }

  async onModuleInit() {
    await this.queue.consume(async ({ raw, body, ack, nack }) => {
      // 1) JSON parse ไม่ได้
      if (!body) {
        this.logger.warn(`invalid json -> ack. raw=${raw}`);
        ack();
        return;
      }

      // 2) validation ขั้นต่ำ (ยังไม่ทำ DLQ)
      if (!isValidIncoming(body)) {
        this.logger.warn(`invalid payload -> ack. body=${JSON.stringify(body)}`);
        ack();
        return;
      }

      const eventTypeCode = body.eventType.trim();
      const correlationId = body.correlationId?.trim() ?? null;
      const messageId = body.messageId ?? null;

      try {
        // this.logger.log(`consume messageId=${body?.messageId ?? '-'} eventType=${eventTypeCode}`);
        const configs = await this.repo.getConfigsByEventType(eventTypeCode);

        if (!configs.length) {
          this.logger.warn(`config not found for eventType=${eventTypeCode} -> ack`);
          ack();
          return;
        }

        const inboxIds = await this.repo.insertInbox({
          messageId,
          eventTypeCode,
          correlationId,
          payload: body.payload,
          configs: configs,
        });

        this.logger.log(`event processed eventType=${eventTypeCode}`);
        ack();
      } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') {
          this.logger.warn(`duplicate -> ack`);
          ack();
          return;
        }
        this.logger.error(`db error -> requeue: ${err?.message ?? err}`);
        nack(true);
      }
    });
  }
}
