import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WELCOME_MESSAGE = "Hello! I'm ODIN Copilot. I can help you interpret aircraft movements, NOTAMs, and console status. What would you like to know?";

const ChatView = React.memo(function ChatView({ selectedAircraft }) {
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [predictedFollowUp, setPredictedFollowUp] = useState(null);
  const [includeContext, setIncludeContext] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const chatEndRef = useRef(null);
  const hasBootstrappedRef = useRef(false);

  const hydratePredictedFollowUp = useCallback((messages = []) => {
    if (!messages.length) return null;
    const latestAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant');
    return latestAssistant?.metadata?.predicted_follow_up || null;
  }, []);

  const initializeSession = useCallback(async () => {
    setIsInitializing(true);
    setSessionError(null);

    try {
      const response = await axios.post(`${API}/chat/session`, {
        title: 'ODIN Console Chat'
      });
      const sessionId = response.data.session_id;
      setChatSessionId(sessionId);
      setChatMessages(response.data.messages || []);
      setPredictedFollowUp(hydratePredictedFollowUp(response.data.messages));
    } catch (error) {
      console.error('Failed to create chat session:', error);
      setSessionError('Failed to initialize chat');
      toast.error('Unable to initialize chat');
    } finally {
      setIsInitializing(false);
    }
  }, [hydratePredictedFollowUp]);

  // Initialize chat session on mount
  useEffect(() => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount, ref guards against double-init

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = useCallback(async () => {
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

      const assistantMessage = response.data.message;
      setChatMessages((prev) => {
        const nextMessages = [...prev, assistantMessage];
        const followUp =
          response.data.predicted_follow_up || hydratePredictedFollowUp(nextMessages);
        setPredictedFollowUp(followUp);
        return nextMessages;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');

      // Add error message
      setChatMessages((prev) => {
        const nextMessages = [
          ...prev,
          {
            role: 'assistant',
            content: "I'm temporarily unable to process your request. Please try again in a moment.",
            timestamp: new Date().toISOString(),
            metadata: { error: true }
          }
        ];
        setPredictedFollowUp(null);
        return nextMessages;
      });
    } finally {
      setIsSending(false);
    }
  }, [chatInput, isSending, chatSessionId, includeContext, selectedAircraft, hydratePredictedFollowUp]);

  const handleResetSession = useCallback(async () => {
    if (!chatSessionId || isResetting) return;
    setIsResetting(true);
    setSessionError(null);
    setChatInput('');

    try {
      await axios.post(`${API}/chat/session/${chatSessionId}/reset`);
      setChatMessages([{
        role: 'assistant',
        content: WELCOME_MESSAGE,
        timestamp: new Date().toISOString(),
        metadata: { type: 'welcome' }
      }]);
      setPredictedFollowUp(null);
      toast.success('Chat reset');
    } catch (error) {
      console.error('Failed to reset chat session:', error);
      toast.error('Failed to reset chat');
    } finally {
      setIsResetting(false);
    }
  }, [chatSessionId, isResetting]);

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

  const renderStatusState = () => {
    if (isInitializing) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-sm text-[#A9ADB1]">
          Establishing secure link…
        </div>
      );
    }

    if (isResetting) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-sm text-[#A9ADB1]">
          Resetting session…
        </div>
      );
    }

    if (sessionError) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center space-y-3 text-sm text-[#A9ADB1]">
          <p>{sessionError}</p>
          <Button variant="outline" size="sm" onClick={initializeSession}>
            Retry
          </Button>
        </div>
      );
    }

    return null;
  };

  const isComposerDisabled = !chatSessionId || isSending || isInitializing || isResetting;

  return (
    <div className="h-full flex flex-col">
      {renderStatusState() || (
        <>
          <div className="flex items-center justify-between border-b border-[#3A3E43] px-4 py-2 text-xs text-[#A9ADB1]">
            <span>
              {chatSessionId ? `Session ${chatSessionId.slice(0, 8).toUpperCase()}` : 'Session unavailable'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#E7E9EA] hover:text-[#4DD7E6]"
              onClick={handleResetSession}
              disabled={!chatSessionId || isResetting || isInitializing}
            >
              Reset chat
            </Button>
          </div>
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" data-testid="chat-messages">
            <div className="space-y-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.timestamp}-${idx}`}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-[#1A1C1F] border border-[#4DD7E6]/40 text-[#E7E9EA]'
                        : 'bg-[#0E0F11] border border-[#3A3E43] text-[#E7E9EA]'
                    } ${msg.metadata?.error ? 'border-red-500/60 text-red-200' : ''}`}
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
              <Button
                variant="ghost"
                size="sm"
                className="text-xs border border-[#4DD7E6]/40 bg-[#1A1C1F] text-[#4DD7E6] hover:bg-[#1E2024]"
                onClick={() => {
                  setChatInput(predictedFollowUp);
                  setPredictedFollowUp(null);
                }}
              >
                Suggestion: {predictedFollowUp}
              </Button>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-[#3A3E43] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                id="context-toggle"
                checked={includeContext}
                onCheckedChange={setIncludeContext}
                disabled={isComposerDisabled}
              />
              <Label htmlFor="context-toggle" className="text-xs text-[#A9ADB1]">
                Include current selection
              </Label>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about aircraft, NOTAMs, or console status..."
                disabled={isComposerDisabled}
                rows={2}
                className="flex-1 resize-none border-[#3A3E43] bg-[#0E0F11] text-[#E7E9EA] placeholder-[#A9ADB1] focus:border-[#4DD7E6] focus-visible:ring-0"
                data-testid="chat-input"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isComposerDisabled || !chatInput.trim()}
                variant="outline"
                className="border-[#4DD7E6] text-[#4DD7E6] hover:bg-[#1E2024]"
                data-testid="chat-send-button"
              >
                Send
              </Button>
            </div>
            <div className="text-xs text-[#A9ADB1]">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
        </>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if selectedAircraft actually changes
  return prevProps.selectedAircraft?.icao24 === nextProps.selectedAircraft?.icao24;
});

export default ChatView;
