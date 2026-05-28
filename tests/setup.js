// setup.js
jest.mock('vite', () => ({
  createServer: jest.fn().mockResolvedValue({
    middlewares: (req, res, next) => next()
  })
}));
