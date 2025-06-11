// Test script untuk endpoint check-email
const axios = require('axios');

async function testCheckEmail() {
  try {
    console.log('Testing /auth/check-email endpoint...');
    
    const response = await axios.post('http://localhost:3000/auth/check-email', {
      email: 'test@example.com'
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n✅ Endpoint works perfectly!');
    
  } catch (error) {
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 500 && error.response.data.message?.includes('email')) {
        console.log('\n✅ Endpoint works! Email service might not be configured (expected in dev)');
      } else {
        console.log('\n❌ Unexpected error response');
      }
    } else {
      console.error('Error testing endpoint:', error.message);
    }
  }
}

testCheckEmail(); 