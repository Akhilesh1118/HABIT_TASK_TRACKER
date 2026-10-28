# Habit & Task Tracker — Plan • Focus • Grow

A full-stack, personal daily productivity and habit tracking web application built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Node.js / Express**, and **MongoDB Atlas**. Features a GitHub-style activity heat grid, Pomodoro focus timer, spaced repetition revision engine, streak protection, quick notes, and AI-powered weekly performance coaching.

---

## ✨ Features

- **GitHub-Style Activity Grid**: Visual consistency heat map representing daily completion percentages (0%, 1–49%, 50–99%, 100%) across the entire month.
- **Daily Task Scheduling & Top 3 Commitments**: Plan tasks with target deadlines in IST (`Asia/Kolkata`), recurring cadences (daily, weekdays, weekly), and pin Top 3 Daily Priorities.
- **Habit Tracking & Streak Freezes**: Track daily habit streaks, toggle completions, and earn streak freeze protections to preserve momentum.
- **Focus Mode Pomodoro Timer**: Integrated deep work timer supporting Standard Pomodoro (25/5), Deep Focus (50/10), and Ultradian (90/15) intervals with audio chime synthesis and focus history logging.
- **Quick Notes Scratchpad**: Ephemeral scratchpad situated beneath the calendar for quick thoughts, timestamps, and review reminders for any selected date.
- **Spaced Repetition Engine**: Built-in memory retention schedule based on the Ebbinghaus forgetting curve (Day 0, 1, 3, 7, 14, 30) with due-revision tracking.
- **AI Productivity Coach**: Grounded weekly synthesis computing planned vs. completed rates, strongest performance windows, postponed tasks, and tactical recommendations with a built-in deterministic fallback engine.
- **Multi-User Authentication & Category Isolation**: Secure JWT authentication and bcrypt password hashing. New users start with a clean `Personal Learning` workspace, while custom categories (`SSC CGL`, `Technical`, `English`, `Health/Fitness`, etc.) remain fully isolated and preserved in MongoDB.
- **Vercel & Full-Stack Deployment Ready**: Express middleware in development and modular serverless handlers in `api/` for seamless deployment.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React, Recharts
- **Backend**: Node.js, Express, Mongoose (MongoDB Atlas), JSON Web Tokens (JWT), bcryptjs
- **Build & Dev**: Vite 6, tsx, esbuild
- **Timezone Support**: Asia/Kolkata (IST)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or higher recommended)
- MongoDB Atlas database cluster URI

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Akhilesh1118/HABIT_TASK_TRACKER.git
   cd HABIT_TASK_TRACKER
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root (reference `.env.example`):
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_unique_jwt_secret_at_least_16_chars
   INITIAL_ADMIN_EMAIL=akhileshyadav.nf@gmail.com
   INITIAL_ADMIN_PASSWORD=your_unique_admin_password_at_least_16_chars
   GEMINI_API_KEY=your_gemini_api_key_optional
   ```
   `JWT_SECRET` and `INITIAL_ADMIN_PASSWORD` must each be at least 16 characters in production. Do not deploy example or shared credentials.

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

---

## 📁 Project Structure

```
├── api/                  # Vercel serverless function entrypoints
│   ├── auth.ts           # Authentication handler
│   ├── tasks.ts          # Tasks CRUD endpoint
│   ├── habits.ts         # Habits and completion toggles
│   ├── focus.ts          # Focus sessions sync
│   ├── sync.ts           # Full state synchronization
│   ├── ai-coach.ts       # Weekly productivity coach
│   └── health.ts         # Health and IST clock status
├── server/               # Express backend application
│   ├── models/           # Mongoose schemas (User, Tasks, Habits, Focus, Categories)
│   ├── routes/           # Express router endpoints
│   ├── middleware/       # JWT auth & cookie verification
│   └── services/         # Business logic (Auth, Mongo, DB, AI Coach)
├── src/                  # React frontend application
│   ├── components/       # UI Components (ActivityGrid, TaskModal, FocusTimer, etc.)
│   ├── hooks/            # Custom hooks (useFocusTimer)
│   ├── services/         # Client-side storage and API service
│   ├── utils/            # Calendar, IST time, and audio utilities
│   └── types.ts          # Shared TypeScript type definitions
├── server.ts             # Main full-stack server entrypoint
└── vercel.json           # Serverless rewrite configuration
```

---

## 🔒 Security & Privacy

- Passwords hashed using bcrypt with salt rounds of 12.
- Session tokens signed with JWT (30-day expiry) passed via Authorization Bearer headers or HTTP-only cookies.
- Server-side rate limiting on authentication and AI Coach endpoints to mitigate brute force.
- Database credentials and API keys are strictly server-side and never exposed to client bundles.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
