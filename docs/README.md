# Voice Control Research Platform

## Overview

The Voice Control Research Platform is a browser-based, modular tool designed for researchers conducting user studies involving voice-controlled grid interfaces. Built for simplicity and portability, it allows you to create voice-driven experiments, manage participants, configure external data sources via REST APIs, and collect rich interaction logs—all without requiring backend infrastructure or technical expertise. The platform prioritises researcher control, data privacy (all data remains local), and offline-first operation.

---

## Quick Start — Docker (Recommended)

Docker provides the simplest setup, handling both the CORS proxy and frontend server automatically.

### Prerequisites
- Docker and Docker Compose installed

### Getting started

```bash
git clone <repository-url>
cd platform
docker compose up -d
```

Open your browser to **http://localhost:8080**

To stop:
```bash
docker compose down
```

View logs:
```bash
docker compose logs -f
```

---

## Quick Start — Local (No Docker)

If you prefer to run without Docker, follow these steps.

### Prerequisites
- Node.js (v14 or later)
- A modern browser
- A local web server (e.g., `live-server`)

### Getting started

**Terminal 1: Start the CORS proxy**
```bash
cd proxy
node server.js
# Proxy runs on http://localhost:3001
```

**Terminal 2: Start the web server**
```bash
cd platform
npx live-server --port=8080
# Opens http://localhost:8080 automatically
```

### Important notes
- The microphone requires HTTPS or localhost. The local setup uses localhost, which is permitted.
- The proxy must be running for API connections to work.
- If you use a different port for the web server, update the proxy configuration accordingly.

---

## Creating Your First Experiment

Follow these steps to set up and run an experiment.

