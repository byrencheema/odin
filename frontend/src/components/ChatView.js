import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ChatView({ selectedAircraft }) {
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [predictedFollowUp, setPredictedFollowUp] = useState(null);
  const [includeContext, setIncludeContext] = useState(true);
  const chatEndRef = useRef(null);

  // Initialize chat session on mount
  useEffect(() => {
    const initSession = async () => {
      // Check localStorage for existing session
      const savedSessionId = localStorage.getItem('odin_chat_session_id');
      if (savedSessionId) {
        // Try to fetch existing session
        try {
          const response = await axios.get(`${API}/chat/session/${savedSessionId}`);
          setChatSessionId(savedSessionId);
          setChatMessages(response.data.messages || []);
          return;
        } catch (error) {
          console.log('Saved session not found, creating new session');
        }
      }

      // Create new session
      try {
        const response = await axios.post(`${API}/chat/session`, {
          title: 'ODIN Console Chat'
        });
        const sessionId = response.data.session_id;
        setChatSessionId(sessionId);
        localStorage.setItem('odin_chat_session_id', sessionId);

        // Add welcome message
        setChatMessages([{
          role: 'assistant',
          content: 'Hello! I\'m ODIN Copilot. I can help you understand aircraft movements, NOTAMs, and console status. What would you like to know?',
          timestamp: new Date().toISOString()
        }]);
      } catch (error) {
        console.error('Failed to create chat session:', error);
        toast.error('Failed to initialize chat');
      }
    };

    if (!chatSessionId) {
      initSession();
    }
  }, [chatSessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSending || !chatSessionId) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsSending(true);

    // Add optimistic user message
    const optimisticMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    // Prepare context
    const consoleContext = includeContext ? {
      selected_aircraft_icao: selectedAircraft?.icao24,
      include_notams: true
    } : null;

    try {
      const response = await axios.post(`${API}/chat/message`, {
        session_id: chatSessionId,
        user_message: userMessage,
        console_context: consoleContext,
        stream: false
      });

      // Add assistant message
      setChatMessages(prev => [...prev, response.data.message]);

      // Update predicted follow-up
      if (response.data.predicted_follow_up) {
        setPredictedFollowUp(response.data.predicted_follow_up);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');

      // Add error message
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m temporarily unable to process your request. Please try again in a moment.',
        timestamp: new Date().toISOString(),
        metadata: { error: true }
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" data-testid="chat-messages">
        <div className="space-y-4">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#1A1C1F] border border-[#4DD7E6]/40 text-[#E7E9EA]'
                    : 'bg-[#0E0F11] border border-[#3A3E43] text-[#E7E9EA]'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                <div className="text-xs text-[#A9ADB1] mt-1 font-['Azeret_Mono',monospace]">
                  {formatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-[#0E0F11] border border-[#3A3E43] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-[#A9ADB1]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#4DD7E6] rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[#4DD7E6] rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 bg-[#4DD7E6] rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                  </div>
                  <span className="text-xs">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {predictedFollowUp && (
        <div className="px-4 py-2 border-t border-[#3A3E43]">
          <button
            onClick={() => {
              setChatInput(predictedFollowUp);
              setPredictedFollowUp(null);
            }}
            className="text-xs px-3 py-1.5 rounded-md bg-[#1A1C1F] border border-[#4DD7E6]/40 text-[#4DD7E6] hover:bg-[#1E2024] transition-colors"
          >
            💡 {predictedFollowUp}
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[#3A3E43] p-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="flex items-center gap-2 text-xs text-[#A9ADB1]">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="rounded"
            />
            Include current selection
          </label>
        </div>
        <div className="flex gap-2">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about aircraft, NOTAMs, or console status..."
            disabled={isSending}
            rows={2}
            className="flex-1 bg-[#0E0F11] border border-[#3A3E43] rounded-md px-3 py-2 text-sm text-[#E7E9EA] placeholder-[#A9ADB1] focus:outline-none focus:border-[#4DD7E6] resize-none"
            data-testid="chat-input"
          />
          <button
            onClick={handleSendMessage}
            disabled={isSending || !chatInput.trim()}
            className="px-4 py-2 rounded-md bg-[#1A1C1F] border border-[#4DD7E6] text-[#4DD7E6] hover:bg-[#1E2024] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            data-testid="chat-send-button"
          >
            Send
          </button>
        </div>
        <div className="text-xs text-[#A9ADB1] mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
