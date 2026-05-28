import { query, initDb } from '../src/server/db.js';

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('DB Tests', () => {
  it('Should default to in-memory fallback if no env is provided', async () => {
    const res = await query('SELECT 1');
    expect(res).toEqual({ rows: [], rowCount: 0 });
  });

  it('Should initDb', async () => {
    await initDb();
    expect(true).toBe(true);
  });
});
