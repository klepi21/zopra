# ZOPRA (Όνομα, Ζώο, Πράγμα)

A modern, fast-paced, and highly competitive mobile adaptation of the classic Greek game "Όνομα, Ζώο, Πράγμα". Built with React Native (Expo) and Supabase.

## 🚀 Features
- **Real-Time Multiplayer:** Create private rooms, share a 6-digit code with friends, and play in real-time.
- **Global Leaderboard:** Compete against players worldwide based on your Win Rate and Total Points.
- **Smart Scoring & Validation:** Fast, backend-powered scoring that checks word uniqueness and validity in real-time.
- **Custom Profiles:** Choose from a wide selection of beautiful avatars and customize your username.
- **Sleek Dark Mode UI:** Designed with premium aesthetics, subtle micro-animations, and vibrant color highlights.

## 🛠 Tech Stack
- **Frontend:** React Native, Expo, React Navigation, Zustand (State Management)
- **Backend:** Node.js, Express, Socket.IO
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Clerk
- **Monetization:** Google AdMob

## 📱 Running the App (Development)

This project requires a native build environment due to custom native dependencies (Google Mobile Ads SDK). **It will not run in the standard Expo Go app.**

### Prerequisites
- Node.js (>= 20)
- npm or yarn
- macOS with Xcode installed (for iOS development)

### Steps
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build and run on the iOS Simulator:
   ```bash
   npx expo run:ios
   ```

## 📜 Legal
By using this application, you agree to our [Terms and Conditions](TERMS.md) and [Privacy Policy](PRIVACY.md).
