import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SimpleChatView = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm ODIN Copilot. Ask me about aircraft, airspace, or ATC procedures." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Send to backend
      const response = await axios.post(`${API}/api/chat`, {
        message: userMessage,
        history: newMessages.slice(-10) // Send last 10 messages for context
      });

      // Add assistant response
      setMessages([...newMessages, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      console.error('Error details:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || error.message || 'Sorry, I encountered an error. Please try again.';
      setMessages([...newMessages, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0E0F11]" data-testid="simple-chat-view">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded ${
                  msg.role === 'user'
                    ? 'bg-[#4DD7E6] text-[#0A0B0C]'
                    : 'bg-[#3A3E43] text-[#E7E9EA]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#3A3E43] p-3 rounded flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-[#A9ADB1]">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-[#3A3E43]">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about aircraft, airspace, or ATC procedures..."
            className="flex-1 bg-[#0A0B0C] border-[#3A3E43] text-[#E7E9EA] resize-none"
            rows={2}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-[#4DD7E6] hover:bg-[#3AC5D5] text-[#0A0B0C]"
          >
            Send
          </Button>
        </div>
        <Button
          onClick={() => setMessages([{ role: 'assistant', content: "Hello! I'm ODIN Copilot. Ask me about aircraft, airspace, or ATC procedures." }])}
          variant="ghost"
          size="sm"
          className="mt-2 text-[#A9ADB1] hover:text-[#E7E9EA]"
        >
          Clear Chat
        </Button>
      </div>
    </div>
  );
};

export default SimpleChatView;
