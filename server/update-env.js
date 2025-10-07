const fs = require('fs');
const path = require('path');

// Read current .env
const envPath = path.join(__dirname, '.env');
let envContent = fs.readFileSync(envPath, 'utf8');

// Encode the password
const password = 'Password';
const encodedPassword = encodeURIComponent(password);
const newDatabaseUrl = `mysql://root:${encodedPassword}@0.0.0.0:3306/casino`;

// Replace the DATABASE_URL line
envContent = envContent.replace(
  /DATABASE_URL=.*/,
  `DATABASE_URL="${newDatabaseUrl}"`
);

// Write back
fs.writeFileSync(envPath, envContent);

console.log('✅ Updated .env with encoded DATABASE_URL');
console.log('Encoded password:', encodedPassword);
console.log('New DATABASE_URL:', newDatabaseUrl);
