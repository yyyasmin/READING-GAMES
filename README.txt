============================================================
ONE ROOT: one backend + PostgreSQL, two separate projects
============================================================

Target layout (after you move):

  ndfa-games-root/
    backend/                  <- one Flask + Postgres backend (app.py)
    ndfa-memory-match-game/   <- NDFA frontend only
    math-english-games/       <- MATH-ENGLISH-GAMES frontend
    docs.txt                  <- how to run everything

------------------------------------------------------------
Steps to create this layout (do once)
------------------------------------------------------------

1. Create the root folder (if not exists):
   ...\yasmin\ndfa-games-root

2. Move the backend into the root:
   - Cut folder:  NDFA-MEMORY-MATCH-GAME\backend
   - Paste into:  ndfa-games-root\backend

3. Move NDFA frontend into the root:
   - In NDFA-MEMORY-MATCH-GAME (what remains), you have frontend
     files: package.json, src/, index.html, vite.config.js,
     public/, .env.example, etc.
   - Create folder: ndfa-games-root\ndfa-memory-match-game
   - Move those frontend files (and node_modules if you want)
     into ndfa-games-root\ndfa-memory-match-game
   - Do NOT move the backend folder (you already moved it in step 2)

4. Move MATH-ENGLISH-GAMES into the root:
   - Cut folder:  ...\yasmin\MATH-ENGLISH-GAMES
   - Paste into:  ndfa-games-root\math-english-games

5. Copy docs.txt into the root (or use the one in this folder).

------------------------------------------------------------
After the move
------------------------------------------------------------

- Run backend once:  cd ndfa-games-root\backend, then setup.bat, then python app.py
- Run NDFA frontend:  cd ndfa-games-root\ndfa-memory-match-game, npm install, npm start
- Run MATH-ENGLISH frontend:  cd ndfa-games-root\math-english-games, npm install, npm start

Both frontends use the same backend (same API, same Postgres DB).

============================================================
