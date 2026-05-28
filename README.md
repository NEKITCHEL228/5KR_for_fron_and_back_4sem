# Task Manager Pro

## Описание
Менеджер задач (Real-time collaboration) - это доска задач (Kanban) с совместным редактированием в реальном времени. Включает в себя авторизацию по ролям (owner, editor, viewer), Socket.IO для мгновенного обновления доски у всех участников, а также паттерн Command для истории изменений (undo/redo).

## Стек технологий
- **Frontend:** React (Vite)
- **Backend:** Node.js, Express, Socket.IO
- **База данных:** PostgreSQL
- **Авторизация:** JWT + RBAC (Role-Based Access Control)
- **Контейнеризация:** Docker, Docker Compose
- **Тестирование:** Jest, Supertest

## Запуск проекта
### Требования
- Docker и Docker Compose

### Шаги
1. Клонировать репозиторий: `git clone <url>`
2. Скопировать файл переменных окружения: `cp .env.example .env`
3. Запустить все сервисы: `docker compose up --build`
4. Открыть в браузере: http://localhost:3000

## Переменные окружения
Описание переменных (.env.example):
- `PORT` - порт для запуска сервера (по умолчанию 3000 в контейнере)
- `JWT_SECRET` - секретный ключ для создания JWT токенов
- `PGUSER` - пользователь PostgreSQL
- `PGPASSWORD` - пароль PostgreSQL
- `PGDATABASE` - база данных
- `PGHOST` - хост базы данных (`db` в docker)
- `PGPORT` - порт базы данных
- `ADMIN_USERNAME` - логин администратора (по умолчанию `admin`)
- `ADMIN_PASSWORD` - пароль администратора

## Запуск тестов
`npm test` или `npm run test:coverage`
