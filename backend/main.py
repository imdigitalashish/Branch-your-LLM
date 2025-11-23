"""
Main FastAPI application for the Multiverse Chat Engine.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import json

from database import (
    init_db,
    create_session,
    get_sessions,
    get_session,
    delete_session,
    rename_session,
    create_node,
    get_node,
    get_session_nodes,
    get_node_ancestors,
    get_node_siblings,
    get_node_children,
    update_node_content,
)
from schemas import (
    SessionCreate,
    SessionResponse,
    SessionRename,
    ChatRequest,
    NodeResponse,
    BranchRequest,
    TreeResponse,
)
from ollama_client import (
    get_available_models,
    check_ollama_health,
    generate_chat_stream,
    format_messages_for_ollama,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Initialize database
    await init_db()
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="Multiverse Chat Engine",
    description="Chat is a Tree, not a Line.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Health & Status ============

@app.get("/health")
async def health_check():
    """Check API and Ollama health."""
    ollama_ok = await check_ollama_health()
    return {
        "api": "ok",
        "ollama": "ok" if ollama_ok else "unavailable"
    }


@app.get("/models")
async def list_models():
    """Get available Ollama models."""
    models = await get_available_models()
    return {"models": models}


# ============ Sessions ============

@app.post("/sessions", response_model=SessionResponse)
async def create_new_session(session_in: SessionCreate):
    """Create a new chat session."""
    session_id = await create_session(session_in.name)
    session = await get_session(session_id)
    return session


@app.get("/sessions")
async def list_sessions():
    """Get all sessions."""
    sessions = await get_sessions()
    return {"sessions": sessions}


@app.get("/sessions/{session_id}")
async def get_session_by_id(session_id: str):
    """Get a specific session."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.delete("/sessions/{session_id}")
async def delete_session_by_id(session_id: str):
    """Delete a session and all its nodes."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await delete_session(session_id)
    return {"status": "deleted"}


@app.patch("/sessions/{session_id}")
async def rename_session_by_id(session_id: str, rename: SessionRename):
    """Rename a session."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await rename_session(session_id, rename.name)
    return await get_session(session_id)


# ============ Chat Completions ============

@app.post("/chat/completions")
async def chat_completion(request: ChatRequest):
    """
    The main chat endpoint. Handles the Context Slicing Algorithm:
    1. Save user message with parent_id
    2. Traceback to get linear history for this branch
    3. Call Ollama with context
    4. Stream response and save assistant message
    """
    # Verify session exists
    session = await get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 1. Save user message
    user_node_id = await create_node(
        session_id=request.session_id,
        role="user",
        content=request.content,
        parent_id=request.parent_id,
        model=None
    )

    # 2. Traceback to get context (includes the user message we just created)
    context_nodes = await get_node_ancestors(user_node_id)

    # 3. Format messages for Ollama
    messages = format_messages_for_ollama(context_nodes)

    # 4. Create placeholder for assistant response
    assistant_node_id = await create_node(
        session_id=request.session_id,
        role="assistant",
        content="",
        parent_id=user_node_id,
        model=request.model
    )

    # 5. Stream response
    async def stream_response():
        full_content = ""
        try:
            async for chunk in generate_chat_stream(messages, request.model):
                full_content += chunk
                yield json.dumps({
                    "token": chunk,
                    "node_id": assistant_node_id,
                    "user_node_id": user_node_id,
                    "done": False
                }) + "\n"

            # Update node with full content
            await update_node_content(assistant_node_id, full_content)

            # Final message
            yield json.dumps({
                "token": "",
                "node_id": assistant_node_id,
                "user_node_id": user_node_id,
                "done": True,
                "full_content": full_content
            }) + "\n"

        except Exception as e:
            # On error, update node with error message
            error_msg = f"Error: {str(e)}"
            await update_node_content(assistant_node_id, error_msg)
            yield json.dumps({
                "token": error_msg,
                "node_id": assistant_node_id,
                "user_node_id": user_node_id,
                "done": True,
                "error": True
            }) + "\n"

    return StreamingResponse(
        stream_response(),
        media_type="application/x-ndjson"
    )


# ============ Tree & Visualization ============

