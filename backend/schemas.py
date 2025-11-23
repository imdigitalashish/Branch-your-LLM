"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ============ Session Schemas ============

class SessionCreate(BaseModel):
    name: str = "New Chat"


class SessionResponse(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime


class SessionRename(BaseModel):
    name: str


# ============ Node Schemas ============

class NodeBase(BaseModel):
    role: str
    content: str


class NodeCreate(BaseModel):
    session_id: str
    parent_id: Optional[str] = None
    content: str
    model: str = "gemma3:4b"


class NodeResponse(BaseModel):
    id: str
    session_id: str
    parent_id: Optional[str]
    role: str
    content: str
    created_at: datetime
    model: Optional[str]
    is_active: bool


# ============ Chat Schemas ============

class ChatRequest(BaseModel):
    session_id: str
    parent_id: Optional[str] = None
    content: str
    model: str = "gemma3:4b"


class ChatStreamChunk(BaseModel):
    token: str
    node_id: str
    done: bool = False


# ============ Branch Schemas ============

class BranchRequest(BaseModel):
    node_id: str
    model: str = "gemma3:4b"


# ============ Tree Schemas ============

class TreeNode(BaseModel):
    id: str
    parent_id: Optional[str]
    role: str
    content: str
    created_at: datetime
    model: Optional[str]
    children_count: int = 0
    sibling_index: int = 0
    sibling_count: int = 1


class TreeResponse(BaseModel):
    session_id: str
    nodes: List[NodeResponse]


# ============ Model Schemas ============

class OllamaModel(BaseModel):
    name: str
    size: Optional[int] = None
    modified_at: Optional[str] = None
