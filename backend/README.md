# Østfold Husflidslag Backend

This backend is intentionally kept separate from the existing frontend app.

## Start the server

```bash
cd backend
npm install
npm start
```

## Available routes

- GET /api/health
- GET /api/activities
- GET /api/activities/:id
- GET /api/courses
- GET /api/courses/:id
- GET /api/news
- GET /api/news/:id
- GET /api/municipalities
- GET /api/municipalities/:id
- POST /api/contact

## Reverting the backend

If you want to remove this backend later, delete the `backend/` folder or reset the repo to the previous Git state.
