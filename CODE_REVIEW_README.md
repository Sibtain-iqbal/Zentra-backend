# Zentra Backend - Comprehensive Codebase Review

This document provides a complete review and breakdown of everything implemented in the `Zentra-backend` project so far. It covers the architecture, configurations, models, middlewares, controllers, services, and routes.

## 1. Project Overview & Technologies
The Zentra backend is a structured Node.js/Express.js RESTful API application designed to act as a trading journal, analytics engine, and psychological state tracker for traders. It heavily relies on the following stack:
- **Core Framework**: Node.js with Express.js
- **Database**: MongoDB (via Mongoose ORM)
- **Authentication**: Passport.js (JWT & Google OAuth)
- **Validation**: Joi (Request validation)
- **Logging**: Winston and Morgan
- **Security**: Helmet, XSS-Clean, Express-Mongo-Sanitize, Cors, Rate Limiting
- **Documentation**: Swagger API docs
- **Integration**: External Python service for MT5 (MetaTrader 5) data synchronization.

## 2. Configuration & Utilities (`/src/config` & `/src/utils`)
- `config.js`: Loads `.env` variables using `dotenv` and validates them using `Joi`. It enforces necessary variables like `MONGODB_URL`, `JWT_SECRET`, SMTP configurations, Google OAuth keys, and MT5 API properties.
- `logger.js` & `morgan.js`: Sets up standard HTTP request logging and error logging.
- `passport.js`: Configures the authentication strategies:
  - `jwtStrategy`: Validates Bearer tokens.
  - `googleStrategy`: Handles Google SSO.
- `roles.js` & `tokens.js`: Manages user role definitions (`user`, `admin`) and token types (`ACCESS`, `REFRESH`, `RESET_PASSWORD`, `VERIFY_EMAIL`).
- **Utilities**: Include an `ApiError` class for standardized error handling, `catchAsync` for wrapping promise-based middleware, and custom logic like `encryption.js` for securing MT5 passwords.

## 3. Middlewares (`/src/middlewares`)
- `auth.js`: Implements Passport JWT authentication and checks if a user has the required roles/rights for a route.
- `error.js`: Global error handling mechanism. It intercepts errors, converts them to `ApiError` format if necessary, and returns consistent JSON error responses.
- `rateLimiter.js`: Protects authentication endpoints from brute-force attacks.
- `requireTradingPlan.js`: A specialized business-logic middleware. It ensures that users attempting to perform trading actions already have an active "Trading Plan" configured.
- `validate.js`: Takes Joi schemas and automatically validates incoming request parameters, queries, and bodies.

## 4. Database Models (`/src/models`)
The Mongoose models define the core entities of the application:
- **`user.model.js`**: Stores user details, auth credentials, Google SSO info, and MT5 account connection details. MT5 passwords are encrypted using AES-256-GCM before saving. Virtuals are configured for joining relations.
- **`trade.model.js`**: Represents individual trades. Tracks `entryTime`, `exitTime`, `profitLoss`, `session` (LONDON, NY, ASIA), `riskPercentUsed`, whether `stopLossHit`, and MT5 sync properties (`mt5DealId`, `mt5Symbol`, `source`).
- **`tradingPlan.model.js`**: Users' rules. Includes `maxTradesPerDay`, `riskPercentPerTrade`, `targetRiskRewardRatio`, `preferredSessions`, and `stopLossDiscipline`.
- **`dashboard.model.js`**: Aggregated performance data for a user's dashboard view.
- **`sessionForecast.model.js`**: Predictive insights for trading sessions, tracking `predictedBias`, `riskLevel`, `recommendations`, and `basedOnState`.
- **`stateAnalysis.model.js`**: Analyzes the physiological / psychological state of a trader. Has indicators and severity levels (`positive`, `warning`, `critical`).
- **`behaviorHeatmapHistory.model.js` & `stabilityTrendHistory.model.js`**: Tracks historical behavior patterns and consistency scores of users over time.
- **`token.model.js`**: Stores active authentication and verification tokens.

## 5. Services Layer (`/src/services`)
This layer encapsulates the strict business logic and data manipulation:

