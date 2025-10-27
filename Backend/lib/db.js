import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

let pool;

function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : undefined,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname ? u.pathname.replace(/^\//, '') : undefined,
      params: Object.fromEntries(u.searchParams),
    };
  } catch (e) {
    return null;
  }
}

export function getPool() {
  if (pool) return pool;

  const dbUrl = process.env.DATABASE_URL;
  const parsed = dbUrl ? parseDatabaseUrl(dbUrl) : null;

  const config = {
    host: parsed?.host || process.env.DB_HOST,
    port: parsed?.port || (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306),
    user: parsed?.user || process.env.DB_USER,
    password: parsed?.password || process.env.DB_PASSWORD,
    database: parsed?.database || process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: process.env.DB_CONN_LIMIT ? Number(process.env.DB_CONN_LIMIT) : 10,
    queueLimit: 0,
    dateStrings: true,
  };

  // TLS/SSL support
  if (process.env.DB_SSL === 'true' || parsed?.params?.sslmode) {
    config.ssl = {
      ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined,
      rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  pool = mysql.createPool(config);

  // Test initial connection asynchronously
  pool.getConnection()
    .then((conn) => {
      conn.release();
      console.log('Database connection pool created and tested.');
    })
    .catch((err) => {
      console.error('Initial DB connection test failed:', err.message || err);
    });

  return pool;
}
