"""
Ollama client for communicating with local LLM.
Handles streaming responses and model management.
"""
import httpx
import json
from typing import AsyncGenerator, List, Dict, Optional

OLLAMA_BASE_URL = "http://localhost:11434"


async def get_available_models() -> List[Dict]:
    """Get list of available models from Ollama."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except httpx.RequestError:
            return []


async def check_ollama_health() -> bool:
    """Check if Ollama is running and accessible."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return response.status_code == 200
        except httpx.RequestError:
            return False


async def generate_chat_stream(
    messages: List[Dict[str, str]],
    model: str = "llama3.2"
) -> AsyncGenerator[str, None]:
    """
    Stream chat completion from Ollama.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model name to use

    Yields:
        String chunks of the response
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload
        ) as response:
            print("RESPONSE FROM OLLAMA")
            response.raise_for_status()

            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]

                        # Check if done
                        if data.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue


async def generate_chat_completion(
    messages: List[Dict[str, str]],
    model: str = "llama3.2"
) -> str:
    """
    Get non-streaming chat completion from Ollama.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model name to use

    Returns:
        Complete response text
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": False
    }

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload
        )
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "")


def format_messages_for_ollama(nodes: List[Dict]) -> List[Dict[str, str]]:
    """
    Convert database nodes to Ollama message format.

    Args:
        nodes: List of node dicts from database (in Root -> Leaf order)

    Returns:
        List of message dicts for Ollama API
    """
    messages = []
    for node in nodes:
        messages.append({
            "role": node["role"],
            "content": node["content"]
        })
    return messages
