const ErrorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Validation failed' },
        details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    data: { type: 'object', nullable: true },
  },
};

const Account = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '651f0c2e8a1b2c3d4e5f6789' },
    name: { type: 'string', example: 'Alice' },
    balance: { type: 'integer', example: 500 },
    created_at: { type: 'string', format: 'date-time' },
  },
};

const Transaction = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '651f0c2e8a1b2c3d4e5f6790' },
    account_id: { type: 'string', example: '651f0c2e8a1b2c3d4e5f6789' },
    type: { type: 'string', enum: ['credit', 'debit'] },
    amount: { type: 'integer', example: 500 },
    description: { type: 'string', example: '' },
    reference_id: { type: 'string', example: 'ref-001' },
    transfer_id: { type: 'string', nullable: true, example: null },
    created_at: { type: 'string', format: 'date-time' },
  },
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Transaction Ledger API',
    version: '1.0.0',
    description: 'Accounts, transactions and transfers with strict validation and atomic balance updates.',
  },
  servers: [{ url: 'http://localhost:5000' }],
  tags: [
    { name: 'Health' },
    { name: 'Accounts' },
    { name: 'Transactions' },
    { name: 'Transfers' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service is up',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } },
              },
            },
          },
        },
      },
    },
    '/api/accounts': {
      post: {
        tags: ['Accounts'],
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                additionalProperties: false,
                properties: { name: { type: 'string', minLength: 1, maxLength: 100, example: 'Alice' } },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean', example: true }, data: Account },
                },
                example: { success: true, data: { id: '651f0c2e8a1b2c3d4e5f6789', name: 'Alice', balance: 0, created_at: '2026-01-01T00:00:00.000Z' } },
              },
            },
          },
          400: {
            description: 'VALIDATION_ERROR',
            content: { 'application/json': { schema: ErrorResponse } },
          },
        },
      },
      get: {
        tags: ['Accounts'],
        summary: 'List accounts (paginated)',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated account list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        items: { type: 'array', items: Account },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer', example: 1 },
                            limit: { type: 'integer', example: 10 },
                            total_records: { type: 'integer', example: 23 },
                            total_pages: { type: 'integer', example: 3 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'VALIDATION_ERROR', content: { 'application/json': { schema: ErrorResponse } } },
        },
      },
    },
    '/api/accounts/{id}/balance': {
      get: {
        tags: ['Accounts'],
        summary: 'Get account balance',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Balance',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        account_id: { type: 'string' },
                        name: { type: 'string' },
                        balance: { type: 'integer' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
                example: { success: true, data: { account_id: '651f0c2e8a1b2c3d4e5f6789', name: 'Alice', balance: 500, created_at: '2026-01-01T00:00:00.000Z' } },
              },
            },
          },
          400: { description: 'VALIDATION_ERROR', content: { 'application/json': { schema: ErrorResponse } } },
          404: { description: 'ACCOUNT_NOT_FOUND', content: { 'application/json': { schema: ErrorResponse } } },
        },
      },
    },
    '/api/accounts/{id}/transactions': {
      post: {
        tags: ['Transactions'],
        summary: 'Create a transaction (credit or debit) on an account',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'amount', 'reference_id'],
                additionalProperties: false,
                properties: {
                  type: { type: 'string', enum: ['credit', 'debit'] },
                  amount: { type: 'integer', minimum: 1, example: 500 },
                  reference_id: { type: 'string', minLength: 1, maxLength: 100, example: 'ref-001' },
                  description: { type: 'string', maxLength: 255, example: '' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Transaction created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: { transaction: Transaction, balance: { type: 'integer', example: 500 } },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'VALIDATION_ERROR', content: { 'application/json': { schema: ErrorResponse } } },
          404: { description: 'ACCOUNT_NOT_FOUND', content: { 'application/json': { schema: ErrorResponse } } },
          409: { description: 'DUPLICATE_TRANSACTION (includes existing transaction in data)', content: { 'application/json': { schema: ErrorResponse } } },
          422: { description: 'INSUFFICIENT_BALANCE', content: { 'application/json': { schema: ErrorResponse } } },
        },
      },
      get: {
        tags: ['Transactions'],
        summary: 'List transactions for an account',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['credit', 'debit'] } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated transaction list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        transactions: { type: 'array', items: Transaction },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: { type: 'integer', example: 1 },
                            limit: { type: 'integer', example: 10 },
                            total_records: { type: 'integer', example: 23 },
                            total_pages: { type: 'integer', example: 3 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'VALIDATION_ERROR', content: { 'application/json': { schema: ErrorResponse } } },
          404: { description: 'ACCOUNT_NOT_FOUND', content: { 'application/json': { schema: ErrorResponse } } },
        },
      },
    },
    '/api/transfers': {
      post: {
        tags: ['Transfers'],
        summary: 'Transfer funds between two accounts',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from_account_id', 'to_account_id', 'amount', 'reference_id'],
                additionalProperties: false,
                properties: {
                  from_account_id: { type: 'string' },
                  to_account_id: { type: 'string' },
                  amount: { type: 'integer', minimum: 1, example: 500 },
                  reference_id: { type: 'string', minLength: 1, maxLength: 100, example: 'tr-001' },
                  description: { type: 'string', maxLength: 255, example: '' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Transfer completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        transfer_id: { type: 'string', example: 'c3f1...' },
                        amount: { type: 'integer', example: 500 },
                        from: { type: 'object', properties: { account_id: { type: 'string' }, balance: { type: 'integer' } } },
                        to: { type: 'object', properties: { account_id: { type: 'string' }, balance: { type: 'integer' } } },
                        transactions: { type: 'array', items: Transaction },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'VALIDATION_ERROR (incl. same-account transfer)', content: { 'application/json': { schema: ErrorResponse } } },
          404: { description: 'ACCOUNT_NOT_FOUND', content: { 'application/json': { schema: ErrorResponse } } },
          409: { description: 'DUPLICATE_TRANSACTION (includes existing transaction in data)', content: { 'application/json': { schema: ErrorResponse } } },
          422: { description: 'INSUFFICIENT_BALANCE', content: { 'application/json': { schema: ErrorResponse } } },
        },
      },
    },
  },
  components: {
    schemas: { Account, Transaction, ErrorResponse },
  },
};
