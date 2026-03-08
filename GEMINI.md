# Voice Control Research Platform

## Project Overview

The Voice Control Research Platform is a browser-based, modular tool designed for researchers conducting user studies involving voice-controlled grid interfaces. It allows for the creation of voice-driven experiments, participant management, configuration of external data sources via REST APIs, and collection of rich interaction logs. 

The architecture consists of:
- **Frontend**: A vanilla HTML, CSS, and JavaScript interface served without a build step, maintaining portability. It uses the Web Speech API for voice interactions.
- **API Server**: A Node.js backend (in `api/`) utilizing a PostgreSQL database for persistent storage of experiments, sessions, participants, and audio recordings.
- **Proxy Server**: A separate Node.js service (in `proxy/`) that handles CORS issues when querying external REST APIs (e.g., Museum APIs).
- **Gateway**: Nginx routes static traffic and API requests locally in a Dockerized setup.

## Building and Running

### Using Docker (Recommended)

The platform is designed to be easily deployed via Docker Compose, which sets up the database, API, Proxy, and frontend web server.

- **Start the platform**: `docker compose up -d`
- **Access the application**: Open `http://localhost:8080` in a modern browser.
- **Stop the platform**: `docker compose down`
- **View logs**: `docker compose logs -f`

**Note:** Ensure your `.env` file is properly configured based on `.env.example` to set up initial admin credentials and database settings.

### Local Development (Without Docker)

You can run the components individually:
1. **Start the API Server**: `cd api && npm install && node server.js` (requires a running PostgreSQL instance specified by env vars).
2. **Start the Proxy**: `cd proxy && npm install && node server.js`
3. **Start the Frontend**: Run a local static server in the project root, for example: `npx live-server --port=8080`

*Microphone access requires serving over `https://` or `localhost`.*

## Development Conventions

- **Frontend**: The UI is built without frameworks like React or Vue to keep it simple and portable. Functionality is spread across standard `.html` files (`index.html`, `experiment.html`) and scripts in the `js/` directory.
- **API Adapters**: Custom REST API integrations are managed via a strict adapter contract (see `adapters/` directory). An adapter must expose `name`, `fetch(config)`, and `validateConfig(config)` properties and be registered in `js/api-adapter.js`.
- **Database Schema**: The database schema is defined in `api/schema.sql` and is designed to be safely applied repeatedly (`IF NOT EXISTS` / `ON CONFLICT`).
- **Privacy First**: The project enforces strict data privacy; no telemetry is collected, and all data operations are strictly under researcher control. Session transcripts and events are intended to be exported and managed locally.