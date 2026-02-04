import { Injectable } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { DbService } from '../db/db.service';

@Injectable()
export class NotificationRepo {
  private readonly pool: Pool;

  constructor(private readonly db: DbService) { }

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
      JOIN notification_channel nc
          ON nc.notification_event_id = ne.id
      JOIN notification_recipient nr
          ON nr.notification_channel_id = nc.id
      JOIN notification_template nt
          ON nt.id = nr.template_id
      WHERE ne.event_type_code = 'BILLING_CALCULATED';
    `;

    // console.log('[SQL]', sql.trim());
    // const [rows] = await pool.query<any[]>(sql);
    // console.log('[ROWS]', rows.length);

    try {
      const [rows] = await pool.query<any[]>(sql, [eventTypeCode]);
      return rows;
    }
    catch (error) {
      console.log(error)
      throw error
    }

  }

  async insertInbox(args: {
    messageId: string | null;
    eventTypeCode: string;
    correlationId: string | null;
    payload: any;
    configs: any[];
  }) {
    const pool = this.db.getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const mqMessageId =
        args.messageId;
      // ?? `gen:${Date.now()}:${Math.random().toString(16).slice(2)}`;

      const insertSql = `
        INSERT INTO event_inbox
          (message_id, event_type_code, channel, template_type, subject, recipients, correlation_id, payload, received_at)
        VALUES ?
      `;

      const values = args.configs.map((c, idx) => [
        `${mqMessageId}:${idx}`,
        args.eventTypeCode,
        c.channel,
        c.template_type,
        c.subject,
        JSON.stringify(c.recipients ?? null),
        args.correlationId ?? null,
        JSON.stringify(args.payload ?? null),
        new Date(),
      ]);

      await conn.query(insertSql, [values]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
}
