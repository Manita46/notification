import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

type GetEventInboxParams = {
  search?: string;
  date?: string;     // YYYY-MM-DD
  channel?: string;  // Email | Line | ...
  limit?: number;
  offset?: number;
};

@Injectable()
export class NotificationRepo {
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

      for (let i = 0; i < args.configs.length; i++) {
        const c = args.configs[i];

        const msgIdForRow = args.messageId;

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
  async getEventInboxList(params: GetEventInboxParams) {
    const pool = this.db.getPool();

    const search = params.search?.trim() ?? '';
    const date = params.date?.trim() ?? '';
    const channel = params.channel?.trim() ?? '';
    const limit = Number.isFinite(params.limit) ? Number(params.limit) : 50;
    const offset = Number.isFinite(params.offset) ? Number(params.offset) : 0;

    const where: string[] = [];
    const values: Array<string | number> = [];

    if (search) {
      const like = `%${search}%`;
      where.push(
        '(message_id LIKE ? OR event_type_code LIKE ? OR channel LIKE ? OR template_type LIKE ? OR subject LIKE ? OR correlation_id LIKE ?)',
      );
      values.push(like, like, like, like, like, like);
    }

    if (channel && channel.toLowerCase() !== 'all') {
      where.push('channel = ?');
      values.push(channel);
    }

    if (date) {
      where.push('DATE(received_at) = ?');
      values.push(date);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM event_inbox ${whereClause}`,
      values,
    );
    const total = Number(countRows?.[0]?.total ?? 0);

    const [rows] = await pool.query<any[]>(
      `
      SELECT
        id,
        message_id,
        event_type_code,
        channel,
        template_type,
        subject,
        recipients,
        correlation_id,
        received_at
      FROM event_inbox
      ${whereClause}
      ORDER BY received_at ASC, id ASC
      LIMIT ? OFFSET ?;
      `,
      [...values, limit, offset],
    );

    return { total, entries: rows };
  }
}
