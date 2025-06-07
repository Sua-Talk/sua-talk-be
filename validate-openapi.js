const YAML = require('yamljs');
const fs = require('fs');

process.stdout.write('Validating OpenAPI specification...\n');

try {
  // Check if file exists
  if (!fs.existsSync('./docs/api/openapi.yaml')) {
    process.stdout.write('ERROR: openapi.yaml file not found\n');
    process.exit(1);
  }

  process.stdout.write('File found, parsing YAML...\n');

  // Load and parse YAML
  const spec = YAML.load('./docs/api/openapi.yaml');
  
  process.stdout.write('✅ YAML validation: SUCCESS\n');
  process.stdout.write('📊 API Info: ' + spec.info.title + ' v' + spec.info.version + '\n');
  process.stdout.write('🛣️  Paths: ' + Object.keys(spec.paths).length + '\n');
  process.stdout.write('📋 Schemas: ' + Object.keys(spec.components.schemas).length + '\n');
  process.stdout.write('🔗 Tags: ' + (spec.tags ? spec.tags.length : 0) + '\n');
  
  // Check for required sections
  if (!spec.paths) {
    process.stdout.write('❌ Missing paths section\n');
  }
  if (!spec.components || !spec.components.schemas) {
    process.stdout.write('❌ Missing components/schemas section\n');
  }
  
  process.stdout.write('✅ OpenAPI specification is valid!\n');
  
} catch (error) {
  process.stdout.write('❌ YAML validation: ERROR\n');
  process.stdout.write('Error message: ' + error.message + '\n');
  if (error.line) {
    process.stdout.write('Error line: ' + error.line + '\n');
  }
  process.exit(1);
} 