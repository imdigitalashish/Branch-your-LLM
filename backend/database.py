"""
Database module for the Multiverse Chat Engine.
Uses SQLite3 with async support via aiosqlite.
"""
import aiosqlite
import uuid
from datetime import datetime
from typing import Optional, List
from pathlib import Path

DATABASE_PATH = Path(__file__).parent / "chat.db"


async def get_db():
    """Get database connection."""
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """Initialize the database with the nodes table."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                parent_id TEXT,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                model TEXT,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (parent_id) REFERENCES nodes(id),
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create indexes for faster queries
        await db.execute("CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id)")

        await db.commit()


async def create_session(name: str = "New Chat") -> str:
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "INSERT INTO sessions (id, name) VALUES (?, ?)",
            (session_id, name)
        )
        await db.commit()
    return session_id


async def get_sessions() -> List[dict]:
    """Get all sessions."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions ORDER BY updated_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_session(session_id: str) -> Optional[dict]:
    """Get a session by ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (session_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_session_timestamp(session_id: str):
    """Update the session's updated_at timestamp."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (session_id,)
        )
        await db.commit()


async def create_node(
    session_id: str,
    role: str,
    content: str,
    parent_id: Optional[str] = None,
    model: Optional[str] = None
) -> str:
    """Create a new node in the conversation tree."""
    node_id = str(uuid.uuid4())
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            """INSERT INTO nodes (id, session_id, parent_id, role, content, model)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (node_id, session_id, parent_id, role, content, model)
        )
        await db.commit()

    # Update session timestamp
    await update_session_timestamp(session_id)
    return node_id


async def get_node(node_id: str) -> Optional[dict]:
    """Get a single node by ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM nodes WHERE id = ?",
            (node_id,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_session_nodes(session_id: str) -> List[dict]:
    """Get all nodes for a session (for tree visualization)."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM nodes WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_node_ancestors(node_id: str) -> List[dict]:
    """
    Traceback Algorithm: Get the linear history from root to this node.
    This is the core of the branching logic - it retrieves the exact path
    from the root to the current node, ignoring all other branches.
    """
    ancestors = []
    current_id = node_id

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        while current_id:
            cursor = await db.execute(
                "SELECT * FROM nodes WHERE id = ?",
                (current_id,)
            )
            row = await cursor.fetchone()

            if row:
                ancestors.append(dict(row))
                current_id = row['parent_id']
            else:
                break

    # Reverse to get Root -> Leaf order
    ancestors.reverse()
    return ancestors


async def get_node_siblings(node_id: str) -> List[dict]:
    """Get all siblings of a node (nodes with the same parent)."""
    node = await get_node(node_id)
    if not node:
        return []

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        if node['parent_id'] is None:
            # Root nodes - get all root nodes in session
            cursor = await db.execute(
                "SELECT * FROM nodes WHERE session_id = ? AND parent_id IS NULL ORDER BY created_at ASC",
                (node['session_id'],)
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM nodes WHERE parent_id = ? ORDER BY created_at ASC",
                (node['parent_id'],)
            )

        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_node_children(node_id: str) -> List[dict]:
    """Get all children of a node."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM nodes WHERE parent_id = ? ORDER BY created_at ASC",
            (node_id,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def update_node_content(node_id: str, content: str):
    """Update a node's content (used during streaming)."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE nodes SET content = ? WHERE id = ?",
            (content, node_id)
        )
        await db.commit()


async def delete_session(session_id: str):
    """Delete a session and all its nodes."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM nodes WHERE session_id = ?", (session_id,))
        await db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        await db.commit()


async def rename_session(session_id: str, name: str):
    """Rename a session."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            "UPDATE sessions SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (name, session_id)
        )
        await db.commit()
