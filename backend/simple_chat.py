"""Simple chat with OpenRouter - no sessions, no complexity"""
import os
import httpx
from typing import List, Dict

OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet'

SYSTEM_PROMPT = """You are ODIN Copilot, an ATC assistant for Bay Area air traffic. 
Provide concise, helpful responses about aircraft, airspace, and ATC procedures. 
Keep responses brief (2-3 sentences max)."""


async def chat_with_openrouter(user_message: str, conversation_history: List[Dict] = None) -> str:
    """Send message to OpenRouter and get response."""
    
    if not OPENROUTER_API_KEY:
        return "Chat unavailable: OpenRouter API key not configured."
    
    # Build messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add conversation history (last 5 messages only)
    if conversation_history:
        messages.extend(conversation_history[-5:])
    
    # Add current message
    messages.append({"role": "user", "content": user_message})
    
    # Call OpenRouter
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                'https://openrouter.ai/api/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': OPENROUTER_MODEL,
                    'messages': messages,
                    'max_tokens': 300
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data['choices'][0]['message']['content']
            else:
                return f"Error: OpenRouter returned status {response.status_code}"
                
    except Exception as e:
        return f"Chat error: {str(e)}"
