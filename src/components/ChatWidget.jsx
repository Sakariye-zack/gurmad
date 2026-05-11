import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { MessageCircle, X, Send, User, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatWidget = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null); // null for 'Everyone'
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadMessages, 3000); // Poll every 3s when open
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadData = async () => {
    try {
      const [msgData, userData] = await Promise.all([
        api.getMessages(currentUser.id),
        api.getUsers()
      ]);
      setMessages(msgData);
      setUsers(userData.filter(u => u.id !== currentUser.id));
    } catch (err) {
      console.error("Chat load error:", err);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await api.getMessages(currentUser.id);
      setMessages(data);
    } catch (err) {
      console.error("Chat polling error:", err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      await api.sendMessage({
        sender_id: currentUser.id,
        receiver_id: selectedRecipientId,
        content: newMessage
      });
      setNewMessage('');
      loadMessages();
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 10000 }}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{
              position: 'absolute',
              bottom: '80px',
              right: 0,
              width: '350px',
              height: '550px',
              backgroundColor: 'white',
              borderRadius: '20px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color)'
            }}
          >
            {/* Header */}
            <div style={{ 
              padding: '1.25rem', 
              backgroundColor: 'var(--gurmad-green)', 
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Team Chat</h4>
                  <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.8 }}>Secure communication</p>
                </div>
              </div>
              <X 
                size={20} 
                style={{ cursor: 'pointer', opacity: 0.8 }} 
                onClick={() => setIsOpen(false)} 
              />
            </div>

            {/* Recipient Selector */}
            <div style={{ padding: '0.75rem', backgroundColor: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
               <select 
                 value={selectedRecipientId || ''} 
                 onChange={(e) => setSelectedRecipientId(e.target.value ? parseInt(e.target.value) : null)}
                 style={{ 
                   flex: 1, padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', 
                   fontSize: '0.8rem', outline: 'none', backgroundColor: '#f8fafc' 
                 }}
               >
                 <option value="">Everyone (Team)</option>
                 {users.map(u => (
                   <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.role})</option>
                 ))}
               </select>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              style={{ 
                flex: 1, 
                padding: '1.25rem', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                backgroundColor: '#f8fafc'
              }}
            >
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No messages yet. Start the conversation!
                </div>
              ) : messages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                const isPrivate = msg.receiver_id !== null;
                
                return (
                  <div 
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    {!isMe && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '4px' }}>
                        {msg.sender_name} {isPrivate && <span style={{ color: 'var(--gurmad-orange)' }}>(Private)</span>}
                      </span>
                    )}
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      backgroundColor: isMe ? (isPrivate ? 'var(--gurmad-orange)' : 'var(--gurmad-green)') : 'white',
                      color: isMe ? 'white' : 'var(--text-main)',
                      fontSize: '0.85rem',
                      boxShadow: 'var(--shadow-sm)',
                      border: isMe ? 'none' : '1px solid #e2e8f0',
                      position: 'relative'
                    }}>
                      {msg.content}
                      {isMe && isPrivate && (
                         <div style={{ fontSize: '0.6rem', opacity: 0.8, marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '2px' }}>
                           To: {users.find(u => u.id === msg.receiver_id)?.full_name || 'User'}
                         </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Input Area */}
            <form 
              onSubmit={handleSend}
              style={{ 
                padding: '1rem', 
                backgroundColor: 'white',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px'
              }}
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#f1f5f9',
                  outline: 'none',
                  fontSize: '0.85rem'
                }}
              />
              <button
                type="submit"
                disabled={loading || !newMessage.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--gurmad-green)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (loading || !newMessage.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !newMessage.trim()) ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: 'var(--gurmad-green)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 30px rgba(63, 174, 42, 0.4)',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X size={28} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MessageCircle size={28} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default ChatWidget;
