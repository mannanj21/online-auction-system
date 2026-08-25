# Online Auction System

A full-stack auction application for creating listings, placing live bids, and managing users.

## Core features

- Account signup, login, logout, and password changes with secure cookies
- Create auctions with Cloudinary image uploads
- Browse auctions, view details, place bids, and see bid history
- Real-time bid and viewer updates with Socket.IO
- Personal dashboard, auction history, bid history, and login history
- Admin dashboard and user list

## Stack

- Frontend: React, Vite, Tailwind CSS, Redux Toolkit, React Query
- Backend: Node.js, Express, MongoDB/Mongoose, Socket.IO
- Services: Cloudinary for images and Resend for contact email

## Run locally

Prerequisites: Node.js 20+, npm, MongoDB, and Cloudinary credentials.

Install dependencies:

```bash
cd server
npm install
cd ../client
npm install
```

Create `server/.env` from `server/.env.example`, then create `client/.env` from `client/.env.example`.

Start the backend:

```bash
cd server
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm run dev
```

Open http://localhost:5173.

## Verification

```bash
cd client
npm run lint
npm run build
```

## Project layout

```text
client/  React frontend
server/  Express API, Socket.IO server, MongoDB models
```

## Next improvements

- Add automated API and browser tests
- Add auction categories/search filters
- Add moderation and auction lifecycle controls