@app.get("/session/{session_id}/tree")
async def get_session_tree(session_id: str):
    """
    Get all nodes for a session (for tree visualization).
    The frontend converts this flat list into a tree structure.
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    nodes = await get_session_nodes(session_id)
    return {"session_id": session_id, "nodes": nodes}


@app.get("/node/{node_id}/path")
async def get_node_path(node_id: str):
    """
    Get the linear path from root to this node.
    Used for rendering the chat view for a specific branch.
    """
    node = await get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    ancestors = await get_node_ancestors(node_id)
    return {"path": ancestors}


@app.get("/node/{node_id}/siblings")
async def get_siblings(node_id: str):
    """
    Get all siblings of a node (for the timeline switcher).
    """
    node = await get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    siblings = await get_node_siblings(node_id)
    return {
        "siblings": siblings,
        "current_index": next(
            (i for i, s in enumerate(siblings) if s["id"] == node_id),
            0
        ),
        "total": len(siblings)
    }


@app.get("/node/{node_id}/children")
async def get_children(node_id: str):
    """Get all children of a node."""
    node = await get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    children = await get_node_children(node_id)
    return {"children": children}


# ============ Branching ============

@app.put("/node/{node_id}/branch")
async def branch_from_node(node_id: str, request: BranchRequest):
    """
    The "Fork" / "Regenerate" endpoint.
    Creates a new branch from the parent of the given node.
    """
    node = await get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Get the parent to branch from
    parent_id = node["parent_id"]

    # Get context up to parent
    if parent_id:
        context_nodes = await get_node_ancestors(parent_id)
    else:
        context_nodes = []

    # Format for Ollama
    messages = format_messages_for_ollama(context_nodes)

    # Create new assistant node (sibling to the original)
    new_node_id = await create_node(
        session_id=node["session_id"],
        role="assistant",
        content="",
        parent_id=parent_id,
        model=request.model
    )

    # Stream response
    async def stream_response():
        full_content = ""
        try:
            async for chunk in generate_chat_stream(messages, request.model):
                full_content += chunk
                yield json.dumps({
                    "token": chunk,
                    "node_id": new_node_id,
                    "done": False
                }) + "\n"

            await update_node_content(new_node_id, full_content)

            yield json.dumps({
                "token": "",
                "node_id": new_node_id,
                "done": True,
                "full_content": full_content
            }) + "\n"

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            await update_node_content(new_node_id, error_msg)
            yield json.dumps({
                "token": error_msg,
                "node_id": new_node_id,
                "done": True,
                "error": True
            }) + "\n"

    return StreamingResponse(
        stream_response(),
        media_type="application/x-ndjson"
    )


@app.post("/node/{parent_id}/continue")
async def continue_from_node(parent_id: str, request: ChatRequest):
    """
    Continue conversation from any node in the tree.
    Used for the "Branch Here" feature in graph view.
    """
    parent_node = await get_node(parent_id)
    if not parent_node:
        raise HTTPException(status_code=404, detail="Parent node not found")

    # Create user message branching from parent
    user_node_id = await create_node(
        session_id=parent_node["session_id"],
        role="user",
        content=request.content,
        parent_id=parent_id,
        model=None
    )

    # Get context including new user message
    context_nodes = await get_node_ancestors(user_node_id)
    messages = format_messages_for_ollama(context_nodes)

    # Create assistant response node
    assistant_node_id = await create_node(
        session_id=parent_node["session_id"],
        role="assistant",
        content="",
        parent_id=user_node_id,
        model=request.model
    )

    async def stream_response():
        full_content = ""
        try:
            async for chunk in generate_chat_stream(messages, request.model):
                full_content += chunk
                yield json.dumps({
                    "token": chunk,
                    "node_id": assistant_node_id,
                    "user_node_id": user_node_id,
                    "done": False
                }) + "\n"

            await update_node_content(assistant_node_id, full_content)

            yield json.dumps({
                "token": "",
                "node_id": assistant_node_id,
                "user_node_id": user_node_id,
                "done": True,
                "full_content": full_content
            }) + "\n"

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            await update_node_content(assistant_node_id, error_msg)
            yield json.dumps({
                "token": error_msg,
                "node_id": assistant_node_id,
                "user_node_id": user_node_id,
                "done": True,
                "error": True
            }) + "\n"

    return StreamingResponse(
        stream_response(),
        media_type="application/x-ndjson"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
