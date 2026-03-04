<div align="center">
  <h1>🗡️ Avalon Remote Engine</h1>
  <p>A real-time multiplayer web implementation of the classic social deduction game <b>The Resistance: Avalon</b>, featuring advanced AI bots, internationalization, and a modern UI.</p>
</div>

---

## ✨ Features

*   **Real-time Multiplayer:** Seamless, low-latency gameplay using WebSockets (`socket.io`), allowing players to join rooms, vote on teams, and go on quests in real time.
*   **Advanced AI Bots (Normal & Hard Modes):** Play solo or fill empty seats with highly intelligent bots. 
    *   *Vote Pattern Analysis:* Bots learn from how players vote on teams.
    *   *Quest-History Team Building:* Bots remember who was on failed quests and adjusts trust accordingly.
    *   *Smarter Assassin & Percival:* Specialized reasoning logic for critical roles based on behavioral scoring.
    *   *Strategic Evil Play:* Evil bots coordinate votes to sabotage quests without exposing themselves.
*   **Internationalization (i18n):** Full support for English and Simplified Chinese (简体中文). 
*   **Authentication & Profiles:** Secure player authentication and stat tracking powered by Supabase.
*   **Modern Interactive UI:** Beautiful, responsive design built with React, TailwindCSS, and Lucide icons.

## 🛠️ Tech Stack

*   **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand (State Management)
*   **Backend:** Node.js, Express, Socket.io
*   **Database & Auth:** Supabase
*   **Deployment:** Designed to be easily deployed on platforms like Railway, Render, or Vercel.

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher recommended)
*   A [Supabase](https://supabase.com/) account and project (for authentication and database)

### Installation

1.  **Clone the repository**
2.  **Install dependencies**
    ```bash
    npm install
    ```
3.  **Environment Variables**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Run the development environment**
    This will start both the Vite frontend server and the Node.js WebSocket backend.
    ```bash
    npm run dev
    ```

## 🎮 How to Play

1.  Create an account or log in via the web interface.
2.  Create a new room and share the Room Code with your friends.
3.  If you don't have enough players (requires 5 for a game), click "Add Bot" to fill the remaining seats. You can choose between **Normal Bot** and **Hard Bot**.
4.  Once the room is filled (5-10 players), the host can start the game.
5.  Roles are secretly assigned. Discuss, deduce, and vote to determine the fate of Arthur's realm!

---
*Built for fans of Avalon who want a premium, intelligent, and seamless remote playing experience.*
