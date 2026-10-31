import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Passive Fire Inspection API',
      version: '0.1.0',
      description: 'API for managing passive fire inspections with AI-powered observations',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'INSPECTOR', 'VIEWER'] }
          }
        },
        Observation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            description: { type: 'string', maxLength: 1000 },
            severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            remedialAction: { type: 'string', maxLength: 1000 }
          }
        },
        Inspection: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            building: { type: 'string' },
            location: { type: 'string' },
            notes: { type: 'string', maxLength: 5000 },
            status: { type: 'string', enum: ['DRAFT', 'IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'] },
            inspectorId: { type: 'string' },
            inspectorName: { type: 'string' },
            observations: { type: 'array', items: { $ref: '#/components/schemas/Observation' } },
            photos: { type: 'array', items: { type: 'string' } },
            aiSummary: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/server.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
