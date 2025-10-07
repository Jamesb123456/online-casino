#!/usr/bin/env node
/**
 * Helper script to encode DATABASE_URL with special characters
 * Usage: node encode-db-password.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Database URL Password Encoder');
console.log('=============================\n');

rl.question('Enter MySQL username (default: root): ', (username) => {
  username = username || 'root';
  
  rl.question('Enter MySQL password: ', (password) => {
    rl.question('Enter MySQL host (default: localhost): ', (host) => {
      host = host || 'localhost';
      
      rl.question('Enter MySQL port (default: 3306): ', (port) => {
        port = port || '3306';
        
        rl.question('Enter database name (default: casino): ', (database) => {
          database = database || 'casino';
          
          // Encode the password to handle special characters
          const encodedPassword = encodeURIComponent(password);
          
          // Build the DATABASE_URL
          const databaseUrl = `mysql://${username}:${encodedPassword}@${host}:${port}/${database}`;
          
          console.log('\n✅ Your encoded DATABASE_URL:');
          console.log('================================');
          console.log(databaseUrl);
          console.log('\n📝 Add this to your .env file:');
          console.log(`DATABASE_URL="${databaseUrl}"`);
          
          rl.close();
        });
      });
    });
  });
});
