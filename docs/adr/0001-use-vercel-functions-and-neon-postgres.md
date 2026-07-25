# Use Vercel Functions and Neon Postgres

V1 needs inexpensive, low-operations hosting for a React app, server-side API routes, and relational storage while remaining portable if its needs change. We use Vercel Node Functions and Neon Postgres through Drizzle, with verified encrypted backups and manual production migrations, because that provides a suitable managed foundation without committing backend code to Vercel-specific infrastructure.