- **`auth.service.js`**
  - `loginUserWithEmailAndPassword(email, password)`: Verifies user credentials against hashed database values. Returns the `User` object or throws a `401 Unauthorized` ApiError.
  - `logout(refreshToken)`: Finds and deletes the session's refresh token from the database.
  - `refreshAuth(refreshToken)`: Validates the refresh token, invalidates it, and safely generates a new pair of access/refresh tokens.
  - `resetPassword(resetPasswordToken, newPassword)`: Validates the token and updates the user's password.
  - `verifyEmail(verifyEmailToken)`: Activates the user's account by setting `isEmailVerified` to true.

- **`user.service.js`**
  - `createUser(userBody)`: Checks if the email is taken and creates a new user.
  - `queryUsers(filter, options)`: Returns paginated user records.
  - `getUserById(id)` & `getUserByEmail(email)`: Standard user lookup operations.
  - `updateUserById(userId, updateBody)`: Partially updates a user document (can be used to store MT5 credentials).
  - `deleteUserById(userId)`: Removes a user from the database.

- **`mt5.service.js`**
  - `connectMT5Account(accountId, server, password, manualLogin)`: Makes an axios request to the Python backend to verify MT5 credentials. Sends `manualLogin: true` if it's the first time linking.
  - `fetchMT5Trades(accountId, server, password, fromDate, toDate)`: Pulls historical trades from the Python service using decrypted MT5 credentials.

- **`trade.service.js`**
  - `createTrade(userId, tradeBody)`: Saves a manual trade or imported trade to the database. Critically, calls `recalculateHistoryForDate` afterward.
  - `recalculateHistoryForDate(userId, targetDate)`: Private helper that updates `BehaviorHeatmapHistory` and `StabilityTrendHistory` for the given day using the `zentra` service.
  - `analyzeImportedTrades(userId, trades)`: Groups imported multiple trades by day and triggers bulk analytics operations.
  - `createBulkTrades(userId, tradesData)`: Inserts an array of newly synced trades and aggregates analysis.
  - `queryTrades`, `getTradeById`, `updateTradeById`, `deleteTradeById`, `deleteBulkTrades`: Standard CRUD mechanisms but configured to dynamically rewrite historical performance states on edits/deletes.

- **`tradingPlan.service.js`**
  - `createOrUpdateTradingPlan(userId, tradingPlanBody)`: Upserts the user's trading plan containing risk preferences.
  - `getTradingPlanByUserId(userId)` & `deleteTradingPlanByUserId(userId)`: Reading and deleting user plans.

- **`dashboard.service.js`**
  - `getCompleteDashboard(userId, period)`: Aggregates complete analytics for frontend rendering (PnL charts, Risk Metrics, Session performances, Insights) using the past 10 trades and psychological calculations.
  - `getDashboardSummary(userId, period)`: Returns a lighter version of the dashboard emphasizing Quick Stats, win rates, and recent trend alerts.

- **`analysis.service.js`** & **`zentra.js` (Analytical Core)**
  - `getCurrentState(userId)`: Computes the user's instantaneous physiological/psychological condition using the last 10 trades versus their active trading plan constraints.
  - `getSessionForecast(userId, session)`: Projects potential risk and behavioral tendencies for an upcoming session (LONDON, NY, ASIA).
  - `getPerformanceInsights(userId, period)`: Evaluates holistic performance over a given timeframe.
  - `getStateHistory(userId, filter)`: Calculates historical performance state arrays for charting.

- **`email.service.js`**
  - Provides transporters via `nodemailer` to dispatch standard verification and reset tokens.

- **`token.service.js`**
  - Internal mechanisms generating Google JWTs, local sign-in JWTs, and secure SHA hashes.

## 6. Controllers Layer (`/src/controllers`)
Controllers extract incoming objects from `req`, pipe them through the corresponding `service`, format data, and dispatch API responses (`res`):

- **`auth.controller.js`**
  - `register`, `login`, `logout`, `refreshTokens`: Map directly to `auth.service.js` and `token.service.js`. Returns standard `HTTP 200/201` payloads equipped with `user` data and `tokens` structures.
  - `forgotPassword`, `resetPassword`, `sendVerificationEmail`, `verifyEmail`: Standardized token management wrappers.
  - `googleCallback`: Catches Google OAuth success triggers. Computes the user's JWT tokens and dynamically redirects the request back to the `FRONTEND_URL` attached with the tokens in the URL parameters.

