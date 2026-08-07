"use client";

import React, { useState } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'GroundTruth Copilot online. How can I assist you with district telemetry today?' }
  ]);

  const pathname = usePathname();

  // Detects if the user is currently looking at a district page (/district/dadra-and-nagar-haveli)
  const getDistrictIdFromUrl = () => {
    if (pathname && pathname.startsWith('/district/')) {
      const parts = pathname.split('/');
      return parts[parts.length - 1] || null;
    }
    return null;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');

    // Append user message immediately to the UI
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const districtId = getDistrictIdFromUrl();

      const API_BASE = process.env.NEXT_PUBLIC_PRODUCTION_URL || "http://127.0.0.1:8000";
      // Call the Python FastAPI RAG route
      const res = await fetch(`${API_BASE}/api/v1/copilot/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMsg,
          district_id: districtId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server status: ${res.status}`);
      }

      const data = await res.json();

      // Append assistant response to UI
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply || 'No response received from telemetry core.' }
      ]);
    } catch (error) {
      console.error("Copilot fetch error:", error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Telemetry Link Error: Could not reach backend AI service. Ensure FastAPI server is running on :8000.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans text-gray-200">
      
      {/* The Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 h-[500px] bg-[#050811] border border-cyan-500/50 rounded-xl shadow-[0_0_20px_rgba(8,145,178,0.3)] flex flex-col overflow-hidden backdrop-blur-md">
          
          {/* Header */}
          <div className="bg-cyan-950/40 border-b border-cyan-900/50 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="text-cyan-400 w-5 h-5" />
              <h3 className="font-sora font-bold text-white text-sm tracking-wide">GroundTruth AI Copilot</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-cyan-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  msg.role === 'user' 
                    ? 'bg-gray-800 border-gray-600 text-gray-300' 
                    : 'bg-cyan-950/50 border-cyan-500/30 text-cyan-400'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className={`text-sm p-3 rounded-lg max-w-[80%] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-gray-800 text-gray-200 rounded-tr-none' 
                    : 'bg-cyan-950/20 border border-cyan-900/30 text-gray-300 rounded-tl-none font-mono text-xs whitespace-pre-wrap'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-cyan-950/20 border border-cyan-900/30 text-cyan-400 text-xs font-mono p-3 rounded-lg rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing telemetry payload...
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-3 border-t border-cyan-900/50 bg-[#0a0f1c]">
            <div className="relative flex items-center">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Ask about district data..."
                className="w-full bg-[#050811] border border-cyan-900/50 rounded-lg py-3 pl-4 pr-12 text-sm text-gray-200 font-mono placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 p-2 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-500/40 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-cyan-600/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`absolute bottom-0 right-0 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(8,145,178,0.4)] transition-transform duration-300 hover:scale-110 ${
          isOpen ? 'bg-rose-900/80 border border-rose-500 text-rose-400' : 'bg-cyan-900/80 border border-cyan-500 text-cyan-400'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

    </div>
  );
}