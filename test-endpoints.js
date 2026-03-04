// Simple test script to verify API endpoints
const http = require('http');

const endpoints = [
    '/',
    '/api/enrollments',
    '/api/analytics',
    '/api/analytics/daily',
    '/student',
    '/teacher'
];

console.log('Testing API endpoints...\n');

endpoints.forEach(endpoint => {
    const req = http.get(`http://localhost:3000${endpoint}`, (res) => {
        console.log(`✓ ${endpoint} - Status: ${res.statusCode}`);
    });
    
    req.on('error', (err) => {
        console.log(`✗ ${endpoint} - Error: ${err.message}`);
    });
});

console.log('\n✓ Server test completed');