- **`mt5.controller.js`**
  - `connectMT5`: Verifies if an MT5 account is already linked. Relays the new login details to the backend Python layer via service, then persists `ACCOUNT_ID` locally.
  - `syncTrades`: Decrypts the stored user MT5 password on the fly, triggers the fetch service, imports the payload into standard `trade.model.js` documents (with `source.type = 'mt5'`), and executes a bulk insert.
  - `getConnectionStatus` & `disconnectMT5`: Provides connection checks and wipes associated MT5 synced data + user analytical history upon unlinking.

- **`trade.controller.js`**
  - `createTrade`, `createBulkTrades`: Receives validated trade inputs (Session, Risk, SL, TP properties) and writes them to manual storage.
  - `getTrades`, `getTrade`: Implements extensive sorting, limits, skips, and filtration by criteria like `stopLossHit` or `session` for data tables.
  - `updateTrade`, `deleteTrade`, `deleteBulkTrades`: Routes to mutate or drop trade history, triggering an analytics recalculation in the backing service.

- **`tradingPlan.controller.js`**
  - `createTradingPlan`: Builds schemas.
  - `getTradingPlan`, `getTradingPlanStatus`, `deleteTradingPlan`: Orchestrates checks to verify whether users meet the prerequisites to store trades (`hasTradingPlan` boolean outputs).

- **`analysis.controller.js`** 
  - `getState`, `getForecast`, `getInsights`, `getHistory`: Wraps the complex analysis heuristic engines of the application directly to GET endpoints. Returns interpreted states like UI severity labels instantly.

- **`dashboard.controller.js`**
  - Proxies rendering tasks to backend aggregators (`getDashboard`, `getSummary`), effectively offloading calculating mathematics from the frontend application entirely.

- **`user.controller.js`**
  - `createUser`, `getUsers`, `getUser`, `updateUser`, `deleteUser`: Basic user profile administration capabilities wrapped around `req.params.userId`.

- **`health.controller.js`**
  - Returns hardcoded HTTP OK responses meant to satisfy load balancers, Vercel health pingers, or Docker container heartbeat health checks.

## 7. Routes Layer (`/src/routes/v1`)
Maps HTTP verbs to controllers and applies middlewares (`auth`, `validate`, `requireTradingPlan`):
- **`auth.route.js`**: `/register`, `/login`, `/logout`, `/refresh-tokens`, `/google/callback`.
- **`trade.route.js`**: `POST /`, `GET /`, `POST /bulk`, `DELETE /bulk`, `PUT /:tradeId`. Most of these routes require both standard `auth()` and the `requireTradingPlan` middleware, ensuring users can't journal trades without a plan.
- **`mt5.route.js`**: `/connect`, `/sync`, `/status`, `/disconnect`. Validated by matching Joi schemas.
- **`tradingPlan.route.js`**, **`dashboard.route.js`**, **`analysis.route.js`**: Standard CRUD and data retrieval routes.
- **`docs.route.js`**: Serves the Swagger UI based on the extensive JSDoc `@swagger` comments scattered throughout the route files.

## Summary & Code Flow execution
1. **Request Entry**: A REST request hits `app.js` (Express initialized here). Global middlewares (Cors, Helmet, Morgan) are executed.
2. **Routing**: It falls into `routes/v1/index.js`, which directs it to a specific route file (e.g., `trade.route.js`).
3. **Validation & Auth**: Route-specific middleware fires. `auth()` verifies the JWT. `requireTradingPlan` verifies the user's state. `validate()` checks the body against Joi schemas.
4. **Controller Action**: Controller method (e.g., `tradeController.createTrade`) handles the request.
5. **Business Service**: Controller passes payloads to `tradeService.createTrade()`. The service accesses the database using Mongoose (`Trade` model). It also calculates behavior metrics via `zentra` functions.
6. **Response / Errors**: Service returns the Mongoose document to the controller, which replies with `HTTP 201`. If anything fails, `ApiError` is thrown, caught by `catchAsync`, and processed uniformly by `error.js`.

**Overall Status**: The codebase is highly modular, robustly structured, and securely implemented. The connections between the database models, automated analytics pipelines, and third-party MT5 synchronization are functioning accurately.
