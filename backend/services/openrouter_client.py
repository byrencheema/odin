"""
OpenRouter API Client with streaming support for Odin Copilot.
"""

import asyncio
import httpx
import json
import logging
from typing import AsyncIterator, Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class OpenRouterError(Exception):
    """Base exception for OpenRouter client errors."""
    pass


class OpenRouterTimeoutError(OpenRouterError):
    """Raised when OpenRouter request times out."""
    pass


class OpenRouterAPIError(OpenRouterError):
    """Raised when OpenRouter returns an error response."""
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"OpenRouter API error {status_code}: {message}")


class OpenRouterClient:
    """
    Async client for OpenRouter API with streaming support, retries, and backoff.
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://openrouter.ai/api/v1",
        model: str = "anthropic/claude-3.5-sonnet",
        timeout_seconds: float = 15.0,
        max_retries: int = 3,
        backoff_factor: float = 2.0
    ):
        """
        Initialize OpenRouter client.
        
        Args:
            api_key: OpenRouter API key
            base_url: Base URL for OpenRouter API
            model: Default model to use
            timeout_seconds: Request timeout
            max_retries: Maximum retry attempts
            backoff_factor: Exponential backoff multiplier
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        
        if not self.api_key:
            raise ValueError("OpenRouter API key is required")
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        stream: bool = False
    ) -> Dict[str, Any]:
        """
        Send chat completion request to OpenRouter.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use (defaults to instance model)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            stream: Whether to stream response
            
        Returns:
            Dict with completion response
            
        Raises:
            OpenRouterTimeoutError: If request times out
            OpenRouterAPIError: If API returns error
        """
        if stream:
            raise ValueError("Use chat_completion_stream for streaming responses")
        
        use_model = model or self.model
        endpoint = f"{self.base_url}/chat/completions"
        
        payload = {
            "model": use_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://odin-atc.emergent.app",
            "X-Title": "Odin ATC Console"
        }
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    logger.info(f"Sending chat completion to OpenRouter (attempt {attempt + 1}/{self.max_retries})")
                    start_time = datetime.now(timezone.utc)
                    
                    response = await client.post(
                        endpoint,
                        json=payload,
                        headers=headers
                    )
                    
                    latency_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                    logger.info(f"OpenRouter response received in {latency_ms:.0f}ms (status: {response.status_code})")
                    
                    if response.status_code == 200:
                        result = response.json()
                        result['_latency_ms'] = latency_ms
                        return self._normalize_response(result)
                    
                    # Handle errors
                    error_text = response.text
                    logger.error(f"OpenRouter error {response.status_code}: {error_text}")
                    
                    # Don't retry on client errors (4xx)
                    if 400 <= response.status_code < 500:
                        raise OpenRouterAPIError(response.status_code, error_text)
                    
                    # Retry on server errors (5xx)
                    if attempt < self.max_retries - 1:
                        wait_time = self.backoff_factor ** attempt
                        logger.warning(f"Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    
                    raise OpenRouterAPIError(response.status_code, error_text)
                    
            except httpx.TimeoutException as e:
                logger.error(f"OpenRouter request timeout: {e}")
                if attempt < self.max_retries - 1:
                    wait_time = self.backoff_factor ** attempt
                    logger.warning(f"Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                raise OpenRouterTimeoutError("OpenRouter request timed out after retries")
            
            except httpx.RequestError as e:
                logger.error(f"OpenRouter request error: {e}")
                if attempt < self.max_retries - 1:
                    wait_time = self.backoff_factor ** attempt
                    logger.warning(f"Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                raise OpenRouterError(f"Request failed: {e}")
        
        raise OpenRouterError("Max retries exceeded")
    
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> AsyncIterator[str]:
        """
        Stream chat completion from OpenRouter.
        
        Args:
            messages: List of message dicts
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            
        Yields:
            Token strings as they arrive
            
        Raises:
            OpenRouterTimeoutError: If request times out
            OpenRouterAPIError: If API returns error
        """
        use_model = model or self.model
        endpoint = f"{self.base_url}/chat/completions"
        
        payload = {
            "model": use_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://odin-atc.emergent.app",
            "X-Title": "Odin ATC Console"
        }
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                logger.info("Starting streaming chat completion from OpenRouter")
                start_time = datetime.now(timezone.utc)
                
                async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        logger.error(f"OpenRouter streaming error {response.status_code}: {error_text}")
                        raise OpenRouterAPIError(response.status_code, error_text.decode())
                    
                    token_count = 0
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        
                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix
                            
                            if data == "[DONE]":
                                latency_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                                logger.info(f"Stream completed: {token_count} tokens in {latency_ms:.0f}ms")
                                break
                            
                            try:
                                chunk = json.loads(data)
                                if "choices" in chunk and len(chunk["choices"]) > 0:
                                    delta = chunk["choices"][0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        token_count += 1
                                        yield content
                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse streaming chunk: {data[:100]}")
                                continue
                                
        except httpx.TimeoutException as e:
            logger.error(f"OpenRouter streaming timeout: {e}")
            raise OpenRouterTimeoutError("Streaming request timed out")
        
        except httpx.RequestError as e:
            logger.error(f"OpenRouter streaming request error: {e}")
            raise OpenRouterError(f"Streaming request failed: {e}")
    
    def _normalize_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize OpenRouter response to standard format.
        
        Args:
            response: Raw OpenRouter response
            
        Returns:
            Normalized response dict
        """
        if "choices" not in response or len(response["choices"]) == 0:
            raise OpenRouterError("No choices in response")
        
        choice = response["choices"][0]
        message = choice.get("message", {})
        content = message.get("content", "")
        
        # Try to parse JSON response if it looks like JSON
        parsed_content = content
        if content.strip().startswith("{"):
            try:
                parsed_content = json.loads(content)
            except json.JSONDecodeError:
                # Keep as string if parsing fails
                pass
        
        return {
            "content": parsed_content,
            "role": message.get("role", "assistant"),
            "finish_reason": choice.get("finish_reason"),
            "usage": response.get("usage", {}),
            "latency_ms": response.get("_latency_ms", 0)
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check if OpenRouter API is reachable.
        
        Returns:
            Dict with health status
        """
        try:
            # Send minimal test request
            result = await self.chat_completion(
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=5
            )
            return {
                "healthy": True,
                "latency_ms": result.get("latency_ms", 0),
                "model": self.model
            }
        except Exception as e:
            logger.error(f"OpenRouter health check failed: {e}")
            return {
                "healthy": False,
                "error": str(e),
                "model": self.model
            }
