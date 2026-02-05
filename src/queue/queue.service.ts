import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, Connection, Channel, ConsumeMessage } from 'amqplib';
import { ConsumeHandler } from './queue.types';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection!: Connection;
  private channel!: Channel;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('MQ_URL');
    if (!url) throw new Error('MQ_URL is missing');

    const exchange = this.config.get<string>('MQ_EXCHANGE', 'bms.noti');
    const exchangeType = this.config.get<string>('MQ_EXCHANGE_TYPE', 'topic') as
      | 'topic'
      | 'direct'
      | 'fanout'
      | 'headers';

    const queue = this.config.get<string>('MQ_QUEUE');

    this.logger.log('Connecting MQ...');
    this.connection = await connect(url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(exchange, exchangeType, { durable: true });
    await this.channel.assertQueue(queue, { durable: true });

    await this.channel.bindQueue(queue, exchange, '#');

    this.logger.log(`MQ connected Bind: ${queue} <- ${exchange} (#)`);
  }

  async consume(handler: ConsumeHandler) {
    const queue = this.config.get<string>('MQ_QUEUE', 'notification.queue');
    this.logger.log(`Consuming queue "${queue}"...`);

    await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const raw = msg.content.toString('utf8');

      let body: any | null = null;
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }

      const ack = () => this.channel.ack(msg);
      const nack = (requeue = true) => this.channel.nack(msg, false, requeue);

      await handler({ raw, body, ack, nack });    
    });
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {}
  }
}
