import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/errorHandler.js';
import { AppError } from './utils/AppError.js';
import accountRoutes from './routes/account.routes.js';
import transferRoutes from './routes/transfer.routes.js';
import { openapiSpec } from './docs/openapi.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use((req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND'));
});

app.use(errorHandler);

export default app;