### Step 1: Create a new experiment
1. Open the Experiment Manager (http://localhost:8080)
2. Click **+ New Experiment** in the top-left corner
3. You'll see the Experiment Configuration panel

### Step 2: Overview section
Fill in:
- **Experiment name** – e.g., "Museum Search Task Study"
- **Description** – Brief summary of what participants will do
- **Researcher name** – Your name or team identifier

### Step 3: Participant Information Sheet (PIS)
Add any fields you need to collect:
- **Standard fields** (e.g., Age, Gender, Profession) are provided
- **Custom fields** – Add bespoke questions for your study (e.g., "Prior voice assistant use?")
- Participants will see these fields when consenting to the study
- All responses are stored with the session data

### Step 4: Configure the grid
- **Grid columns** – How many columns the card grid displays (typically 4–6)
- **Card height** – Height of each card in pixels (typically 150–250)
- **Display fields** – Which data fields to show on each card (e.g., title, image, description)
- **Sort/filter** – Optional; add rules to pre-filter or sort the dataset

### Step 5: Configure the API source
- **API endpoint** – Full URL to the REST API (e.g., `https://api.example.com/v1/items`)
- **Field mapping** – Map API response fields to grid display fields
  - Example: `{ "title": "name", "subtitle": "artist", "image": "imageUrl" }`
- See "Connecting a data source" (below) for detailed instructions

### Step 6: Test the connection
- Click **Test Connection** to verify the API responds and the field mapping works
- Debug errors in the browser console or the researcher panel

### Step 7: Run the experiment
1. Switch to the **Participants** tab
2. Click **Run Experiment** next to a participant row
3. The Experiment Runner opens in a new window

---

## Connecting a Data Source

The platform supports any REST API that returns JSON. Use the API adapter contract to integrate your data source.

### API adapter contract

Your API endpoint must return a JSON array or an object with an array property. For example:

```json
{
  "items": [
    {
      "id": "123",
      "title": "Mona Lisa",
      "artist": "Leonardo da Vinci",
      "year": 1503,
      "imageUrl": "https://example.com/mona-lisa.jpg"
    },
    {
      "id": "124",
      "title": "Starry Night",
      "artist": "Vincent van Gogh",
      "year": 1889,
      "imageUrl": "https://example.com/starry-night.jpg"
    }
  ]
}
```

### Configuration JSON structure

```json
{
  "endpoint": "https://api.example.com/v1/items",
  "dataPath": "items",
  "fieldMapping": {
    "title": "title",
    "subtitle": "artist",
    "description": "year",
    "image": "imageUrl",
    "id": "id"
  }
}
```

**Parameters:**
- **endpoint** – The full URL to the API endpoint
- **dataPath** – If the array is nested, specify the path (e.g., `"data.items"`). Leave blank if the response is a top-level array.
- **fieldMapping** – Map each display field to an API response field. Required fields: `id`, `title`. Optional: `subtitle`, `description`, `image`.

### Example 1: V&A Museum API

The V&A provides a public collection API. Use this configuration:

```json
{
  "endpoint": "https://api.vam.ac.uk/v2/objects?page=1&page_size=20",
  "dataPath": "records",
  "fieldMapping": {
    "id": "_id",
    "title": "title",
    "subtitle": "artistMakerPerson[0].name",
    "description": "date_text",
    "image": "images[0].image_url"
  }
}
```

See `adapters/vam.example.js` in the repository for a fully annotated, production-ready adapter.

### Example 2: Open Library API

The Open Library provides free book data. Use this configuration:

```json
{
  "endpoint": "https://openlibrary.org/search.json?title=science&limit=20",
  "dataPath": "docs",
  "fieldMapping": {
    "id": "key",
    "title": "title",
    "subtitle": "author_name[0]",
    "description": "first_publish_year",
    "image": "cover_id"
  }
}
```

### Testing your configuration

1. In the Experiment Configuration panel, paste your JSON into the API source field
2. Click **Test Connection**
3. Check the browser console for errors
4. In the researcher panel during a session, use the **Debug** tab to inspect API responses

---

## Running an Experiment

### Consent flow
When a participant begins a session, they see:
1. A consent screen displaying:
   - Experiment overview
   - All Participant Information Sheet fields
2. Participant must enter their details and click "I agree"
3. Their responses are stored with the session data

### The session interface

The Experiment Runner provides:
- **Grid area** (centre) – Voice-controlled card grid; click a card to select it
- **Microphone button** (bottom-left) – Click to start listening; the platform transcribes speech
- **Researcher panel** (right sidebar, toggle with **≡ Menu**):
  - Microphone toggle (enable/disable)
  - Recording toggle (voice logging on/off)
  - Log level (Verbose/Normal/Silent)
  - Task prompt – Display a custom instruction to the participant
  - Notes – Researcher observations (stored with session)
  - Debug terminal – Real-time API calls, mic activity, grid interactions

### Grid interaction logging
Every interaction is logged automatically:
- Card selection (time, card ID, method: voice/click)
- Microphone state changes
- Errors or API timeouts
- Participant voice transcripts (if enabled)

### Ending a session
1. Click the **End Session** button in the researcher panel
2. Review the final notes
3. Choose **Download Data** to export the session
4. The browser returns to the Experiment Manager

---

## Data & Exports

### Local storage

All experiments and session data are stored in the browser's `localStorage`:

- **`vrp_experiments`** – Experiment configurations (JSON array)
- **`vrp_sessions`** – Session recordings (JSON array, one object per session)

You can inspect these in the browser DevTools (F12 > Application > Local Storage).

### Exporting data

From the Experiment Manager:
1. Click an experiment row to expand details
2. Click **Download as JSON** or **Download as CSV** for each session

### JSON export format

```json
{
  "sessionId": "sess_abc123",
  "experimentId": "exp_def456",
  "startTime": "2026-03-06T14:30:00Z",
  "endTime": "2026-03-06T14:45:00Z",
  "participantInfo": {
    "name": "Alice Smith",
    "age": 28,
    "profession": "Librarian",
    "customField": "Yes"
  },
  "interactions": [
    {
      "timestamp": "2026-03-06T14:30:15Z",
      "type": "cardSelected",
      "method": "voice",
      "cardId": "123",
      "cardTitle": "Mona Lisa"
    },
    {
      "timestamp": "2026-03-06T14:30:20Z",
      "type": "microphoneToggle",
      "state": "on"
    }
  ],
  "researcherNotes": "Participant found the task straightforward.",
  "rawTranscripts": [
    {
      "timestamp": "2026-03-06T14:30:10Z",
      "transcript": "show me paintings by da vinci"
    }
  ]
}
```

### CSV export format

Columns include:
- `sessionId`, `experimentId`, `startTime`, `endTime`
- All Participant Information Sheet fields
- Card selection events (one row per selection)
- Microphone state changes
- Researcher notes

**Important:** Clearing your browser's localStorage or cache will permanently delete all data. Export your data regularly.

---

## Researcher Control Panel Reference

The right sidebar (toggle with **≡ Menu**) provides researcher-facing controls:

| Control | Description |
|---------|-------------|
| **Microphone toggle** | Enable or disable the participant's microphone. Use this to prevent accidental activations. |
| **Recording toggle** | Record voice transcripts alongside interaction logs. Disable if not using voice or to save storage. |
| **Log level** | Verbose (all events), Normal (key events only), or Silent (minimal logging). Useful for reducing noise in the debug output. |
| **Task prompt** | Display a custom instruction or reminder to the participant (e.g., "Find a landscape painting"). Updates in real time. |
| **Notes** | Free-text field for researcher observations. Saved with the session. |
| **Debug terminal** | Real-time event log showing API calls, microphone activity, grid selections, and errors. Use to troubleshoot during a session. |

---

## Writing a Custom API Adapter

### Minimum requirements

An adapter is a JavaScript object with this structure:

```javascript
const myAdapter = {
  name: "My API",
  async fetch(config) {
    const response = await fetch(config.endpoint);
    const data = await response.json();
    // Return an array of items, each with id, title, and other fields
    return data.items || data;
  },
  validateConfig(config) {
    // Return true if config.endpoint is valid, false otherwise
    return config.endpoint && config.endpoint.startsWith("https://");
  }
};
```

### Full annotated template

See `adapters/vam.example.js` in the repository. It includes:
- Error handling
- Nested field mapping (e.g., `artist.name`)
- Pagination handling
- Field transformation (e.g., image URL construction)
- Comments explaining each function

### Registering an adapter

In `js/api-adapter.js`, add your adapter to the registry:

```javascript
apiapiAdapterRegistry.register("myAPI", myAdapter);
```

Then, in the Experiment Configuration panel, select your adapter from the "API source" dropdown.

---

## Docker Reference

### Common commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start the platform in the background |
| `docker compose down` | Stop and remove containers |
| `docker compose logs -f` | Stream logs from both services (Ctrl+C to exit) |
| `docker compose ps` | Show running containers |
| `docker compose exec nginx /bin/sh` | Open a shell inside the nginx container |

### Port mapping

- **Host port 8080** → Container port 80 (nginx)
- **Container port 3001** → CORS proxy (internal)
- Change the host port in `docker-compose.yml` if 8080 is in use on your machine

### Services

- **nginx** – Serves static files (HTML, CSS, JS) and proxies API calls to the Node proxy
- **Node proxy** – CORS proxy; listens on port 3001 internally, exposed via nginx at `/proxy/`

---

## Architecture

```
Browser (http://localhost:8080)
          │
       [nginx]
       /      \
      /        \
  Static     /proxy/*
   Files       │
(HTML, CSS,   [Node.js CORS Proxy]
 JS)             │
             External APIs
          (Museum, Library, etc.)
```

**Why this architecture?**

- **nginx** – Lightweight, battle-tested, handles static files and routing efficiently
- **Node.js CORS proxy** – Standalone service; no framework overhead; easy to scale or replace
- **No framework** (React, Vue, etc.) – Keeps the platform portable; runs in any modern browser without a build step; suitable for offline or air-gapped deployments
- **localStorage** – Offline-first design; data persists between sessions; no backend database needed

---

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome / Chromium | Recommended | Best Web Speech API support; most tested |
| Edge | Recommended | Chromium-based; same support as Chrome |
| Firefox | Supported | Web Speech API may require `media.webspeech.recognition.enable` flag |
| Safari | Limited | Web Speech API not fully supported; grid interactions work, voice control limited |

### Microphone requirements

- **HTTPS** or **localhost** only (browser security restriction)
- User must grant microphone permission when prompted
- Microphone input is processed locally; no audio is sent to external servers unless a custom adapter requests it

---

## Privacy & Ethics

**Data location:** All experiment configurations, session recordings, and interaction logs are stored in your browser's localStorage. No data is sent to external servers except:
1. API calls to your configured data source (e.g., Museum API)
2. Optional custom adapters you write

**No telemetry:** The platform does not collect usage statistics, error reports, or any other telemetry.

**Researcher responsibility:** You are responsible for:
- Obtaining ethical approval from your institution
- Obtaining informed consent from participants (the Participant Information Sheet is a framework; customise it for your study)
- Complying with data protection laws (GDPR, CCPA, etc.)
- Securely storing exported session data
- Deleting session data after the research period ends

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Microphone not working** | 1. Ensure you're on HTTPS or localhost. 2. Check browser permissions (DevTools > Security tab). 3. Try a different browser. |
| **"No data from API" error** | 1. Test the API endpoint directly in your browser address bar. 2. Check the field mapping in the API source config. 3. Click "Test Connection" in the Experiment Config. 4. Inspect the Debug terminal during a session. |
| **"CORS error" in browser console** | 1. Ensure the Node.js proxy is running (`cd proxy && node server.js`). 2. Check that nginx is proxying `/proxy/*` correctly. 3. View proxy logs with `docker compose logs -f proxy`. |
| **Session data disappears after browser reload** | Session data is stored in localStorage. Check browser cache settings or privacy mode (incognito). Disable "Clear data on exit" in browser settings. Export data regularly. |
| **Docker port 8080 already in use** | Change the host port in `docker-compose.yml`: change `"8080:80"` to `"8081:80"`, then open http://localhost:8081. |
| **Proxy returns 502 Bad Gateway** | The Node.js proxy has crashed. Run `docker compose logs -f proxy` and check for errors. Restart: `docker compose restart proxy`. |
| **Field mapping showing nested fields incorrectly** | Use dot notation: `"subtitle": "artist.name"` or `"image": "images[0].url"`. Test with "Test Connection". |

---

## Support & Further Reading

- **Report bugs or request features:** Create an issue in the repository
- **API documentation:** Consult the documentation of your chosen data source (e.g., [V&A Collections API](https://www.vam.ac.uk/api), [Open Library API](https://openlibrary.org/developers))
- **Web Speech API:** [Mozilla Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- **localStorage limits:** Typically 5–10 MB per origin; export data if approaching limit

---

## Version

Platform version: 1.0.0  
Last updated: 6 March 2026

