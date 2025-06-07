#!/usr/bin/env node

const { bundleOpenAPI, validateBundle } = require('./bundle.js');
const { exec } = require('child_process');
const path = require('path');

/**
 * Pre-commit hook to automatically bundle OpenAPI documentation
 */
function preCommitHook() {
  console.log('🔍 Pre-commit: Checking for OpenAPI changes...');
  
  // Get list of changed files in staging area
  exec('git diff --cached --name-only', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error checking git status:', error);
      process.exit(1);
    }
    
    const changedFiles = stdout.split('\n').filter(file => file.trim());
    const apiFiles = changedFiles.filter(file => 
      file.includes('docs/api/') && 
      (file.endsWith('.yaml') || file.endsWith('.yml')) &&
      !file.includes('openapi-bundled.yaml')
    );
    
    if (apiFiles.length > 0) {
      console.log('📝 Found changes in OpenAPI files:');
      apiFiles.forEach(file => console.log(`   - ${file}`));
      
      console.log('🔄 Auto-bundling documentation...');
      const success = bundleOpenAPI();
      
      if (success && validateBundle()) {
        console.log('✅ Documentation bundled successfully');
        
        // Stage the bundled file
        exec('git add docs/api/openapi-bundled.yaml', (addError) => {
          if (addError) {
            console.error('❌ Error staging bundled file:', addError);
            process.exit(1);
          }
          console.log('📦 Bundled file added to commit');
        });
      } else {
        console.error('❌ Failed to bundle documentation');
        process.exit(1);
      }
    } else {
      console.log('✅ No OpenAPI files changed, skipping bundling');
    }
  });
}

// Run if called directly
if (require.main === module) {
  preCommitHook();
}

module.exports = { preCommitHook }; 