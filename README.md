# Smart Cloud ERP & POS System

A production-ready **MERN stack** application built on a **Modular Monolith** architecture.

---

## Project Structure

```
pos-system/
├── server/                     # Node.js / Express backend
│   ├── server.js               # Entry point
│   ├── .env.example            # Environment template
│   ├── package.json
│   └── src/
│       ├── app.js              # Express factory (middleware + routes)
│       ├── config/
│       │   ├── db.js           # MongoDB connection
│       │   └── constants.js    # App-wide enums
│       ├── middleware/
│       │   ├── auth.middleware.js        # JWT protect + RBAC authorize
│       │   ├── error.middleware.js       # Centralised error handler
│       │   └── rateLimiter.middleware.js # Global + auth-specific limits
│       ├── utils/
│       │   ├── asyncHandler.js           # Eliminates try/catch boilerplate
│       │   ├── responseFormatter.js      # Uniform API response shape
│       │   ├── generateInvoiceNumber.js  # INV-YYYYMMDD-XXXXXX
│       │   └── logger.js                 # Winston logger
│       └── modules/
│           ├── auth/
│           │   ├── auth.model.js         # User (RBAC, bcrypt, QR token)
│           │   ├── cashier.model.js      # Cashier profile
│           │   ├── auth.controller.js    # Register, Login, QR flow
│           │   └── auth.routes.js
│           ├── inventory/
│           │   ├── product.model.js      # Barcode, SKU, stock, expiry, supplier
│           │   ├── supplier.model.js     # Standalone supplier
│           │   ├── inventory.controller.js
│           │   └── inventory.routes.js
│           ├── billing/
│           │   ├── invoice.model.js      # Offline flags, void/fraud prevention
│           │   ├── payment.model.js      # Split-tender payments
│           │   ├── billing.controller.js # Create, void, sync, dashboard
│           │   └── billing.routes.js
│           ├── employees/
│           │   ├── employee.model.js     # HR master record + QR code value
│           │   ├── attendance.model.js   # Clock-in/out, hours computed
│           │   ├── payroll.model.js      # Pay period, deductions, net pay
│           │   ├── employees.controller.js
│           │   └── employees.routes.js
│           └── ai-analytics/
│               ├── prediction.model.js   # ML prediction logs
│               ├── chatbotLog.model.js   # AI assistant sessions
│               ├── analytics.controller.js
│               └── analytics.routes.js
└── client/                     # React frontend (to be scaffolded)
    └── src/
        └── utils/
            └── offlineSync.js  # IndexedDB offline billing + auto-sync
```

---

## Quick Start

### 1. Configure environment
```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI and secrets
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```
Server runs at `http://localhost:5000`

---

## API Reference

### Auth — `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Email + password login |
| POST | `/qr/generate` | Generate QR token for cashier |
| POST | `/qr/login` | Authenticate via QR scan |
| GET | `/me` | Get current user profile |
| POST | `/logout` | Logout (audit log) |

### Inventory — `/api/inventory`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/products` | List products (paginated) |
| POST | `/products` | Create product |
| GET | `/products/sku/:sku` | Lookup by SKU (POS scan) |
| GET | `/products/barcode/:barcode` | Lookup by barcode |
| PUT | `/products/:id` | Update product |
| GET | `/alerts/low-stock` | Products at/below threshold |
| GET | `/alerts/expiring?days=30` | Expiring products |
| GET/POST | `/suppliers` | Supplier CRUD |

### Billing — `/api/billing`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/invoices` | Create invoice |
| GET | `/invoices` | List invoices |
| PATCH | `/invoices/:id/void` | Void invoice (with reason) |
| POST | `/sync` | **Offline batch sync** |
| GET | `/dashboard` | Today's sales summary |

### Employees — `/api/employees`
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/` | Employee CRUD |
| POST | `/attendance/scan` | **QR clock-in/out** |
| GET | `/attendance` | Attendance records |
| POST | `/payroll/generate` | Generate payroll |
| PATCH | `/payroll/:id/pay` | Mark payroll as paid |

### Analytics — `/api/analytics`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/summary` | Revenue, top products, low stock |
| GET/POST | `/predictions` | AI prediction logs |
| POST | `/chatbot/sessions` | Start chat session |
| POST | `/chatbot/sessions/:id/message` | Append message |
| PATCH | `/chatbot/sessions/:id/end` | End session + rating |

---

## Offline Sync (React Client)

The `client/src/utils/offlineSync.js` module provides:

```js
import { initOfflineSync, saveInvoiceOffline } from './utils/offlineSync';

// App startup
initOfflineSync(jwtToken); // auto-syncs on network restore

// At POS sale submission
if (!navigator.onLine) {
  await saveInvoiceOffline(invoiceData); // stored in IndexedDB
} else {
  await api.post('/api/billing/invoices', invoiceData);
}
```

---

## Security Features

- **JWT authentication** with configurable expiry
- **RBAC** with 5 role levels: `super_admin`, `admin`, `manager`, `cashier`, `employee`
- **Rate limiting**: 200 req/15min global, 20 req/15min on auth endpoints
- **Helmet** security headers
- **NoSQL injection prevention** via `express-mongo-sanitize`
- **Invoice voids** — never deleted, permanently flagged with reason and actor
- **Single-use QR tokens** — invalidated immediately after login
- **bcrypt** password hashing (cost factor 12)
