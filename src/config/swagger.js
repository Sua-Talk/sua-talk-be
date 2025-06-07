const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Load the OpenAPI specification from YAML file
const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/api/openapi-bundled.yaml'));

// Swagger JSDoc configuration for inline documentation
const swaggerOptions = {
  definition: swaggerDocument,
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js'),
    path.join(__dirname, '../models/*.js')
  ]
};

// Generate the swagger specification
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Swagger UI options
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add request interceptor for debugging
      console.log('Swagger Request:', req.url);
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .scheme-container { margin: 20px 0 }
    .swagger-ui .info .title { 
      color: #3b82f6; 
      font-size: 36px; 
      font-weight: bold; 
    }
    .swagger-ui .info .description p {
      font-size: 14px;
      line-height: 1.6;
    }
    .swagger-ui .btn.authorize {
      background-color: #10b981;
      border-color: #10b981;
    }
    .swagger-ui .btn.authorize:hover {
      background-color: #059669;
      border-color: #059669;
    }
  `,
  customSiteTitle: "SuaTalk API Documentation",
  customfavIcon: "/favicon.ico"
};

// Function to setup Swagger middleware
const setupSwagger = (app) => {
  // Serve the OpenAPI specification as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve the OpenAPI specification as YAML
  app.get('/api-docs.yaml', (req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.send(YAML.stringify(swaggerSpec, 4));
  });

  // Serve Swagger UI
  app.use('/api-docs', swaggerUi.serve);
  app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Alternative documentation routes
  app.use('/docs', swaggerUi.serve);
  app.get('/docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Redirect from /documentation to /api-docs
  app.get('/documentation', (req, res) => {
    res.redirect('/api-docs');
  });

  console.log('📚 API Documentation available at:');
  console.log('   - Swagger UI: /api-docs or /docs');
  console.log('   - OpenAPI JSON: /api-docs.json');
  console.log('   - OpenAPI YAML: /api-docs.yaml');
};

// Function to validate the OpenAPI specification
const validateSwaggerSpec = () => {
  try {
    if (!swaggerSpec.info) {
      throw new Error('Missing required "info" section in OpenAPI specification');
    }
    if (!swaggerSpec.paths) {
      throw new Error('Missing required "paths" section in OpenAPI specification');
    }
    console.log('✅ OpenAPI specification is valid');
    return true;
  } catch (error) {
    console.error('❌ OpenAPI specification validation failed:', error.message);
    return false;
  }
};

// Function to get API summary
const getApiSummary = () => {
  const pathCount = Object.keys(swaggerSpec.paths || {}).length;
  const tagCount = (swaggerSpec.tags || []).length;
  const schemaCount = Object.keys(swaggerSpec.components?.schemas || {}).length;
  
  return {
    title: swaggerSpec.info?.title || 'Unknown API',
    version: swaggerSpec.info?.version || 'Unknown',
    description: swaggerSpec.info?.description || 'No description',
    pathCount,
    tagCount,
    schemaCount,
    servers: swaggerSpec.servers || []
  };
};

module.exports = {
  setupSwagger,
  validateSwaggerSpec,
  getApiSummary,
  swaggerSpec,
  swaggerDocument
}; 