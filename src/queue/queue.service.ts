import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { ConsumeHandler } from './queue.types';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);

  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;

  private exchange!: string;
  private queue!: string;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('MQ_URL');
    if (!url) throw new Error('MQ_URL is missing');

    this.exchange = this.config.get<string>('MQ_EXCHANGE', 'bms.noti');

    const exchangeType = this.config.get<string>('MQ_EXCHANGE_TYPE', 'topic') as
      | 'topic'
      | 'direct'
      | 'fanout'
      | 'headers';

    const queue = this.config.get<string>('MQ_QUEUE');
    if (!queue) throw new Error('MQ_QUEUE is missing');
    this.queue = queue;

    this.logger.log('Connecting MQ...');
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.exchange, exchangeType, { durable: true });
    await this.channel.assertQueue(this.queue, { durable: true });

    // ฟังทุก routing key
    await this.channel.bindQueue(this.queue, this.exchange, '#');

    this.logger.log(`MQ connected Bind: ${this.queue} <- ${this.exchange} (#)`);
  }

  async consume(handler: ConsumeHandler) {
    if (!this.channel) throw new Error('MQ channel not initialized');

    this.logger.log(`Consuming queue "${this.queue}"...`);

    await this.channel.consume(
      this.queue,
      async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return;

        const raw = msg.content.toString('utf8');

        let body: any | null = null;
        try {
          body = JSON.parse(raw);
        } catch {
          body = null;
        }

        const ack = () => this.channel!.ack(msg);
        const nack = (requeue = true) => this.channel!.nack(msg, false, requeue);

        await handler({ raw, body, ack, nack });
      },
      { noAck: false },
    );
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('MQ connection closed.');
    } catch {}
  }
}
