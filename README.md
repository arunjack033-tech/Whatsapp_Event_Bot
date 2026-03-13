# WhatsApp Event Registration Bot Backend

## Tech Stack
- Node.js
- Express.js
- Supabase (PostgreSQL)

## Project Structure
- `server.js`
- `routes/webhook.js`
- `services/whatsapp.js`
- `supabaseClient.js`

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill values.
3. Create this table in Supabase:
   ```sql
   create table if not exists registrations (
     phone_number text primary key,
     name text,
     tshirt_size text,
     payment_status text default 'started',
     created_at timestamptz default now()
   );
   ```
4. Start server:
   ```bash
   npm run dev
   ```

## Endpoints
- `GET /health`
- `GET /webhook` (WhatsApp verification)
- `POST /webhook` (incoming WhatsApp messages)
- `GET /webhook/admin/registrations` (admin list)
  - Header: `Authorization: Bearer <ADMIN_API_KEY>` if set

## Conversation Flow
1. User sends `Hi`
2. Bot replies:
   ```
   Welcome to Church Event Registration 🙏
   1 Register
   2 Event Details
   ```
3. If user sends `1`, bot asks for name.
4. Bot asks T-shirt size `S / M / L / XL`.
5. Bot sends payment instruction and UPI link:
   `upi://pay?pa=church@upi&pn=ChurchEvent&am=300`
6. Bot asks for screenshot or UPI transaction ID.
7. Registration row is stored in Supabase and updated by step.
