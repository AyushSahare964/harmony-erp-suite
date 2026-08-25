# Authentication System with MongoDB Integration — Implementation Plan

## ⚠️ Security note (read first)
A real Atlas password was shared in this conversation. Treat it as compromised:
1. Go to **Atlas → Database Access → edit the user → Edit Password** and rotate it now.
2. Never hardcode the connection string in source files. Use environment variables + `.env` (already gitignored) as shown below.
3. Add `.env` to `.gitignore` before your first commit if you haven't already.

---

## 1. Goal
Build a production-style authentication system (signup, login, logout, session/token refresh, password reset) backed by MongoDB Atlas, with all user and app data persisted properly — correct schemas, indexes, and hashing — instead of ad-hoc scripts.

## 2. Stack Assumptions
- Node.js + Express (adjust if you're using Next.js/Fastify — the plan maps 1:1)
- MongoDB Atlas via the official `mongodb` driver, wrapped with **Mongoose** for schema validation (recommended) — or raw driver if you want full control
- JWT for stateless auth (access + refresh tokens), or `express-session` + `connect-mongo` if you prefer server-side sessions
- `bcrypt` for password hashing
- `dotenv` for config

## 3. Project Structure
```
/src
  /config
    db.js              # MongoDB connection (singleton)
  /models
    User.js             # Mongoose schema: email, passwordHash, roles, timestamps
    RefreshToken.js      # (if using JWT refresh rotation)
  /controllers
    authController.js    # signup, login, logout, refresh, me
  /middleware
    authMiddleware.js    # verifies JWT / session on protected routes
    errorHandler.js
  /routes
    authRoutes.js
  /utils
    hash.js               # bcrypt wrappers
    tokens.js              # sign/verify JWT
  app.js
  server.js
.env
.env.example
.gitignore
```

## 4. Environment Variables (`.env`)
```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.d5k2cce.mongodb.net/<dbName>?retryWrites=true&w=majority&appName=Cluster0
JWT_ACCESS_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
PORT=5000
NODE_ENV=development
```
Note the URI now includes a **database name** (e.g. `/app_db`) — the snippet you pasted omits it, which means it would've defaulted to `test`. Name your DB explicitly.

Commit an `.env.example` with the same keys but placeholder values, never the real `.env`.

## 5. MongoDB Connection (singleton, not per-request)
Wrap the connection so it's created once and reused — the code you pasted opens and closes a client per script run, which is wrong for a long-running server.

```js
// src/config/db.js
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: { version: '1', strict: true, deprecationErrors: true },
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = connectDB;
```
Call `connectDB()` once in `server.js` before `app.listen`.

## 6. User Schema
```js
// src/models/User.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  name:         { type: String, trim: true },
  roles:        { type: [String], default: ['user'] },
  isVerified:   { type: Boolean, default: false },
  lastLoginAt:  { type: Date },
}, { timestamps: true });

module.exports = model('User', userSchema);
```
- `unique: true` on email creates a proper index — enforce uniqueness at the DB level, not just app level.
- Never store plaintext passwords or the JWT secret in the User document.

## 7. Password Hashing
```js
// src/utils/hash.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

exports.hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
exports.comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
```

## 8. Auth Flow
1. **Signup** (`POST /auth/signup`): validate input (email format, password strength) → check existing user → hash password → insert → issue tokens.
2. **Login** (`POST /auth/login`): find by email → `comparePassword` → issue access + refresh JWT → update `lastLoginAt`.
3. **Refresh** (`POST /auth/refresh`): verify refresh token (rotate it — store hashed refresh tokens in a `RefreshToken` collection so you can revoke on logout).
4. **Logout** (`POST /auth/logout`): delete/invalidate the stored refresh token.
5. **Protected routes**: `authMiddleware` verifies the access token from the `Authorization: Bearer <token>` header and attaches `req.user`.

## 9. Token Utility
```js
// src/utils/tokens.js
const jwt = require('jsonwebtoken');

exports.signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_TTL });

exports.signRefreshToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_TTL });

exports.verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET);
exports.verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);
```

## 10. Middleware
```js
// src/middleware/authMiddleware.js
const { verifyAccessToken } = require('../utils/tokens');

module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = verifyAccessToken(header.split(' ')[1]);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

## 11. Data Modeling for "everything else in the system"
For any other collections (e.g. posts, orders, profiles):
- Reference the user by `ObjectId` (`userId: { type: Schema.Types.ObjectId, ref: 'User' }`), don't duplicate user data.
- Add `createdAt`/`updatedAt` via `{ timestamps: true }` on every schema.
- Add indexes for fields you'll query/filter on often.
- Use Mongoose schema validation (`required`, `enum`, `min`/`max`) so bad data can't reach the DB — don't rely only on frontend validation.

## 12. Security Checklist
- [ ] Rotate the Atlas password (see top of doc)
- [ ] `.env` in `.gitignore`
- [ ] Rate-limit `/auth/login` and `/auth/signup` (`express-rate-limit`) to slow brute force
- [ ] Enforce password strength (min length, not just "not empty")
- [ ] Use HTTPS in production; set `secure`/`httpOnly` cookies if storing tokens in cookies
- [ ] Restrict Atlas Network Access to known IPs (or your host's egress range) instead of `0.0.0.0/0`
- [ ] Set least-privilege DB user roles in Atlas (readWrite on your app DB only, not admin)

## 13. Suggested Build Order
1. `connectDB()` + confirm ping works (your original snippet, just wrapped properly)
2. `User` model + signup endpoint + hashing
3. Login endpoint + access/refresh tokens
4. Auth middleware + one protected test route
5. Refresh/logout with token revocation
6. Remaining data models referencing `User`
7. Rate limiting + input validation + error handling middleware
8. Rotate credentials, review the security checklist, deploy

## 14. Package Install
```bash
npm install express mongoose bcrypt jsonwebtoken dotenv express-rate-limit
```
