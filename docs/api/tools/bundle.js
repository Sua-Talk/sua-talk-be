#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const API_DIR = path.join(__dirname, '..');
const MODULAR_FILE = path.join(API_DIR, 'openapi-modular.yaml');
const BUNDLED_FILE = path.join(API_DIR, 'openapi-bundled.yaml');

/**
 * Resolve all $ref references in a YAML object
 */
function resolveRefs(obj, basePath, visited = new Set()) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveRefs(item, basePath, visited));
  }

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      const refPath = path.resolve(basePath, value);
      
      // Prevent circular references
      if (visited.has(refPath)) {
        console.warn(`Warning: Circular reference detected: ${refPath}`);
        continue;
      }

      try {
        visited.add(refPath);
        const refContent = fs.readFileSync(refPath, 'utf8');
        const refData = yaml.load(refContent);
        const resolvedRef = resolveRefs(refData, path.dirname(refPath), visited);
        visited.delete(refPath);
        
        // If the referenced file contains a single object, merge it
        // If it contains multiple objects, return the whole structure
        if (typeof resolvedRef === 'object' && !Array.isArray(resolvedRef)) {
          Object.assign(result, resolvedRef);
        } else {
          result[key] = resolvedRef;
        }
      } catch (error) {
        console.warn(`Warning: Could not resolve reference ${value}: ${error.message}`);
        result[key] = value; // Keep the original reference
      }
    } else {
      result[key] = resolveRefs(value, basePath, visited);
    }
  }

  return result;
}

/**
 * Bundle the modular OpenAPI specification
 */
function bundleOpenAPI() {
  try {
    console.log('🚀 Starting OpenAPI bundling process...');
    
    // Read the main modular file
    console.log('📖 Reading modular OpenAPI file...');
    const modularContent = fs.readFileSync(MODULAR_FILE, 'utf8');
    const modularData = yaml.load(modularContent);
    
    // Resolve all references
    console.log('🔄 Resolving all $ref references...');
    const bundledData = resolveRefs(modularData, path.dirname(MODULAR_FILE));
    
    // Merge paths from individual files manually (since $ref in paths doesn't work as expected)
    console.log('🔗 Merging path definitions...');
    const pathsDir = path.join(API_DIR, 'paths');
    const pathFiles = fs.readdirSync(pathsDir).filter(file => file.endsWith('.yaml'));
    
    bundledData.paths = {};
    
    for (const pathFile of pathFiles) {
      try {
        const pathContent = fs.readFileSync(path.join(pathsDir, pathFile), 'utf8');
        const pathData = yaml.load(pathContent);
        Object.assign(bundledData.paths, pathData);
        console.log(`  ✅ Merged paths from ${pathFile}`);
      } catch (error) {
        console.warn(`  ⚠️ Warning: Could not load ${pathFile}: ${error.message}`);
      }
    }
    
    // Merge schemas
    console.log('📝 Merging schema definitions...');
    const schemasDir = path.join(API_DIR, 'schemas');
    const schemaFiles = fs.readdirSync(schemasDir).filter(file => file.endsWith('.yaml'));
    
    if (!bundledData.components) {
      bundledData.components = {};
    }
    if (!bundledData.components.schemas) {
      bundledData.components.schemas = {};
    }
    
    for (const schemaFile of schemaFiles) {
      try {
        const schemaContent = fs.readFileSync(path.join(schemasDir, schemaFile), 'utf8');
        const schemaData = yaml.load(schemaContent);
        Object.assign(bundledData.components.schemas, schemaData);
        console.log(`  ✅ Merged schemas from ${schemaFile}`);
      } catch (error) {
        console.warn(`  ⚠️ Warning: Could not load ${schemaFile}: ${error.message}`);
      }
    }
    
    // Merge responses
    console.log('📋 Merging response definitions...');
    const responsesDir = path.join(API_DIR, 'responses');
    if (fs.existsSync(responsesDir)) {
      const responseFiles = fs.readdirSync(responsesDir).filter(file => file.endsWith('.yaml'));
      
      if (!bundledData.components.responses) {
        bundledData.components.responses = {};
      }
      
      for (const responseFile of responseFiles) {
        try {
          const responseContent = fs.readFileSync(path.join(responsesDir, responseFile), 'utf8');
          const responseData = yaml.load(responseContent);
          Object.assign(bundledData.components.responses, responseData);
          console.log(`  ✅ Merged responses from ${responseFile}`);
        } catch (error) {
          console.warn(`  ⚠️ Warning: Could not load ${responseFile}: ${error.message}`);
        }
      }
    }
    
    // Add bundling metadata
    bundledData.info.description += `\n\n---\n*This documentation was automatically generated from modular OpenAPI files.*\n*Last bundled: ${new Date().toISOString()}*`;
    
    // Write the bundled file
    console.log('💾 Writing bundled OpenAPI file...');
    const bundledYaml = yaml.dump(bundledData, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
    
    fs.writeFileSync(BUNDLED_FILE, bundledYaml, 'utf8');
    
    // Generate statistics
    const stats = {
      paths: Object.keys(bundledData.paths || {}).length,
      schemas: Object.keys(bundledData.components?.schemas || {}).length,
      responses: Object.keys(bundledData.components?.responses || {}).length,
      fileSize: Math.round(fs.statSync(BUNDLED_FILE).size / 1024)
    };
    
    console.log('✅ OpenAPI bundling completed successfully!');
    console.log(`📊 Statistics:`);
    console.log(`   - Paths: ${stats.paths}`);
    console.log(`   - Schemas: ${stats.schemas}`);
    console.log(`   - Responses: ${stats.responses}`);
    console.log(`   - File size: ${stats.fileSize} KB`);
    console.log(`📁 Bundled file: ${BUNDLED_FILE}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error bundling OpenAPI specification:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Validate the bundled OpenAPI specification
 */
function validateBundle() {
  try {
    const bundledContent = fs.readFileSync(BUNDLED_FILE, 'utf8');
    const bundledData = yaml.load(bundledContent);
    
    // Basic validation
    const requiredFields = ['openapi', 'info', 'paths'];
    for (const field of requiredFields) {
      if (!bundledData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    console.log('✅ Bundled OpenAPI specification is valid');
    return true;
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return false;
  }
}

// Main execution
if (require.main === module) {
  const success = bundleOpenAPI();
  if (success) {
    validateBundle();
  } else {
    process.exit(1);
  }
}

module.exports = {
  bundleOpenAPI,
  validateBundle
}; 