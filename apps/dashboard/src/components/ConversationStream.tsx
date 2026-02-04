'use client';

import { useEffect, useState, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';

interface Message {
  id: string;
  conversation_id: string;
  sender: { id: string; name: string };
  content: string;
  created_at: string;
}

interface StreamEvent {
  conversation_id: string;
  message: Message;
  type: 'sent' | 'received';
}

export default function ConversationStream({
  agentId,
  conversations,
}: {
  agentId: string;
  conversations: any[];
}) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load existing messages from all conversations on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const allEvents: StreamEvent[] = [];

        for (const conv of conversations) {
          try {
            const data = await api.getMessages(conv.id);
            for (const msg of data.messages) {
              allEvents.push({
                conversation_id: conv.id,
                message: { ...msg, conversation_id: conv.id },
                type: msg.sender.id === agentId ? 'sent' : 'received',
              });
            }
          } catch {
            // Skip conversations that fail to load
          }
        }

        // Sort by time
        allEvents.sort(
          (a, b) =>
            new Date(a.message.created_at).getTime() - new Date(b.message.created_at).getTime()
        );

        setEvents(allEvents.slice(-100));
      } finally {
        setLoaded(true);
      }
    }

    if (conversations.length > 0) {
      loadHistory();
    } else {
      setLoaded(true);
    }
  }, [agentId, conversations]);

  // Listen for new messages via WebSocket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleSent(data: { conversation_id: string; message: Message }) {
      setEvents((prev) => [...prev.slice(-99), { ...data, type: 'sent' as const }]);
    }

    function handleReceived(data: { conversation_id: string; message: Message }) {
      setEvents((prev) => [...prev.slice(-99), { ...data, type: 'received' as const }]);
    }

    socket.on('message:sent', handleSent);
    socket.on('message:received', handleReceived);

    return () => {
      socket.off('message:sent', handleSent);
      socket.off('message:received', handleReceived);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  return (
    <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900/50">
      <h3 className="text-lg font-semibold mb-4">Live Conversation Stream</h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {!loaded && (
          <p className="text-neutral-500 text-sm text-center py-8">Loading messages...</p>
        )}

        {loaded && events.length === 0 && (
          <p className="text-neutral-500 text-sm text-center py-8">
            No messages yet. Your agent&apos;s conversations will appear here.
          </p>
        )}

        {events.map((event) => {
          const isMine = event.message.sender.id === agentId;
          return (
            <div
              key={event.message.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  isMine
                    ? 'bg-purple-900/40 border border-purple-800/50'
                    : 'bg-neutral-800 border border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-xs text-neutral-400">
                    {event.message.sender.name}
                  </span>
                  <span className="text-xs text-neutral-600">
                    {new Date(event.message.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p>{event.message.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
