import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export type ConsumeContext = {
  raw: string;
  body: any; 
  properties: amqp.MessageProperties;
  fields: amqp.MessageFields;
  ack: () => void;
  nack: (requeue?: boolean) => void;
};

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  private connection?: amqp.Connection;
  private channel?: amqp.Channel;

  private exchange!: string;
  private queue!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('MQ_URL');
    if (!url) throw new Error('MQ_URL is missing');

    this.exchange = this.config.get<string>('MQ_EXCHANGE', 'bms.noti');

    const type = this.config.get<string>('MQ_EXCHANGE_TYPE', 'topic') as
      | 'topic'
      | 'direct'
      | 'fanout'
      | 'headers';

    this.queue = this.config.get<string>('MQ_QUEUE')!;
    if (!this.queue) throw new Error('MQ_QUEUE is missing');

    const keysRaw = this.config.get<string>('MQ_ROUTING_KEYS', '#');
    const routingKeys = keysRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.logger.log(`Connecting MQ...`);
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.exchange, type, { durable: true });
    await this.channel.assertQueue(this.queue, { durable: true });

    for (const key of routingKeys) {
      await this.channel.bindQueue(this.queue, this.exchange, key);
      this.logger.log(`Bind: ${this.queue} <- ${this.exchange} (${key})`);
    }

  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('MQ connection closed.');
    } catch (e) {
      this.logger.warn(`Error closing MQ: ${(e as Error).message}`);
    }
  }

  async consume(handler: (ctx: ConsumeContext) => Promise<void> | void) {
    if (!this.channel) throw new Error('MQ channel not initialized');

    this.logger.log(`Consuming queue "${this.queue}"...`);

    await this.channel.consume(
      this.queue,
      async (msg) => {
        if (!msg) return;

        const raw = msg.content.toString('utf8');

        const ack = () => this.channel!.ack(msg);
        const nack = (requeue = false) => this.channel!.nack(msg, false, requeue);

        let body: any = null;
        try {
          body = JSON.parse(raw);
        } catch {
          body = null;
        }

        await handler({
          raw,
          body,
          properties: msg.properties,
          fields: msg.fields,
          ack,
          nack,
        });
      },
      { noAck: false },
    );
  }
}
