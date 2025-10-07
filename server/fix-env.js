// Quick script to properly encode the DATABASE_URL
const password = '[32g95P<OTN+Df6p';
const encodedPassword = encodeURIComponent(password);

const databaseUrl = `mysql://root:${encodedPassword}@154.61.60.132:3306/casino`;

console.log('Add this line to your .env file:');
console.log(`DATABASE_URL="${databaseUrl}"`);
console.log('\nEncoded password:', encodedPassword);
