import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mysql, { Pool } from 'mysql2/promise';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private pool!: Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.pool = mysql.createPool({
      host: this.config.get<string>('DB_HOST'),
      port: Number(this.config.get<string>('DB_PORT', '3306')),
      user: this.config.get<string>('DB_USER'),
      password: this.config.get<string>('DB_PASS'),
      database: this.config.get<string>('DB_NAME'),
      waitForConnections: true,
      connectionLimit: 10,
    });

    const conn = await this.pool.getConnection();
    await conn.ping();
    conn.release();
    this.logger.log('DB connected');
  }

  async onModuleDestroy() {
    await this.pool?.end().catch(() => void 0);
  }

  getPool(): Pool {
  if (!this.pool) {
    throw new Error('DbService: pool not initialized yet');
  }
  return this.pool;
}
}
