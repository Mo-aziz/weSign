const PORT = process.env.PORT || 3000;
const serverUrl =
  process.env.SWAGGER_SERVER_URL || `http://localhost:${PORT}`;

const bearerAuth = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Access token from login/register',
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    fields: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    phoneNumber: { type: 'string' },
    email: { type: 'string' },
    dob: { type: 'string', format: 'date-time' },
    isDeafMute: { type: 'boolean' },
  },
};

const authResponseSchema = {
  type: 'object',
  properties: {
    user: userSchema,
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
  },
};

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'WeSign API',
    version: '1.0.0',
    description:
      'REST API for WeSign — users, calls, and conversations. Use **Authorize** with a Bearer access token for protected routes.',
  },
  servers: [{ url: serverUrl }],
  tags: [
    { name: 'Health', description: 'Service health' },
    { name: 'Users', description: 'Registration, login, profiles' },
    { name: 'Calls', description: 'Call sessions' },
    { name: 'Conversations', description: 'Conversation messages' },
  ],
  components: {
    securitySchemes: bearerAuth,
    schemas: {
      Error: errorSchema,
      User: userSchema,
      AuthResponse: authResponseSchema,
      RegisterRequest: {
        type: 'object',
        required: [
          'firstName',
          'lastName',
          'phoneNumber',
          'email',
          'dob',
          'password',
          'isDeafMute',
        ],
        properties: {
          firstName: { type: 'string', minLength: 3 },
          lastName: { type: 'string', minLength: 3 },
          phoneNumber: { type: 'string', example: '01234567890' },
          email: { type: 'string', format: 'email' },
          dob: { type: 'string', format: 'date' },
          password: { type: 'string', minLength: 8 },
          isDeafMute: { type: 'boolean' },
          username: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['phoneNumber', 'password'],
        properties: {
          phoneNumber: { type: 'string', example: '01234567890' },
          password: { type: 'string' },
        },
      },
      LoginUsernameRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'johndoe' },
          password: { type: 'string' },
          isDeaf: { type: 'boolean' },
        },
      },
      RefreshRequest: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      RefreshResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
        },
      },
      DeviceTokenRequest: {
        type: 'object',
        required: ['deviceToken'],
        properties: {
          deviceToken: { type: 'string' },
        },
      },
      CreateCallRequest: {
        type: 'object',
        required: ['deafUserId'],
        properties: {
          deafUserId: { type: 'string' },
        },
      },
      Call: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          callerId: { type: 'string' },
          deafUserId: { type: 'string' },
          status: { type: 'string', enum: ['ringing', 'active', 'ended'] },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: 'string', format: 'date-time', nullable: true },
          transcript: { type: 'array', items: { type: 'object' } },
        },
      },
      TranscriptEntry: {
        type: 'object',
        required: ['from', 'text'],
        properties: {
          from: { type: 'string', enum: ['deafUser', 'caller', 'system'] },
          text: { type: 'string' },
        },
      },
      CreateConversationRequest: {
        type: 'object',
        properties: {
          locationType: { type: 'string' },
        },
      },
      MessageRequest: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string' },
          from: { type: 'string', default: 'user' },
          language: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/users/register': {
      post: {
        tags: ['Users'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: { description: 'Validation error' },
          409: { description: 'Phone or email already registered' },
        },
      },
    },
    '/api/users/login': {
      post: {
        tags: ['Users'],
        summary: 'Login with phone number',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/users/login-username': {
      post: {
        tags: ['Users'],
        summary: 'Login or auto-register with username',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginUsernameRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          201: {
            description: 'New user created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/users/refresh': {
      post: {
        tags: ['Users'],
        summary: 'Refresh access token',
        description:
          'Send refresh token in body or `Authorization: Bearer <refreshToken>`',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'New access token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshResponse' },
              },
            },
          },
        },
      },
    },
    '/api/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/users/me/device-token': {
      post: {
        tags: ['Users'],
        summary: 'Register push device token',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeviceTokenRequest' },
            },
          },
        },
        responses: {
          204: { description: 'No content' },
          400: { description: 'Bad request' },
        },
      },
    },
    '/api/users/search': {
      get: {
        tags: ['Users'],
        summary: 'Search users by username',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'User list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    },
    '/api/users/check/username/{username}': {
      get: {
        tags: ['Users'],
        summary: 'Check if username exists',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Exists' },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/users/username/{username}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by username',
        parameters: [
          {
            name: 'username',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/users/{userId}/status': {
      get: {
        tags: ['Users'],
        summary: 'Get user online status',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'offline' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          404: { description: 'Not found' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/api/users/forgot-password': {
      post: {
        tags: ['Users'],
        summary: 'Request password reset token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phoneNumber'],
                properties: {
                  phoneNumber: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Reset token issued' } },
      },
    },
    '/api/users/reset-password': {
      post: {
        tags: ['Users'],
        summary: 'Reset password with token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phoneNumber', 'resetToken', 'newPassword'],
                properties: {
                  phoneNumber: { type: 'string' },
                  resetToken: { type: 'string' },
                  newPassword: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Password reset' } },
      },
    },
    '/api/calls': {
      post: {
        tags: ['Calls'],
        summary: 'Create a call',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCallRequest' },
            },
          },
        },
        responses: {
          201: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Call' },
              },
            },
          },
        },
      },
    },
    '/api/calls/{id}': {
      get: {
        tags: ['Calls'],
        summary: 'Get call by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Call' },
              },
            },
          },
        },
      },
    },
    '/api/calls/{id}/accept': {
      post: {
        tags: ['Calls'],
        summary: 'Accept call',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { 200: { description: 'Call active' } },
      },
    },
    '/api/calls/{id}/end': {
      post: {
        tags: ['Calls'],
        summary: 'End call',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { 200: { description: 'Call ended' } },
      },
    },
    '/api/calls/{id}/transcript': {
      post: {
        tags: ['Calls'],
        summary: 'Add transcript entry',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TranscriptEntry' },
            },
          },
        },
        responses: { 201: { description: 'Transcript updated' } },
      },
    },
    '/api/conversations': {
      post: {
        tags: ['Conversations'],
        summary: 'Create conversation',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateConversationRequest' },
            },
          },
        },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/conversations/{id}': {
      get: {
        tags: ['Conversations'],
        summary: 'Get conversation',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/conversations/{id}/messages': {
      post: {
        tags: ['Conversations'],
        summary: 'Add message',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MessageRequest' },
            },
          },
        },
        responses: { 200: { description: 'Message added' } },
      },
    },
  },
};

module.exports = swaggerDefinition;
