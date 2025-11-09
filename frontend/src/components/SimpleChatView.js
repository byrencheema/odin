import React, { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const SimpleChatView = ({
  infoView = 'flights',
  selectedAircraft = null,
  selectedATCFacility = null,
  aircraftCount = 0,
}) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm ODIN Copilot. Ask me about aircraft, airspace, or ATC procedures." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const scrollRef = useRef(null);
  const audioRef = useRef(null);

  const consoleContext = useMemo(() => {
    const context = {
      active_panel: infoView || 'flights',
      focus: 'none'
    };

    if (selectedAircraft) {
      context.focus = 'aircraft';
      context.selected_aircraft = {
        icao24: selectedAircraft.icao24,
        callsign: selectedAircraft.callsign || null,
        origin_country: selectedAircraft.origin_country || null,
      };
    } else if (selectedATCFacility) {
      context.focus = 'atc_facility';
      context.selected_atc_facility = {
        id: selectedATCFacility.id,
        type: selectedATCFacility.type,
        name: selectedATCFacility.name,
      };
    }

    return context;
  }, [infoView, selectedAircraft, selectedATCFacility]);

  const contextPreface = useMemo(() => {
    if (!consoleContext) return '';

    const lines = [
      `Active panel: ${consoleContext.active_panel}`,
      `Focus: ${consoleContext.focus}`,
    ];

    if (consoleContext.focus === 'aircraft' && consoleContext.selected_aircraft) {
      const { icao24, callsign, origin_country } = consoleContext.selected_aircraft;
      lines.push(`Aircraft ICAO24: ${icao24}`);
      if (callsign) lines.push(`Callsign: ${callsign}`);
      if (origin_country) lines.push(`Origin country: ${origin_country}`);
    }

    if (consoleContext.focus === 'atc_facility' && consoleContext.selected_atc_facility) {
      const { id, type, name } = consoleContext.selected_atc_facility;
      lines.push(`ATC Facility: ${name || id}`);
      lines.push(`Facility ID: ${id}`);
      lines.push(`Facility Type: ${type}`);
    }

    return `[[Console Context]]\n${lines.join('\n')}`;
  }, [consoleContext]);

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
      const enrichedMessage = contextPreface
        ? `${contextPreface}\n\nUser: ${userMessage}`
        : userMessage;

      const response = await axios.post(`${API}/api/chat`, {
        message: enrichedMessage,
        history: newMessages.slice(-10), // Send last 10 messages for context
        console_context: consoleContext,
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

  const handleShiftHandoff = async () => {
    setHandoffLoading(true);
    
    try {
      // Determine facility from selected ATC or default to KSFO
      const facilityId = selectedATCFacility?.id || 'KSFO';
      const facilityName = selectedATCFacility?.name || 'San Francisco Tower';
      
      const response = await axios.post(`${API}/api/handoff/shift`, {
        facility_id: facilityId,
        facility_name: facilityName,
        outgoing_controller: 'Controller',
        incoming_controller: 'Relief',
        aircraft_count: aircraftCount,
        console_context: consoleContext
      });
      
      const data = response.data;
      
      // Add briefing to chat as assistant message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `📻 Shift Handoff Briefing:\n\n${data.briefing_script}`
      }]);
      
      // Auto-play audio if available
      if (data.audio_base64 && audioRef.current) {
        const audioSrc = `data:audio/mpeg;base64,${data.audio_base64}`;
        audioRef.current.src = audioSrc;
        audioRef.current.play().catch(err => {
          console.error('Audio playback failed:', err);
        });
      }
      
    } catch (error) {
      console.error('Shift handoff error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error generating the shift handoff. Please try again.'
      }]);
    } finally {
      setHandoffLoading(false);
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
        <div className="flex gap-2 mt-2">
          <Button
            onClick={handleShiftHandoff}
            disabled={handoffLoading}
            className="flex-1 bg-[#6BEA76] hover:bg-[#5AD966] text-[#0A0B0C] font-medium"
            data-testid="shift-handoff-button"
          >
            {handoffLoading ? 'Generating...' : 'Automate Shift Handoff'}
          </Button>
          <Button
            onClick={() => setMessages([{ role: 'assistant', content: "Hello! I'm ODIN Copilot. Ask me about aircraft, airspace, or ATC procedures." }])}
            variant="ghost"
            size="sm"
            className="text-[#A9ADB1] hover:text-[#E7E9EA]"
          >
            Clear
          </Button>
        </div>
      </div>
      
      {/* Hidden audio element for shift handoff playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
};

export default SimpleChatView;
