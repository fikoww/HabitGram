# HabitGram

> A habit-tracking and social accountability app for people to build routines and grow together.

---

## Motivation

Staying consistent with personal goals is hard when you're doing it alone. Nowadays, most productivity tools are built for solo use, while social platforms are built for entertainment. HabitGram bridges that gap by combining habit tracking with social accountability — users post real proof of their habits, build streaks, and stay motivated through interest-based communities.

---

## Aim

Build a mobile platform that helps people:

- Commit to and track habits consistently
- Build streaks tied to each individual habit
- Share progress through posts (photo/video) with privacy controls
- Stay accountable through habit-based communities

---

## App Flow

### 1. Sign Up
User creates an account with **email and password**, then is immediately asked to **choose habits they want to commit to** from a curated list.

### 2. Profile Setup
After selecting habits, the user sets up their public profile (that also can be edited any time):

| Field | Description |
|---|---|
| Name | Display name visible to others |
| Profile Photo | Avatar shown on posts and profile |
| Bio | A short "share something about yourself" |
| Committed Habits | List of habits the user has chosen — visible publicly |

### 3. Habit Streaks
Each habit has its own streak. There are **2 types of streaks**:

| Streak Type | Description |
|---|---|
| **Consistency** (purple fire) | User sets a frequency (daily, every 3 days, or weekly). Streak counts how many consecutive periods the habit was completed. |
| **Just Do It** (red fire) | No set frequency. Streak count = total number of times the habit has been done. |

### 4. Logging a Habit (Posts)
Every time a user completes a habit, they **must post a photo or video** as proof. This post goes to the main feed and updates their streak.

### 5. Account Privacy
Users choose one of two account types:

| Account Type | Who Can See Posts |
|---|---|
| **Private** | Only accepted followers |
| **Public** | Anyone can search the user's name and view all their posts |

### 6. Interest-Based Communities
Each habit has its own community. When a user commits to a habit, they are automatically added to that habit's community, where they can see posts from other members doing the same habit.

---

## Features

### Core Features

| Feature | Description |
|---|---|
| Authentication | Sign up with email and password |
| Habit Selection (Onboarding) | Choose from a curated list of habits upon first sign up |
| Profile Setup | Set name, photo, bio, and committed habits (publicly visible) |
| Streak Tracking — Consistency | Per-habit streak based on a chosen frequency (daily / every 3 days / weekly) |
| Streak Tracking — Just Do It | Per-habit streak that counts total completions with no set frequency |
| Habit Posts | Log a habit by posting a photo or video to the main feed |
| Account Privacy | Choose between private (followers only) or public (searchable) account |
| Interest-Based Communities | Auto-join a community for each habit you commit to |

### Extension Features

| Feature | Description |
|---|---|
| Reminders & Notifications | Get reminded to complete habits based on your chosen frequency |
| Community Interaction | Like, comment, and react to posts within habit communities |
| Follower System | Send/accept follow requests for private accounts |

---

## User Stories

1. **New user onboarding** — After signing up, I am shown a list of habits to choose from so I can immediately start committing to goals I care about.
2. **Profile builder** — I can set up a public profile with my name, photo, bio, and the habits I am committing to, so others can find and follow me.
3. **Consistency tracker** — I can set a frequency (daily, every 3 days, weekly) for a habit and track my streak based on how consistently I complete it.
4. **Casual tracker** — I can use "Just Do It" mode for habits where I just want to count how many times I've done it, without pressure of a schedule.
5. **Habit logger** — Every time I complete a habit, I post a photo or video as proof, which updates my streak and appears on my feed.
6. **Private user** — I can set my account to private so only people I accept can see my posts.
7. **Public user** — I can set my account to public so anyone can search my name and see my habit posts.
8. **Community member** — I am automatically part of a community for each habit I commit to, where I can see how others are progressing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native with Expo |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Storage | Firebase Storage (photos/videos) |
| Version Control | GitHub |
| Design | Figma |

---

## Project Structure

```
habitgram/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── habit-selection.tsx       # Onboarding: pick habits
│   ├── (tabs)/
│   │   ├── feed.tsx                  # Main post feed
│   │   ├── communities.tsx           # Habit-based communities
│   │   └── profile.tsx               # Public profile page
│   └── _layout.tsx
├── components/
│   ├── HabitCard.tsx                 # Habit display with streak info
│   ├── StreakBadge.tsx               # Consistency or Just Do It badge
│   ├── PostCard.tsx                  # Photo/video habit post
│   └── CommunityFeed.tsx             # Feed for a specific habit community
├── firebase/
│   ├── config.ts
│   ├── auth.ts
│   ├── firestore.ts
│   └── storage.ts
├── assets/
│   └── images/
├── app.json
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- Firebase project set up

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/habitgram.git
   cd habitgram
   ```

<<<<<<< Updated upstream
=======
2. Install dependencies:
   ```bash
   npm install
   ```
>>>>>>> Stashed changes

3. Set up Firebase config in `firebase/config.ts`:
   ```ts
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

4. Start the development server:
   ```bash
   npx expo start
   ```

---

## Milestone Progress

### Milestone 1 — Technical Proof of Concept ✅

- [x] Firebase Authentication (sign up, login, logout)
- [x] Basic habit tracking UI (add, complete, undo habits)
- [x] Home and Explore navigation
- [x] Connected to Cloud Firestore

### Milestone 2 — Core Prototype 🔄

- [ ] Habit selection onboarding screen
- [ ] Profile setup (name, photo, bio, committed habits)
- [ ] Streak tracking (Consistency + Just Do It types)
- [ ] Habit post logging with photo/video upload
- [ ] Private/public account toggle
- [ ] Interest-based community feeds

### Milestone 3 — Extended System 📋

- [ ] Follower system with follow requests
- [ ] Reminders and weekly recaps
- [ ] Progress analytics
- [ ] Community interaction (likes, comments)

---

## NUS Orbital 2026

**Proposed Level of Achievement:** Apollo 11

trying git diff
test
test
tkrktr