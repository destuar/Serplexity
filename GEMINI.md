# Serplexity Project Documentation

## Project Overview

This document provides a comprehensive overview of the Serplexity project, a full-stack web application designed for SERP (Search Engine Results Page) analysis and competitor tracking. The application allows users to monitor their online visibility, track competitors, and gain insights into their search performance.

## Tech Stack

The project is built with a modern tech stack:

-   **Frontend**:
    -   React
    -   Vite
    -   TypeScript
    -   Tailwind CSS
    -   React Router
    -   Axios
-   **Backend**:
    -   Node.js
    -   Express.js
    -   TypeScript
    -   Prisma (ORM)
    -   PostgreSQL
    -   JWT for authentication
    -   BullMQ for background jobs
-   **DevOps**:
    -   Docker

## Project Structure

The repository is organized into a monorepo structure with two main packages: `frontend` and `backend`.

```
/
├── backend/                # Node.js backend application
│   ├── prisma/             # Prisma schema and migrations
│   ├── src/                # Source code
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Express controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   ├── queues/         # BullMQ queues and workers
│   │   ├── routes/         # Express routes
│   │   └── services/       # Business logic
│   └── ...
├── frontend/               # React frontend application
│   ├── src/                # Source code
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # React hooks
│   │   ├── lib/            # Library functions
│   │   ├── pages/          # Application pages
│   │   └── services/       # API services
│   └── ...
├── infra/                  # Infrastructure configuration
│   └── docker/             # Docker-compose setup
└── ...
```

## Getting Started

To get the project up and running, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    ```
2.  **Install dependencies**:
    -   Navigate to the `frontend` directory and run `npm install`.
    -   Navigate to the `backend` directory and run `npm install`.
3.  **Set up environment variables**:
    -   Create a `.env` file in the `backend` directory based on the `.env.example` file.
    -   Create a `.env` file in the `frontend` directory based on the `.env.example` file.
4.  **Start the development servers**:
    -   In the `frontend` directory, run `npm run dev`.
    -   In the `backend` directory, run `npm run dev`.

## Available Scripts

### Frontend

-   `npm run dev`: Starts the development server.
-   `npm run build`: Builds the application for production.
-   `npm run lint`: Lints the codebase.
-   `npm run test`: Runs the test suite.

### Backend

-   `npm run dev`: Starts the development server with `ts-node-dev`.
-   `npm run build`: Compiles the TypeScript code to JavaScript.
-   `npm run start`: Starts the production server.
-   `npm run test`: Runs the test suite with Jest.
-   `npm run prisma:migrate:dev`: Runs database migrations.

## Environment Variables

The application requires the following environment variables to be set:

### Backend (`backend/.env`)

-   `DATABASE_URL`: The connection string for the PostgreSQL database.
-   `JWT_SECRET`: A secret key for signing JWTs.
-   `GOOGLE_CLIENT_ID`: Google OAuth client ID.
-   `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
-   `STRIPE_SECRET_KEY`: Stripe API secret key.
-   `REDIS_URL`: The connection string for the Redis server.

### Frontend (`frontend/.env`)

-   `VITE_API_BASE_URL`: The base URL for the backend API.

## Database

The project uses Prisma as the ORM to manage the PostgreSQL database. The database schema is defined in `backend/prisma/schema.prisma`.

To create and apply database migrations, use the following command in the `backend` directory:

```bash
npx prisma migrate dev --name <migration-name>
```
