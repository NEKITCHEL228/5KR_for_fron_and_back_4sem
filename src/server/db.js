import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

export const pool = new Pool({ connectionString });

export const query = async (text, params) => {
  return await pool.query(text, params);
};

export const initDb = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL,
        pos INTEGER NOT NULL
      );
    `);
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
    
    const adminExists = await query('SELECT id FROM users WHERE username = $1', [adminUsername]);
    if (adminExists.rowCount === 0) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await query(`INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'owner')`, [adminUsername, hash]);
    }

    console.log('PostgreSQL Database initialized');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL Database:', err);
  }
};

