import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class NotificationRepo {
  constructor(private readonly db: DbService) {}

  async getConfigsByEventType(eventTypeCode: string) {
    const pool = this.db.getPool();

    const sql = `
      SELECT
        ne.event_type_code,
        nc.channel,
        nr.template_type,
        JSON_UNQUOTE(JSON_EXTRACT(nt.template, '$.subject')) AS subject,
        JSON_UNQUOTE(JSON_EXTRACT(nt.template, '$.body')) AS body,
        nr.recipients
      FROM notification_event ne
      JOIN notification_channel nc ON nc.notification_event_id = ne.id
      JOIN notification_recipient nr ON nr.notification_channel_id = nc.id
      JOIN notification_template nt ON nt.id = nr.template_id
      WHERE ne.event_type_code = ?;
    `;

    const [rows] = await pool.query<any[]>(sql, [eventTypeCode]);
    return rows;
  }

  async insertInboxFromConfigs(args: {
    messageId: string;
    eventTypeCode: string;
    correlationId: string | null;
    payload: any;
    configs: any[];
  }): Promise<number[]> {
    const pool = this.db.getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const insertSql = `
        INSERT INTO event_inbox
          (message_id, event_type_code, channel, template_type, subject, recipients, correlation_id, payload, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW());
      `;

      const ids: number[] = [];

      for (const c of args.configs) {
        // message_id ใน table UNIQUE → ต้อง unique ต่อแถว
        const msgIdForRow = `${args.messageId}:${c.channel}:${c.template_type}`;

        const [result]: any = await conn.query(insertSql, [
          msgIdForRow,
          args.eventTypeCode,
          c.channel,
          c.template_type,
          c.subject,
          JSON.stringify(c.recipients ?? null),
          args.correlationId,
          JSON.stringify(args.payload ?? null),
        ]);

        ids.push(result.insertId);
      }

      await conn.commit();
      return ids;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async insertDeliveryLog(args: {
    eventInboxId: number;
    channel: string;
    recipient: string;
    sendStatus: 'SUCCESS' | 'FAILED';
    errorMessage?: string | null;
  }) {
    const pool = this.db.getPool();

    const sql = `
      INSERT INTO notification_delivery_log
        (event_inbox_id, channel, recipient, send_status, error_message, sent_at)
      VALUES (?, ?, ?, ?, ?, NOW());
    `;

    await pool.query(sql, [
      args.eventInboxId,
      args.channel,
      args.recipient,
      args.sendStatus,
      args.errorMessage ?? null,
    ]);
  }
}
