const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('../swagger/spec');

function isSwaggerEnabled() {
  if (process.env.ENABLE_SWAGGER === 'false') {
    return false;
  }
  if (process.env.ENABLE_SWAGGER === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

function setupSwagger(app) {
  if (!isSwaggerEnabled()) {
    return;
  }

  const swaggerOptions = {
    customSiteTitle: 'WeSign API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
    },
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition, swaggerOptions));

  app.get('/api-docs.json', (req, res) => {
    res.json(swaggerDefinition);
  });

  console.log(`Swagger UI: ${process.env.SWAGGER_SERVER_URL || `http://localhost:${process.env.PORT || 3000}`}/api-docs`);
}

module.exports = {
  isSwaggerEnabled,
  setupSwagger,
};
