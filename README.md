# ABES Engineering College FAQ Chatbot

A Retrieval-Augmented Generation (RAG) chatbot that answers frequently asked questions about ABES Engineering College, Ghaziabad (courses, fees, placements, contact details and more). Answers come only from official ABES sources: selected pages of the college website and its Mandatory Disclosure PDF. Every answer shows a **Sources** list.

## Tech stack

| Layer | Tool | Purpose |
|---|---|---|
| Frontend | Next.js (React, TypeScript) | Chat interface and `/api/chat` route |
| Backend | FastAPI (Python) | Retrieval and answer generation API |
| Embeddings | Google Gemini `gemini-embedding-001` (3072 dimensions) | Turns text and questions into vectors |
| Vector database | DataStax Astra DB (cosine similarity) | Stores and searches document chunks |
| Generation | Google Gemini | Writes the answer from the retrieved chunks |
| Ingestion | `scripts/loadDb.ts` (Puppeteer, LangChain, pdf-parse) | Builds the knowledge base |

## How it works

```
User
  ↓
Next.js chat interface
  ↓
Next.js /api/chat
  ↓
FastAPI backend (POST /api/chat)
  ↓
Gemini embedding of the question
  ↓
Astra DB vector search
  ↓
Most relevant document chunks
  ↓
Gemini generates the answer from those chunks
  ↓
Answer + Sources shown to the user
```

**Building the knowledge base (one time):** `scripts/loadDb.ts` scrapes six ABES web pages (home, courses, contact, placement, life@ABES, fee structure) and reads `data/mandatory-disclosure.pdf`. The text is split into chunks (1500 characters, 150 overlap), each chunk is embedded with Gemini and stored in Astra DB with the fields `$vector`, `text` and `source`.

**Answering a question (every time):** the backend embeds the question, finds the closest chunks in Astra DB, and asks Gemini to answer using only those chunks. The source of each chunk is returned so the interface can list it.

## Project structure

```
abes-faq-bot/
├── app/                      Next.js pages and the /api/chat route
├── backend/
│   ├── app/
│   │   ├── main.py           FastAPI application
│   │   ├── core/config.py    Settings and environment variables
│   │   ├── repositories/     Astra DB vector search
│   │   ├── services/         Embedding and generation
│   │   └── schemas/          Request and response models
│   ├── tests/
│   └── requirements.txt
├── data/
│   └── mandatory-disclosure.pdf
├── docs/                     Project documentation
├── public/
├── scripts/
│   └── loadDb.ts             Knowledge-base ingestion script
└── package.json
```

## Prerequisites

- Node.js 18 or newer
- Python 3.10 or newer
- A Google Gemini API key
- A DataStax Astra DB database (free tier is enough)

## Environment variables

Create a file named `.env.local` in the project root. Do not commit it.

```
GEMINI_API_KEY=
ASTRA_DB_API_ENDPOINT=
ASTRA_DB_APPLICATION_TOKEN=
ASTRA_DB_NAMESPACE=
ASTRA_DB_COLLECTION=
```

| Variable | Meaning |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (embeddings and answers) |
| `ASTRA_DB_API_ENDPOINT` | Data API endpoint of your Astra database |
| `ASTRA_DB_APPLICATION_TOKEN` | Astra application token |
| `ASTRA_DB_NAMESPACE` | Keyspace name in Astra DB |
| `ASTRA_DB_COLLECTION` | Collection that stores the document chunks |

## Setup and run

### 1. Install the frontend

```bash
npm install
```

### 2. Install the backend

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS / Linux
# source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Build the knowledge base (first time only)

```bash
npm run seed
```

This creates the Astra collection (3072 dimensions, cosine) and loads the ABES pages and the PDF. It makes many embedding calls, so it can take several minutes. Run it once: running it again on an existing collection adds a second copy of every chunk.

### 4. Start the backend (terminal 1, project root)

```bash
uvicorn backend.app.main:app --reload
```

The API runs at http://127.0.0.1:8000, with interactive docs at http://127.0.0.1:8000/docs.

### 5. Start the frontend (terminal 2, project root)

```bash
npm run dev
```

Open http://localhost:3000 and ask a question such as "What courses does ABES offer?".

## Notes

- **Astra DB free tier hibernation:** after a period of inactivity the database pauses. The first requests may fail with "Resuming your database" and the chat shows "I couldn't look that up right now". Wait a few minutes (or open the Astra console to wake it) and try again.
- **Answers can be incomplete.** They reflect whatever the source pages say, and different pages may list different figures, for example for fees or placement years. Check important details with the college.
- **Secrets:** `.env.local` is git-ignored. Never commit API keys or tokens.

## Documentation

More detail on the design and the build is in the `docs/` folder.
