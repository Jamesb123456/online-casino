# Security Policy

## 🔒 Security Best Practices

### Environment Variables

**NEVER** commit the following to version control:
- `.env` files
- Database credentials
- API keys
- JWT secrets
- Private keys

### Secure Configuration

1. **JWT Secret**
   - Generate a strong, random secret:
     ```bash
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
     ```
   - Store in environment variables, not in code

2. **Database Credentials**
   - Use strong passwords (min 16 characters)
   - If password contains special characters, URL-encode them:
     - Use `server/encode-db-password.js` helper script
   - Restrict database access by IP
   - Use separate credentials for dev/staging/production

3. **Admin Credentials**
   - Change default admin password immediately
   - Use strong, unique passwords
   - Consider implementing 2FA for production

### Production Deployment

#### Required Security Measures

- [ ] Use HTTPS (TLS/SSL certificates)
- [ ] Enable CORS with specific origins (not `*`)
- [ ] Implement rate limiting on all endpoints
- [ ] Set up proper firewall rules
- [ ] Use a reverse proxy (nginx/Apache)
- [ ] Enable security headers (helmet.js is already configured)
- [ ] Regular security updates for dependencies
- [ ] Database connection over SSL/TLS
- [ ] Implement proper session management
- [ ] Set up monitoring and alerting

#### Environment Variables for Production

```env
# Use strong, unique values
JWT_SECRET=<64-char-random-hex>
DATABASE_URL=mysql://user:pass@host:3306/db

# Production URLs
CLIENT_URL=https://yourdomain.com

# Security
NODE_ENV=production
```

### Reporting Security Issues

If you discover a security vulnerability, please email:
- **Do NOT** open a public issue
- Include detailed steps to reproduce
- We'll respond within 48 hours

## 🚨 Known Security Considerations

### Current Implementation

This is an **educational project**. Before deploying to production:

1. **Authentication**
   - Implement password complexity requirements
   - Add rate limiting to login endpoints (configured but verify)
   - Consider 2FA for admin accounts
   - Implement account lockout after failed attempts

2. **Database**
   - Currently uses plain password auth
   - Production should use SSL/TLS connections
   - Implement proper connection pooling limits

3. **Session Management**
   - JWT tokens don't expire by default (add expiration)
   - Implement refresh token mechanism
   - Add token revocation capability

4. **Game Logic**
   - Provably fair algorithms should be cryptographically verified
   - Implement proper house edge calculations
   - Add transaction logging and auditing

### Compliance

⚠️ **Important:** Online gambling is heavily regulated. Ensure compliance with:
- Local and international gambling laws
- Data protection regulations (GDPR, etc.)
- Financial transaction regulations
- Age verification requirements
- Responsible gambling measures

## 📋 Security Checklist

Before going public:

- [x] `.gitignore` includes `.env` files
- [x] No credentials in code or git history
- [x] Secure database connection parsing
- [x] Password encoding for special characters
- [ ] Change all default credentials
- [ ] Generate new JWT secret
- [ ] Configure production environment
- [ ] Set up HTTPS
- [ ] Configure proper CORS
- [ ] Enable all security headers
- [ ] Implement rate limiting
- [ ] Set up monitoring
- [ ] Regular security audits

## 📞 Contact

For security concerns: [your-security-email@domain.com]
