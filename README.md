# 🛒 ShopTracker

<p align="center">
  <img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="300" alt="ShopTracker Logo">
</p>

<p align="center">
  <strong>Modern Multi-Shop Inventory, Sales Order, Finance & Courier Settlement System</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Laravel-12.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" alt="Laravel 12">
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4">
  <img src="https://img.shields.io/badge/Inertia.js-v2.x-9553E9?style=for-the-badge&logo=inertia&logoColor=white" alt="Inertia.js">
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License MIT">
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Design Principles](#-architecture--design-principles)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation Steps](#installation-steps)
  - [Demo Data & Seeders](#demo-data--seeders)
- [Docker & Containerized Setup](#-docker--containerized-setup)
- [Environment Configuration](#-environment-configuration)
- [Console Commands & Background Automation](#-console-commands--background-automation)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [CI/CD & Deployment](#-cicd--deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**ShopTracker** is an all-in-one inventory, order processing, and financial operations platform engineered for modern retail and social commerce businesses. Built with a **mobile-first** responsive design using **Laravel 13**, **Inertia.js**, and **React 19**, it bridges the gap between fast warehouse operations on mobile devices and comprehensive financial reporting on desktop computers.

It features native support for **multi-shop tenancy**, **courier Cash-on-Delivery (COD) reconciliation**, **FIFO batch inventory costing**, **Google Drive automated backups**, and an **AI-powered Myanmar customer message parser** (integrating Google Gemini & OpenRouter LLMs) to streamline conversational commerce order entry.

---

## ✨ Key Features

### 🏢 Multi-Tenant Multi-Shop Isolation
- **Dynamic Context Switching:** Switch between authorized store locations instantly from the top navigation bar.
- **Data Scoping:** Automatic tenant isolation using the global `BelongsToShop` Eloquent trait, ensuring orders, stock, and financials are securely segregated per store.
- **Superadmin & Manager Roles:** Role-based access control with administrative privileges across all store entities.

### 📦 Inventory & Variant Management
- **Dynamic Product Variants:** Multi-attribute matrix builder supporting dynamic sizes, colors, and SKU generation.
- **FIFO Batch Cost Allocation:** Track purchase batches with exact unit costs, calculating realistic Cost of Goods Sold (COGS).
- **Stock Adjustments & Audit Logs:** Record shrinkage, damages, and audit adjustments with detailed reason codes and actor histories.
- **Real-Time Stock Alerts:** Low-stock threshold tracking and out-of-stock badges.

### 🛍️ Sales Orders & Fulfillment Lifecycle
- **End-to-End Status Pipeline:** `Pending` ➔ `Confirmed` ➔ `Fulfilling` ➔ `Shipped` ➔ `Delivered` / `Returned` / `Cancelled`.
- **Courier Dispatch Integration:** Assign couriers, input tracking waybill numbers, and calculate delivery fees.
- **Partial Returns & Refunds:** Granular item-level return and refund processing with automatic inventory restocking.

### 💵 Courier Settlement & COD Reconciliation
- **Cash-on-Delivery Batch Reconciliation:** Consolidate outstanding delivered orders by courier.
- **Service Fee Deductions:** Automatically compute courier service fees against gross COD collected to determine net payout.
- **Financial Synchronization:** Auto-generates revenue and expense ledger entries upon settlement completion.

### 📥 Purchase Orders & Inbound Shipments
- **Supplier Order Tracking:** Draft, order, and confirm shipments with expected arrival timelines.
- **Automated Restocking:** Marking purchase orders as arrived automatically increments inventory counts and generates timestamped product batches.
- **Supplier Management:** Track supplier lead times, contact information, and purchase history.

### 📈 Financial Ledger & Cash Flow Intelligence
- **Automated Real-Time Ledger:** Unified cash ledger tracking sales income, operational expenses, supplier payouts, and courier fees.
- **Financial Metrics:** Instant calculation of Gross Revenue, COGS, Total Expenses, and Net Profit.
- **Manual Balance Adjustments:** Record capital injections, petty cash withdrawals, and custom adjustments.

### 🤖 AI-Powered Myanmar Address & Message Parser
- **Smart Order Extraction:** Parse unstructured customer messages copied from Facebook Messenger, Viber, Telegram, or SMS into structured form data.
- **Normalized Myanmar Details:** Extracts customer name (stripping polite conversational particles), normalizes Myanmar phone digits (`၀-၉` ➔ `09...`), cleans addresses, and isolates delivery notes.
- **Multi-Model Fallback:** Native Google Gemini API with seamless fallback rotation and OpenRouter LLM integration.

### 📑 Excel Reporting & Cloud Backups
- **One-Click Excel Exports:** Fast multi-sheet XLSX exports for Sales Orders, Purchase Orders, and Expenses.
- **Automated Google Drive Cloud Backups:** Artisan command to snapshot the SQLite database and sync encrypted backups to Google Drive.

---

## 🏗️ Architecture & Design Principles

ShopTracker follows clean Laravel design patterns:

```
┌─────────────────────────────────────────────────────────────┐
│                 Inertia.js + React 19 Frontend               │
│         (Tailwind CSS v4 + Shadcn UI + Lucide Icons)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON Payloads
┌──────────────────────────────▼──────────────────────────────┐
│                    Laravel HTTP Routing                     │
│               (Auth & BelongsToShop Middleware)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                        Controllers                          │
│         (AiAddressParser, Inventory, Sales, Finance)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                       Service Layer                         │
│   (SalesOrderService, PurchaseOrderService, CashFlowService)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  Eloquent Models & Scopes                   │
│             (BelongsToShop Trait, ActivityLog)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Database Layer (SQLite / MySQL)           │
└─────────────────────────────────────────────────────────────┘
```

- **Service Layer Pattern (`app/Services/`):** Heavy business operations (such as order fulfillment, FIFO batch deductions, and multi-ledger reconciliations) are encapsulated into dedicated service classes wrapped in database transactions.
- **Tenant Scope Trait (`app/Traits/BelongsToShop.php`):** Implements an Eloquent global scope and `creating` lifecycle hook to automatically bind records to the active session's `shop_id`.
- **Single-Page Application with Inertia.js:** Eliminates API boilerplate and serializer overhead by passing typed server props directly into React components.

---

## 💻 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | [Laravel 12.x / 13.x](https://laravel.com) (PHP 8.3+) |
| **Frontend Framework** | [React 19](https://react.dev) with [Inertia.js v2](https://inertiajs.com) |
| **Type Safety** | [TypeScript 5.x](https://www.typescriptlang.org/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com), [Shadcn UI](https://ui.shadcn.com), [Lucide React](https://lucide.dev) |
| **Database** | SQLite (Default for zero-config speed) / MySQL / PostgreSQL |
| **Excel Processing** | [Maatwebsite Excel 3.1](https://laravel-excel.com) |
| **Media & Logging** | [Spatie MediaLibrary](https://spatie.be/docs/laravel-medialibrary), [Spatie ActivityLog](https://spatie.be/docs/laravel-activitylog) |
| **AI Integrations** | Google Gemini API (`gemini-2.5-flash`, `gemini-3.5-flash`) & OpenRouter |
| **DevOps & CI/CD** | Docker, Docker Compose, Nginx, GitHub Actions |

---

## 🚀 Getting Started

### Prerequisites

Ensure your system meets the following requirements:
- **PHP:** `^8.3` (with extensions: `pdo_sqlite`, `mbstring`, `xml`, `ctype`, `intl`, `bcmath`, `gd`, `zip`)
- **Composer:** `^2.x`
- **Node.js:** `^20.x` or `^22.x` & `npm`
- **Git**

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pyaesonephyo21/shoptracker-backend.git
   cd shoptracker-backend
   ```

2. **Install PHP and Node dependencies:**
   ```bash
   composer install
   npm install
   ```

3. **Configure the environment file:**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

4. **Initialize SQLite database:**
   ```bash
   touch database/database.sqlite
   php artisan migrate
   ```

5. **Link storage directory:**
   ```bash
   php artisan storage:link
   ```

6. **Start local development server:**
   
   You can run the all-in-one development command (starts Laravel server, Queue listener, Vite bundler, and log streamer):
   ```bash
   composer run dev
   ```
   
   Or run the services individually in separate terminal windows:
   ```bash
   # Terminal 1: Laravel Backend
   php artisan serve

   # Terminal 2: Vite Frontend Bundler
   npm run dev

   # Terminal 3: Background Queue Worker
   php artisan queue:listen --tries=1
   ```

7. **Access the application:**
   Open [http://localhost:8000](http://localhost:8000) in your browser.

---

### 🧪 Demo Data & Seeders

To populate the database with demo shops, categories, couriers, suppliers, products, and sample sales orders:

```bash
php artisan migrate:fresh --seed
```

#### Default Demo Credentials:
- **Email:** `admin@example.com`
- **Password:** `password`

---

## 🐳 Docker & Containerized Setup

ShopTracker includes ready-to-use `Dockerfile` and `docker-compose.yml` configurations for isolated containerized development or deployment.

1. **Build and start the containers:**
   ```bash
   docker-compose up -d --build
   ```

2. **Execute migrations inside the app container:**
   ```bash
   docker-compose exec app php artisan migrate --seed
   ```

3. **Open the application:**
   The Nginx web server will be available at [http://localhost:8080](http://localhost:8080).

---

## ⚙️ Environment Configuration

Key environment parameters in `.env`:

| Key | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_NAME` | Name of the application | `ShopTracker` |
| `APP_ENV` | Application environment | `local` / `production` |
| `APP_TIMEZONE` | Default timezone | `Asia/Yangon` |
| `DB_CONNECTION` | Database driver | `sqlite` (or `mysql`) |
| `GEMINI_API_KEY` | Google Gemini API Key for Myanmar address parser | `AIzaSy...` |
| `GEMINI_PROXY_URL` | Optional proxy URL for Gemini API | *(optional)* |
| `OPENROUTER_API_KEY`| OpenRouter fallback API key | `sk-or-v1-...` |
| `OPENROUTER_MODEL` | Default model for OpenRouter fallback | `google/gemma-4-26b-a4b-it:free` |
| `GOOGLE_DRIVE_*` | Credentials for automated Google Drive backups | *(Client ID, Secret, Refresh Token)* |

---

## 🛠️ Console Commands & Background Automation

ShopTracker includes custom Artisan commands for routine administrative maintenance:

- **Database Cloud Backup:**
  ```bash
  php artisan backup:database
  ```
  Zips the local SQLite database and uploads a timestamped backup to the configured Google Drive destination folder.

- **Google Drive Authentication Setup:**
  ```bash
  php artisan drive:auth
  ```
  Interactive CLI assistant for generating OAuth refresh tokens.

- **Setup Initial Cash Flow Ledger:**
  ```bash
  php artisan cashflow:setup
  ```
  Synchronizes historic sales and expense records into the cash transactions ledger.

---

## 🧪 Testing & Quality Assurance

ShopTracker maintains high code standards using automated tests and Laravel Pint:

- **Run Test Suite:**
  ```bash
  php artisan test
  ```
- **Code Style Linting & Formatting (Laravel Pint):**
  ```bash
  # Check code style
  ./vendor/bin/pint --test

  # Auto-fix code style issues
  ./vendor/bin/pint
  ```
- **Frontend Production Build Check:**
  ```bash
  npm run build
  ```

---

## 🚀 CI/CD & Deployment

The repository includes a production-tested GitHub Actions workflow (`.github/workflows/deploy.yml`) that performs:

1. **Continuous Integration:** Validates PHP dependencies, installs Node packages, compiles Vite assets, and runs PHPUnit tests.
2. **Atomic Asset Sync:** Uploads compiled artifacts via `rsync` over SSH.
3. **Zero-Downtime Deployment (`deploy.sh`):** Enables maintenance mode, pulls latest code, runs database migrations, refreshes route/config caches, restarts queue workers, and restores traffic.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Format your code (`./vendor/bin/pint`)
5. Push to the Branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

---

## 📄 License

This project is open-sourced under the [MIT License](LICENSE).
