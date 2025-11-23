# Multiverse Chat Engine

**Chat is a Tree, not a Line.**

A branching conversation application that allows you to explore multiple conversation paths with LLMs. Unlike traditional chat interfaces, this engine stores conversations as a tree structure where each node can have multiple children (branches), enabling you to regenerate responses, fork conversations, and explore different dialogue paths.

## Features

- Tree-based conversation storage
- Branch and fork conversations at any point
- Regenerate responses to explore alternatives
- Visual graph view of conversation trees
- Streaming responses
- Multi-model support via Ollama

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Ollama](https://ollama.ai/) running locally with at least one model installed

## Quick Start with Docker

### 1. Start Ollama

Make sure Ollama is running on your machine:

```bash
ollama serve
```

And pull a model if you haven't already:

```bash
ollama pull llama3.2
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

This will start:
- **Backend API** on port `8923`
- **Frontend** on port `5699`

### 3. Access the Application

Open your browser and navigate to:

```
http://localhost:5699
```

## Ports

| Service  | Port |
|----------|------|
| Backend  | 8923 |
| Frontend | 5699 |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│     Ollama      │
│   (React/Vite)  │     │   (FastAPI)     │     │   (LLM Server)  │
│   Port: 5699    │     │   Port: 8923    │     │   Port: 11434   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Development

### Running without Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8923
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

**Frontend:**
- `VITE_API_BASE`: Backend API URL (default: `http://localhost:8923`)

**Backend:**
- `OLLAMA_URL`: Ollama server URL (default: `http://localhost:11434`)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/models` | List available Ollama models |
| POST | `/sessions` | Create new chat session |
| GET | `/sessions` | List all sessions |
| DELETE | `/sessions/{id}` | Delete a session |
| POST | `/chat/completions` | Send message and stream response |
| GET | `/session/{id}/tree` | Get conversation tree |
| PUT | `/node/{id}/branch` | Regenerate/fork response |
| POST | `/node/{id}/continue` | Continue from any node |

## License

MIT
