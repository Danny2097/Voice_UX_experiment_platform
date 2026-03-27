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

### Default Credentials
The platform is secured by a researcher login. By default, use:
- **Username:** `Admin`
- **Password:** `Password`

To customize these, set the `ADMIN_USER` and `ADMIN_PASSWORD` environment variables in your `.env` file before running `docker compose up -d`.

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

**Terminal 2: Start the Standalone Local API**
```bash
cd local-api
node server.js
# REST API runs on http://localhost:3003
```

**Terminal 3: Start the web server**
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
- **Status** – Set to "Draft" while configuring, "Active" for data collection
- **Estimated Duration** – Help participants understand the time commitment

### Step 3: Local Data (Optional)
If you have a custom dataset:
1. Switch to the **Local Data** tab
2. Download the CSV template
3. Upload your populated CSV; the **Dataset name** will automatically be suggested based on your filename
4. This creates a local API endpoint for your experiment

### Step 4: Configure the API source
- **API endpoint** – Full URL to the REST API or your Local Data endpoint
- **Field mapping** – Map API response fields to grid display fields
- Click **Test Connection** to verify the data loads correctly

### Step 5: Configure the grid layout
- **Grid columns** – How many columns the card grid displays
- **Card style** – Choose from Modern, Brutalist, Nike, Etsy, and more
- **Interaction Styles** – Enable "Highlight on hover" and customize the border color/width
- **Display fields** – Toggle visibility of images, titles, subtitles, tags, and descriptions

### Step 6: Define the Workflow
Switch to the **Workflow** tab to set up the participant's task:
- **Task Prompt** – Enter the instructions shown at the top of the grid (e.g., "Find the red sneakers")
- **Card Sequence** – Enter a comma-separated list of card indices (e.g., `1, 4, 12`) to guide the researcher through the study.

### Step 7: Define Questionnaires (Optional)
Switch to the **Questionnaires** tab to add pre- and post-study questions:
- **Pre-Experiment** questions are shown after consent but before the participant sees the grid.
- **Post-Experiment** questions are shown after the session ends but before the final thank you.
- Choose from **Text**, **Linear Scale**, or **Multiple Choice** types.

### Step 8: Participant Information Sheet (PIS)
Add any fields you need to collect (Age, Gender, etc.) and customize the study purpose and withdrawal information.

### Step 9: Run the experiment
1. Switch to the **Run** tab
2. Use **High-Fidelity Preview** to test the flow yourself (this mirrors the participant's experience exactly but doesn't save data)
3. Use the **Participants** tab to launch live sessions for real users.

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

### High-Fidelity Preview vs. Live Session
The platform offers two ways to run your experiment:

1.  **High-Fidelity Preview:** Located in the **Run** tab. This allows you to experience the study exactly as a participant would, including the consent screen and session-end flow. It is useful for verifying your layout, workflow, and API connection. **Data is not saved to the database** in this mode.
2.  **Live Session:** Managed through the **Participants** tab. Each session is unique to a participant and **all data is saved** to the persistent database for later export.

### Consent and Questionnaire flow
When a participant (or researcher in preview) begins a session, they see:
1.  **Consent Screen**: Displaying study overview and PIS fields.
2.  **Pre-Experiment Questionnaire**: (If configured) Participants answer demographic or initial survey questions. **The experiment grid is only loaded after this step is complete.**
3.  **Active Session**: The main task grid with voice and researcher controls.
4.  **Post-Experiment Questionnaire**: (If configured) Shown after the session is ended to capture participant feedback.
5.  **Session End**: Final thank-you screen with participation ID.

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

### Workflow-Aware Logging
The platform automatically relates participant actions to the researcher's defined workflow:
- **Highlighted Card ID**: Every event (click, voice query, search) and transcript entry is automatically tagged with the ID of the card currently highlighted in the researcher's workflow.
- **Transcript Context**: Exported transcripts include the target card ID for each utterance, making it easy to identify which item a participant was responding to.

### Grid interaction logging
Every interaction is logged automatically:
- Card selection (time, card ID, method: voice/click, and currently highlighted workflow card)
- Workflow advancement (step number, target card ID)
- Microphone state changes
- Errors or API timeouts
- Participant voice transcripts (including target card context)

### Features for Researchers
- **Workflow Autoscroll:** When advancing a step, the target card is automatically scrolled into the center of the viewport and highlighted with a pulsing border.
- **Preview Parity:** High-fidelity preview mode now uses the exact same consent and session flow as participant experiments.
- **Dataset Auto-naming:** Uploaded CSV files now automatically suggest a dataset name based on the filename.

### Ending a session
1. Click the **End Session** button in the researcher panel
2. Review the final notes
3. Choose **Download Data** to export the session
4. The browser returns to the Experiment Manager

---

## Data & Exports

### Persistent Storage
The platform uses a PostgreSQL database for persistent storage. This ensures that experiment configurations, participant records, and session interaction logs are safely stored on the server.

### Exporting data
From the Experiment Manager:
1. Click an experiment row to expand details.
2. Select the **Export** tab to download bulk data:
   - **JSON Export**: Contains all session events, full transcripts, and all questionnaire responses.
   - **Summary CSV**: Provides a high-level overview of sessions, including participation status and the count of completed pre- and post-questionnaire items.
   - **Audio Export**: Downloads a ZIP archive of all voice recordings for the experiment.
3. Select the **Participants** tab for individual session JSON downloads.

### Questionnaire Data
All questionnaire responses (text, scale, and choice) are stored within the session data object and are exported in the `questionnaires` field of the JSON export. Summary counts are included in the CSV export.

---

## Researcher Control Panel Reference

The right sidebar (toggle with **≡ Menu**) provides researcher-facing controls:

| Control | Description |
|---------|-------------|
| **Microphone toggle** | Enable or disable the participant's microphone. Use this to prevent accidental activations. |
| **Recording toggle** | Record voice transcripts alongside interaction logs. Disable if not using voice or to save storage. |
| **Log level** | Verbose (all events), Normal (key events only), or Silent (minimal logging). Useful for reducing noise in the debug output. |
| **Task prompt** | Display a custom instruction or reminder to the participant (e.g., "Find a landscape painting"). Updates in real time. |
| **Workflow Controls** | Advance through the pre-defined card sequence. The platform will automatically scroll to and highlight the current target card. |
| **Notes** | Free-text field for researcher observations. Saved with the session. |
| **Researcher Shortcuts** | Use **Alt+N** to advance to the next workflow step and **Alt+R** to reset the workflow. |
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

