# SplitSmart

SplitSmart is a Splitwise-inspired expense splitting application built with Next.js 16, Convex, and Clerk. It features a Smart CSV Import Engine for messy data, real-time expense chats, and AI-powered plain-English balance explanations.

## 📄 Assignment Documentation

| File | Description |
|---|---|
| [SCOPE.md](./SCOPE.md) | Anomaly log — every CSV data problem detected and how it is handled; full DB schema |
| [DECISIONS.md](./DECISIONS.md) | Decision log — every significant architecture/design choice with options considered |
| [IMPORT_REPORT.md](./IMPORT_REPORT.md) | Import report format — what the app produces when ingesting a CSV |
| [AI_USAGE.md](./AI_USAGE.md) | AI tools used, key prompts, and 3 concrete cases where AI was wrong and corrected |


## 🚀 AI Integration

SplitSmart leverages the power of **Google Gemini 2.5 Flash** (via the `@google/generative-ai` SDK) to provide intelligent, plain-English summaries of group balances and settlements. This feature allows users to quickly understand exactly who owes what, and why, without manually calculating complex debt graphs.

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database / Real-time Backend:** Convex
- **Authentication:** Clerk
- **AI / LLM:** Google Gemini 2.5 Flash
- **Styling:** Tailwind CSS & shadcn/ui
- **CSV Parsing:** Papaparse

## 📦 Setup Instructions

Follow these instructions to run the application locally on your machine.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed along with `pnpm` as your package manager.

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root of your project and add the following keys. You will need to obtain these from their respective platforms:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex Real-time Backend
# Note: When you run `npx convex dev`, it will automatically configure your convex credentials
CONVEX_DEPLOYMENT=your_convex_deployment
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# Google Gemini API (For AI Summaries)
GEMINI_API_KEY=your_google_gemini_api_key
```

### 3. Start the Convex Backend
Run the Convex development server. This will sync your `convex/schema.ts` and start the backend:
```bash
pnpm dlx convex dev
```

### 4. Start the Next.js Frontend
In a new terminal window, start your local development server:
```bash
pnpm dev
```

The application should now be running locally at [http://localhost:3000](http://localhost:3000).
