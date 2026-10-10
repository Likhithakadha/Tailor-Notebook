# Tailor Notebook - Digital Order Management

Full-stack app for tailors: customer management, per-dress-type measurement profiles, orders with status tracking,
fitting/delivery appointments, fabric & design catalog, PDF measurement cards, in-app
notifications and JSON data backup.

Stack: Node.js + Express + sql.js (pure-JS SQLite, no native build step) + JWT (backend),
React + Vite (frontend).

## Easiest way (Windows + Microsoft Edge)

1. Install Node.js (LTS) from https://nodejs.org (one time).
2. Double-click **start.bat**.
3. Edge opens at **http://localhost:5000** - frontend and backend both run from this one address.
4. On the very first run, demo content is added automatically (8 customers, measurements with versions,
   10 orders in every status, appointments, fabric/design catalog and notifications). Login with:
   **Email:** demo@tailor.com   **Password:** demo123
   (or click "Create a shop account" to start with your own empty shop).

Keep the black console window open while using the app. Close it to stop the server.

## Manual way (PowerShell, two windows)

Backend (also serves the built frontend):
    cd backend
    npm install
    npm start

Frontend development mode (optional, hot reload at http://localhost:5173):
    cd frontend
    npm install
    npm run dev

To rebuild the frontend after changes: `cd frontend; npm run build`

## Languages and page backgrounds

- **Languages:** English, Telugu (తెలుగు) and Hindi (हिन्दी). Use the language buttons at the top right of every page
  (and on the Login / Register screens). The choice is remembered in the browser.
- All labels, buttons, messages, dress types, measurement names, statuses, dates and notifications follow the chosen
  language. Names, addresses, notes and other text you type are saved exactly as you typed them.
- To change or add a translation, edit `frontend/src/i18n/te.js` (Telugu) or `frontend/src/i18n/hi.js` (Hindi). The key is the
  English text used in the app; a missing translation simply shows English.
- **Backgrounds:** every page has its own look (Overview, Customers, Measurements, Orders, Appointments, Catalog,
  Customer page, Login, Register). They are defined at the end of `frontend/src/styles.css` under "Page backgrounds".
- After changing anything in `frontend/src`, delete the `frontend\dist` folder and run **start.bat** again so the
  frontend is rebuilt.

## Customer, measurement and order management

**Customer Management** (sidebar: Customers)
- Each customer has a customer ID (CUST-0001, CUST-0002 ...), name, phone, gender, address, email, notes and
  a list of previous orders.
- Search by name, phone number or customer ID; filter by gender.
- Returning customers are never entered twice: adding a customer with a phone number that already exists offers
  the saved record instead, and the order form finds existing customers by name / phone / ID.

**Measurement Management** (sidebar: Measurements)
- Every dress type has its own fields: Blouse (shoulder, bust, waist, sleeve length, armhole, neck depth,
  blouse length), Salwar kameez, Churidar, Kurta, Shirt, Pant, Suit/Blazer, Lehenga, Skirt, Kids frock and
  Other. You can also add your own custom measurement fields to any entry.
- A customer can keep several **profiles** per dress type (e.g. Blouse - "Wedding fit" and Blouse - "Casual fit").
  Saving again inside a profile creates a new **version**; older versions stay in the history.
- Rename a profile, view history, download a PDF measurement card, or start an order with a profile.

**Orders** (sidebar: Orders)
- "+ New order" (Orders page, a customer's page, or "Use in new order" on any measurement profile):
  1) pick the customer (or add a new one on the spot), 2) pick the dress type and one of that customer's saved
  measurement profiles, or take new measurements right there, 3) fabric / design, quantity, order date,
  delivery date, price and advance.
- Every order gets an **Order ID** (ORD-0001, ORD-0002 ...). The order list shows: order ID, customer, dress type,
  design/model, quantity, the linked measurements (profile + values), order date, delivery date, price,
  advance paid and **remaining amount** (remaining = price - paid so far).
- Search orders by order ID, customer name, phone, customer ID or fabric/design.

**Design details (saved per order)**
- Dress photo (reference picture from the customer), neck design, sleeve design, stitching style and customer
  instructions. Photos are shrunk in the browser and stored in `backend/uploads/` (kept when you back up the folder).
- Shown on the Orders page, on the customer's page and as "Recent designs" on the Dashboard; editable with the
  order's Edit button. For a returning customer the order form offers "Copy from last ... order".

**Delivery date tracking**
- Tabs on the Orders page: **Today**, **Tomorrow**, **Upcoming**, **Delayed** (with live counts).
  An order is "Delayed" when its delivery date has passed and it is not yet delivered or cancelled.
  Delivered and cancelled orders never show as delayed. Each order shows a badge such as
  "Due today", "Due in 5 days" or "Delayed by 2 days".
- The Dashboard shows the same four counts; click one to open that view.

**Payment tracking**
- Each order has a payment status: **Paid**, **Partial** or **Pending**.
- Use **Add payment** on an order to record money received later (or "Paid in full"); the remaining amount
  updates and a notification is created. Filter orders by payment status, and see the total balance to collect
  on the Dashboard.

**Dashboard**
- Four cards: Customers, Active orders, Today's delivery, Pending payments (amount). Plus a 7-day delivery chart,
  a collection meter (received vs to collect), today's and delayed deliveries, recent designs and appointments.

Existing databases are upgraded automatically on start (customer IDs and order IDs are added, orders get a quantity of 1 and an order date; old
measurements become the "Default" profile). Gender for old customers can be filled in with "Edit customer".

## Features mapped to the project requirements

Frontend: custom measurement forms, order management, customer database with search,
appointment scheduling, order status stepper, fabric & design catalog, form validation.
Backend: REST API, JWT auth, validation middleware, PDF measurement cards (pdfkit),
notification system (order/appointment events), data backup export.
Database: SQLite schema (customers, measurements, orders, appointments, catalog,
notifications), measurement versioning, indexes, relations with cascading deletes.

## API summary (all except auth need `Authorization: Bearer <token>`)

- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- /api/customers (CRUD; ?search= name/phone/customer ID, ?gender=; POST returns 409 + the existing customer
  when the phone number is already saved)
- POST/GET /api/customers/:id/measurements (body: garmentType, profileName, values, notes - every save in the
  same profile creates a new version), DELETE /api/customers/:id/measurements/:mid,
  PUT /api/customers/:id/measurement-profiles (rename a profile),
  GET /api/customers/:id/measurements/:mid/pdf
- GET /api/measurements (?search=&garmentType=&customerId=) - all measurements across customers
- /api/orders (CRUD), PATCH /api/orders/:id/status, GET /api/orders/meta/summary
- /api/appointments (list/create/status/delete)
- /api/catalog (CRUD), /api/notifications, GET /api/backup

Data is stored in backend/data/tailor_notebook.db (created automatically).

## Demo data

- Added automatically on first start when the database has no users.
- Add it manually: `cd backend; npm run seed`
- Wipe and re-create the demo shop: `npm run seed:reset`
- Demo login: demo@tailor.com / demo123
