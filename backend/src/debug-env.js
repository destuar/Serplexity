// Temporary debug script to check environment configuration
const env = require('./dist/src/config/env').default;

console.log('=== SMTP Configuration Debug ===');
console.log('SECRETS_PROVIDER:', env.SECRETS_PROVIDER);
console.log('COMPUTED_SECRETS_PROVIDER:', env.COMPUTED_SECRETS_PROVIDER);
console.log('SMTP_SECRET_NAME:', env.SMTP_SECRET_NAME);
console.log('DATABASE_SECRET_NAME:', env.DATABASE_SECRET_NAME);
console.log('USE_AWS_SECRETS:', env.USE_AWS_SECRETS);
console.log('AWS_REGION:', env.AWS_REGION);
console.log('================================');