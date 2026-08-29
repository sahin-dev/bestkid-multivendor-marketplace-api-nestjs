import { registerAs } from '@nestjs/config';

export const dbConfig = () => ({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionString: process.env.DATABASE_URL,
});

export default registerAs('db', dbConfig);
