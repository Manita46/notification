import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepo } from '../repo/notification.repo';

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
  if (body.messageId !== undefined && typeof body.messageId !== 'string') return false;

  return true;
}

@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);

  constructor(private readonly repo: NotificationRepo) {}

  private pickRecipient(recipientsJson: any, channel: string): string | null {
    if (!recipientsJson || typeof recipientsJson !== 'object') return null;

    for (const roleKey of Object.keys(recipientsJson)) {
      const obj = recipientsJson[roleKey];
      if (obj && typeof obj === 'object' && obj[channel]) {
        return String(obj[channel]);
      }
    }
    return null;
  }

  async process(body: any) {
    // validation (ยังไม่ทำ DLQ)
    if (!isValidIncoming(body)) {
      this.logger.warn(`invalid payload -> skip. body=${JSON.stringify(body)}`);
      return;
    }

    const eventTypeCode = body.eventType.trim();
    const correlationId = body.correlationId?.trim() ?? null;
    const messageId = body.messageId ?? `gen:${Date.now()}:${Math.random().toString(16).slice(2)}`;

    this.logger.log(`consume messageId=${messageId} eventType=${eventTypeCode}`);

    const configs = await this.repo.getConfigsByEventType(eventTypeCode);
    this.logger.log(`[ROWS] ${configs.length}`);

    if (!configs.length) {
      this.logger.warn(`config not found for eventType=${eventTypeCode} -> skip`);
      return;
    }

    const inboxIds = await this.repo.insertInboxFromConfigs({
      messageId,
      eventTypeCode,
      correlationId,
      payload: body.payload,
      configs,
    });

    for (let i = 0; i < inboxIds.length; i++) {
      const cfg = configs[i];
      const isInApp = cfg.channel === 'In-app';

const recipientStr = isInApp
  ? '-'                         // in-app ไม่ต้องหา recipient
  : this.pickRecipient(cfg.recipients, cfg.channel);

await this.repo.insertDeliveryLog({
  eventInboxId: inboxIds[i],
  channel: cfg.channel,
  recipient: recipientStr ?? '-',
  sendStatus: isInApp || recipientStr ? 'SUCCESS' : 'FAILED',
  errorMessage:
    isInApp || recipientStr
      ? null
      : `recipient not found for channel=${cfg.channel}`,
});
    }

    this.logger.log(`done inbox=${inboxIds.length} log=${inboxIds.length}`);
  }
}
