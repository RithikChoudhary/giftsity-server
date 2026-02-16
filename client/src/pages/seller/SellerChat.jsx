import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, ArrowLeft } from 'lucide-react';
import { chatAPI } from '../../api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export default function SellerChat() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    chatAPI.getConversations()
      .then(res => setConversations(res.data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (activeConv && data.conversationId === activeConv._id) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
        socket.emit('markRead', { conversationId: activeConv._id });
      }
      setConversations(prev => prev.map(c =>
        c._id === data.conversationId ? { ...c, lastMessage: { content: data.message.content, senderId: data.message.senderId, sentAt: data.message.createdAt } } : c
      ));
    };
    socket.on('newMessage', handler);
    return () => socket.off('newMessage', handler);
  }, [socket, activeConv]);

  const openConversation = async (conv) => {
    setActiveConv(conv);
    try {
      const res = await chatAPI.getMessages(conv._id);
      setMessages(res.data.messages || []);
      scrollToBottom();
      if (socket) socket.emit('markRead', { conversationId: conv._id });
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const res = await chatAPI.sendMessage(activeConv._id, { content: newMessage.trim() });
      setMessages(prev => [...prev, res.data.message]);
      setNewMessage('');
      scrollToBottom();
    } catch {}
    setSending(false);
  };

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const otherParticipant = (conv) => conv.participants?.find(p => p.userId !== user?._id);

  const timeSince = (date) => {
    if (!date) return '';
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-theme-primary mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5" /> Customer Messages
      </h1>

      <div className="flex border border-theme-border rounded-xl overflow-hidden bg-theme-card" style={{ height: '70vh' }}>
        {/* Conversation list */}
        <div className={`w-full md:w-80 border-r border-theme-border flex-shrink-0 overflow-y-auto ${activeConv ? 'hidden md:block' : ''}`}>
          {loading ? (
            <div className="p-4 text-center text-theme-muted text-sm">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-10 h-10 text-theme-dim mx-auto mb-2" />
              <p className="text-sm text-theme-muted">No messages yet</p>
              <p className="text-xs text-theme-dim mt-1">Customers will message you from your product pages</p>
            </div>
          ) : conversations.map(conv => {
            const other = otherParticipant(conv);
            const unread = conv.unreadCounts?.[user?._id] || 0;
            return (
              <button key={conv._id} onClick={() => openConversation(conv)} className={`w-full text-left p-3 border-b border-theme-border/50 hover:bg-theme-hover transition-colors ${activeConv?._id === conv._id ? 'bg-amber-500/10' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm flex-shrink-0">
                    {(other?.name || 'C')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-theme-primary truncate">{other?.name || 'Customer'}</p>
                      <span className="text-[10px] text-theme-dim">{timeSince(conv.lastMessage?.sentAt)}</span>
                    </div>
                    <p className="text-xs text-theme-muted truncate mt-0.5">{conv.lastMessage?.content || 'No messages yet'}</p>
                    {conv.productTitle && <p className="text-[10px] text-amber-500 truncate mt-0.5">Re: {conv.productTitle}</p>}
                  </div>
                  {unread > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unread}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Message area */}
        <div className={`flex-1 flex flex-col ${!activeConv ? 'hidden md:flex' : 'flex'}`}>
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center text-theme-muted text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 border-b border-theme-border">
                <button onClick={() => setActiveConv(null)} className="md:hidden p-1 text-theme-muted">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                  {(otherParticipant(activeConv)?.name || 'C')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-theme-primary">{otherParticipant(activeConv)?.name || 'Customer'}</p>
                  {activeConv.productTitle && <p className="text-[10px] text-amber-500">Re: {activeConv.productTitle}</p>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => {
                  const isMine = msg.senderId === user?._id;
                  return (
                    <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMine ? 'bg-amber-500 text-black rounded-br-md' : 'bg-theme-hover text-theme-primary rounded-bl-md'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-black/50' : 'text-theme-dim'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-theme-border">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-theme-input border border-theme-border rounded-full px-4 py-2 text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:border-amber-500"
                  />
                  <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="p-2 bg-amber-500 text-black rounded-full hover:bg-amber-400 disabled:opacity-50 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
