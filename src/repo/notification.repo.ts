import { Injectable } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { DbService } from '../db/db.service';

@Injectable()
export class NotificationRepo {
  private pool: Pool;

  constructor(db: DbService) {
    this.pool = db.getPool();
  }

  async getConfigsByEventType(eventTypeCode: string) {
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
    const [rows] = await this.pool.query<any[]>(sql, [eventTypeCode]);
    return rows;
  }

  async insertInboxFromConfigs(args: {
    messageId: string | null;
    eventTypeCode: string;
    correlationId: string | null;
    payload: any;
    configs: any[];
  }) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      const insertSql = `
        INSERT INTO event_inbox
          (message_id, event_type_code, channel, template_type, subject, recipients, payload, ref_id, received_at)
        VALUES ?
      `;

      const baseId = args.messageId ?? `gen:${Date.now()}:${Math.random().toString(16).slice(2)}`;

      const values = args.configs.map((c) => {
        // กันชน unique ถ้า inbox message_id ต้อง unique
        const inboxMessageId = `${baseId}:${c.channel}:${c.template_type}`;

        return [
          inboxMessageId,
          args.eventTypeCode,
          c.channel,
          c.template_type,
          c.subject,
          JSON.stringify(c.recipients ?? null),
          JSON.stringify(args.payload ?? null),
          args.correlationId,
          // received_at ใช้ใน SQL เป็น NOW() ไม่ได้เพราะ bulk VALUES ? เลยใส่เป็น Date
          new Date(),
        ];
      });

      await conn.query(insertSql, [values]);
      await conn.commit();
      return { inserted: values.length };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}
