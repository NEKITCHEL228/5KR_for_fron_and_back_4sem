import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, initDb } from './src/server/db.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretdevelopmentkey';

export async function bootstrapServer() {
  await initDb();
  const app = express();
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  app.use(cors());
  app.use(express.json());

  let taskHistory = [];
  let redoHistory = [];

  const checkAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
      });
    } else {
      res.sendStatus(401);
    }
  };

  const checkOwner = (req, res, next) => {
    if (req.user.role === 'owner') next();
    else res.status(403).json({error: 'Forbidden'});
  };

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    
    try {
      const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rowCount > 0) {
        return res.status(400).json({ error: 'Пользователь уже существует' });
      }
      const hash = await bcrypt.hash(password, 10);
      await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, hash, 'viewer']);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
      const userRes = await query('SELECT * FROM users WHERE username = $1', [username]);
      if (userRes.rowCount === 0) return res.status(401).json({ error: 'Неверные данные' });
      
      const user = userRes.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) return res.status(401).json({ error: 'Неверные данные' });

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/users', checkAuth, checkOwner, async (req, res) => {
    try {
      const users = await query('SELECT id, username, role FROM users');
      res.json(users.rows);
    } catch (e) {
      res.status(500).json({error: 'Server error'});
    }
  });

  app.post('/api/users/:id/role', checkAuth, checkOwner, async (req, res) => {
    const { role } = req.body;
    if (!['owner', 'editor', 'viewer'].includes(role)) return res.status(400).json({error: 'Invalid role'});
    try {
      await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({error: 'Server error'});
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  const broadcastState = async () => {
    const res = await query('SELECT * FROM tasks ORDER BY pos ASC');
    io.emit('initial_state', res.rows);
  };

  io.on('connection', async (socket) => {
    console.log('User connected:', socket.user.username);
    
    const res = await query('SELECT * FROM tasks ORDER BY pos ASC');
    socket.emit('initial_state', res.rows);

    socket.on('move_task', async (data) => {
      const { taskId, newStatus, newPos } = data;
      if (socket.user.role === 'viewer') return socket.emit('error', 'Визуализаторы не могут менять задачи');
      
      const tRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (tRes.rowCount > 0) {
        const task = tRes.rows[0];
        
        await query('UPDATE tasks SET status = $1, pos = $2 WHERE id = $3', [newStatus, newPos, taskId]);
        
        taskHistory.push({ type: 'MOVE_TASK', taskId, previousState: task, newState: { ...task, status: newStatus, pos: newPos } });
        redoHistory = [];
        
        const upRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        io.emit('task_moved', upRes.rows[0]);
      }
    });

    socket.on('add_task', async (data) => {
      if (socket.user.role === 'viewer') return socket.emit('error', 'Визуализаторы не могут добавлять задачи');
      
      const id = Date.now().toString();
      const title = data.title || 'Новая задача';
      const desc = data.description || '';
      const status = data.status || 'Новые';
      const cRes = await query('SELECT count(*) FROM tasks WHERE status = $1', [status]);
      const pos = parseInt(cRes.rows[0].count);

      await query('INSERT INTO tasks (id, title, description, status, pos) VALUES ($1, $2, $3, $4, $5)', [id, title, desc, status, pos]);
      
      const upRes = await query('SELECT * FROM tasks WHERE id = $1', [id]);
      const task = upRes.rows[0];
      
      taskHistory.push({ type: 'ADD_TASK', taskId: id, previousState: null, newState: task });
      redoHistory = [];
      broadcastState();
    });

    socket.on('update_task', async (data) => {
      if (socket.user.role === 'viewer') return socket.emit('error', 'Визуализаторы не могут менять задачи');
      
      const tRes = await query('SELECT * FROM tasks WHERE id = $1', [data.taskId]);
      if (tRes.rowCount > 0) {
        const task = tRes.rows[0];
        const newTitle = data.title !== undefined ? data.title : task.title;
        const newDesc = data.description !== undefined ? data.description : task.description;
        
        await query('UPDATE tasks SET title = $1, description = $2 WHERE id = $3', [newTitle, newDesc, data.taskId]);
        
        const upRes = await query('SELECT * FROM tasks WHERE id = $1', [data.taskId]);
        const updated = upRes.rows[0];
        taskHistory.push({ type: 'UPDATE_TASK', taskId: data.taskId, previousState: task, newState: updated });
        redoHistory = [];
        broadcastState();
      }
    });

    socket.on('delete_task', async (data) => {
      if (socket.user.role === 'viewer') return socket.emit('error', 'Визуализаторы не могут удалять задачи');
      
      const tRes = await query('SELECT * FROM tasks WHERE id = $1', [data.taskId]);
      if (tRes.rowCount > 0) {
        const task = tRes.rows[0];
        await query('DELETE FROM tasks WHERE id = $1', [data.taskId]);
        
        taskHistory.push({ type: 'DELETE_TASK', taskId: data.taskId, previousState: task, newState: null });
        redoHistory = [];
        broadcastState();
      }
    });

    socket.on('undo', async () => {
      if (socket.user.role === 'viewer') return;
      const lastAction = taskHistory.pop();
      if (lastAction) {
        if (lastAction.type === 'ADD_TASK') {
          await query('DELETE FROM tasks WHERE id = $1', [lastAction.taskId]);
        } else if (lastAction.type === 'DELETE_TASK') {
          const t = lastAction.previousState;
          await query('INSERT INTO tasks (id, title, description, status, pos) VALUES ($1, $2, $3, $4, $5)', [t.id, t.title, t.description, t.status, t.pos]);
        } else {
          const t = lastAction.previousState;
          await query('UPDATE tasks SET title = $1, description = $2, status = $3, pos = $4 WHERE id = $5', [t.title, t.description, t.status, t.pos, t.id]);
        }
        redoHistory.push(lastAction);
        broadcastState();
      }
    });
    
    socket.on('redo', async () => {
      if (socket.user.role === 'viewer') return;
      const lastRedo = redoHistory.pop();
      if (lastRedo) {
         if (lastRedo.type === 'ADD_TASK') {
           const t = lastRedo.newState;
           await query('INSERT INTO tasks (id, title, description, status, pos) VALUES ($1, $2, $3, $4, $5)', [t.id, t.title, t.description, t.status, t.pos]);
         } else if (lastRedo.type === 'DELETE_TASK') {
           await query('DELETE FROM tasks WHERE id = $1', [lastRedo.taskId]);
         } else {
           const t = lastRedo.newState;
           await query('UPDATE tasks SET title = $1, description = $2, status = $3, pos = $4 WHERE id = $5', [t.title, t.description, t.status, t.pos, t.id]);
         }
         taskHistory.push(lastRedo);
         broadcastState();
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return httpServer;
}

export const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

if (!isTest && !process.env.VITE_TEST) {
  bootstrapServer().then((server) => {
    const p = process.env.PORT || 3000;
    server.listen(p, () => {
      console.log(`Server running on port ${p}`);
    });
  });
}
