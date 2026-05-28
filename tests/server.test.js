import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import { bootstrapServer } from '../server.js';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hash'),
  compare: jest.fn().mockResolvedValue(true)
}));

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn((q, params) => {
      if (typeof q === 'string') {
        if (q.includes('SELECT * FROM users WHERE username')) {
          return Promise.resolve({ rowCount: 1, rows: [{ id: 1, username: 'admin', password_hash: 'hash', role: 'owner' }] });
        }
        if (q.includes('count(*)')) {
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        if (q.includes('SELECT * FROM tasks WHERE id')) {
          return Promise.resolve({ rowCount: 1, rows: [{ id: params ? params[0] : '1', title: 'T', status: 'Новые', pos: 0 }] });
        }
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('Server Startup Test', () => {
  let server;
  let clientSocket;
  
  beforeAll((done) => {
    bootstrapServer().then((s) => {
      server = s;
      server.listen(0, () => {
        const port = server.address().port;
        // Need a valid token
        request(server)
          .post('/api/login')
          .send({ username: 'admin', password: 'p' })
          .then((res) => {
             clientSocket = Client(`http://localhost:${port}`, {
               auth: { token: res.body.token }
             });
             clientSocket.on('connect', done);
          });
      });
    });
  });
  
  afterAll((done) => {
    if (clientSocket) clientSocket.close();
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('Should handle task events and undo/redo', (done) => {
    // move
    clientSocket.emit('move_task', { taskId: '1', newStatus: 'Готово', newPos: 0 });
    
    // add
    clientSocket.emit('add_task', { title: 'Test', description: 'Test desc', status: 'Новые' });
    
    // update
    clientSocket.emit('update_task', { taskId: '1', title: 'Updated' });
    
    // delete
    clientSocket.emit('delete_task', { taskId: '2' });

    // wait for them all to process...
    setTimeout(() => {
       clientSocket.emit('undo');
       clientSocket.emit('redo');
       setTimeout(done, 200);
    }, 100);
  });

  it('Should return 200 on health check', async () => {
    const res = await request(server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('Should login and return token', async () => {
    const res = await request(server)
      .post('/api/login')
      .send({ username: 'admin', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    
    // Testing invalid login
    const res2 = await request(server)
      .post('/api/login')
      .send({});
    expect(res2.status).toBe(400);

    const res3 = await request(server)
      .post('/api/register')
      .send({ username: 'newuser', password: 'p' });
    expect(res3.status).toBe(200);

    const res4 = await request(server)
      .get('/api/users')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(res4.status).toBe(200);

    const res5 = await request(server)
      .post('/api/users/1/role')
      .set('Authorization', `Bearer ${res.body.token}`)
      .send({ role: 'editor' });
    expect(res5.status).toBe(200);
  });
});
