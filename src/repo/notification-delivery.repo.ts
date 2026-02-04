import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class NotificationDeliveryRepo {
  constructor(private readonly db: DbService) {}

  async insertDeliveryLog(args: {
    eventInboxId: number;
    channel: string;
    recipient: string;
    status: 'SENT' | 'FAILED';
    errorMessage?: string | null;
  }) {
    const pool = this.db.getPool();

    const sql = `
      INSERT INTO notification_delivery_log
        (event_inbox_id, channel, recipient, status, error_message, sent_at)
      VALUES (?, ?, ?, ?, ?, NOW());
    `;

    const params = [
      args.eventInboxId,
      args.channel,
      args.recipient,
      args.status,
      args.errorMessage ?? null,
    ];

    await pool.query(sql, params);
  }
}
