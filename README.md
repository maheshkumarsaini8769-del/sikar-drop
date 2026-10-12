# Sikar Drop 💧
> **Wholesale Bottled Water & Beverage Depot Management Platform**

Sikar Drop is a production-grade wholesale beverage distribution and retail storefront platform built for high-throughput supply chain operations, bulk corporate ordering, automated inventory tracking, khata credit ledger, and dynamic local delivery verification.

---

## 🌟 Key Features

### 🛒 Customer Storefront
- **Wholesale & Retail Catalog:** Tiered B2B pricing, case-pack volume discounts, and live inventory status.
- **Delivery Availability Engine:** Real-time customer delivery check by area, pincode, and admin-managed delivery zones.
- **One-Click Cart & Checkout:** Instant address validation, cash-on-delivery & online payment options, OTP verification.
- **Bulk Order Calculator:** Dynamic corporate quoting tool for offices, events, and restaurants.
- **Order Tracking:** Live status tracking with milestone progression and delivery ETA.

### ⚡ Enterprise Admin Hub
- **POS / Manual Sale Counter:** Fast point-of-sale register with real-time receipt generation and historical sales ledger.
- **Khata Credit Ledger:** Complete customer credit/debit management, outstanding balance tracking, and payment reminders.
- **Delivery Zone Controller:** Live toggles to enable/disable service areas, set minimum delivery order values, and adjust delivery charges.
- **Inventory & Stock Manager:** Low-stock threshold alerts, supplier PO receiving, and stock movement audit logs.
- **Enterprise Analytics:** Revenue charts, top-selling SKUs, customer cohort retention metrics, and audit logs.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/maheshkumarsaini8769-del/sikar-drop.git
   cd sikar-drop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Access the platform:
   - **Storefront:** [http://localhost:8080](http://localhost:8080)
   - **Admin Hub:** [http://localhost:8080/admin.html](http://localhost:8080/admin.html)

---

## 📁 Project Structure

```
sikar-drop/
├── api/                  # Vercel serverless function bridge
│   └── index.js
├── assets/               # High-resolution product images and branding
├── data/                 # SQLite production database (seed catalog & tables)
│   └── sikar_drop.db
├── db.js                 # Database schema, initialization & transaction engine
├── server.js             # Express REST API & static file server
├── index.html            # Main storefront
├── products.html         # Full catalog with single-category filtering
├── categories.html       # Visual category directory
├── bulk.html             # Corporate bulk order calculator
├── track.html            # Real-time order tracking
├── about.html            # About Sikar Drop
├── why.html              # Quality standards & distribution
├── faq.html              # Frequently Asked Questions
├── contact.html          # Depot contact & Google Maps location
├── admin.html            # Full Enterprise Admin Management Hub
├── package.json          # Project manifest & dependencies
└── vercel.json           # Vercel deployment & routing configuration
```

---

## 🔒 Security & Performance
- **ACID Transactions:** Full database transaction safety across stock adjustments, sales, and payments.
- **WAL Mode:** SQLite Write-Ahead Logging enabled for high-concurrency read/write operations.
- **Input Sanitization:** Parameterized SQL queries preventing SQL injection vulnerabilities.
- **Zero-Latency CDN:** Static assets served globally via edge networks.

---

## 📄 License
This project is proprietary and developed for Sikar Drop Beverage Depot.
