import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import chatSocketService from '../../services/socket/chatSocketService';

/**
 * ChatBox Component
 * Displays a global chat interface for all authenticated users
 */
const ChatBox = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Connect to chat socket when component mounts
  useEffect(() => {
    if (user) {
      console.log('Attempting to connect to chat service...');
      chatSocketService.connect()
        .then(() => {
          setIsConnected(true);
          console.log('Connected to chat service');
        })
        .catch(err => {
          console.error('Failed to connect to chat:', err);
          // Try one more time after a short delay
          setTimeout(() => {
            console.log('Retrying chat connection...');
            chatSocketService.connect()
              .then(() => {
                setIsConnected(true);
                console.log('Connected to chat service on retry');
              })
              .catch(retryErr => {
                console.error('Failed to connect on retry:', retryErr);
              });
          }, 2000);
        });
      
      // Clean up on unmount
      return () => chatSocketService.disconnect();
    }
  }, [user]);

  // Set up event handlers
  useEffect(() => {
    if (user) {
      const handleNewMessage = (message) => {
        setMessages(prevMessages => [...prevMessages, message]);
      };

      const handlePreviousMessages = (previousMessages) => {
        setMessages(previousMessages);
      };

      const handleUserJoined = (data) => {
        // Add system message
        setMessages(prevMessages => [
          ...prevMessages,
          {
            _id: `system-${Date.now()}`,
            content: data.message,
            system: true,
            createdAt: data.timestamp
          }
        ]);
      };

      const handleUserLeft = (data) => {
        // Add system message
        setMessages(prevMessages => [
          ...prevMessages,
          {
            _id: `system-${Date.now()}`,
            content: data.message,
            system: true,
            createdAt: data.timestamp
          }
        ]);

        // Remove user from typing list if they were typing
        setTypingUsers(users => 
          users.filter(username => username !== data.user?.username)
        );
      };

      const handleUserTyping = (data) => {
        if (data.username !== user.username) {
          setTypingUsers(users => {
            if (!users.includes(data.username)) {
              return [...users, data.username];
            }
            return users;
          });
        }
      };

      const handleUserStoppedTyping = (data) => {
        setTypingUsers(users => 
          users.filter(username => username !== data.username)
        );
      };

      // Register event handlers
      const unsubscribeNewMessage = chatSocketService.on('newMessage', handleNewMessage);
      const unsubscribePreviousMessages = chatSocketService.on('previousMessages', handlePreviousMessages);
      const unsubscribeUserJoined = chatSocketService.on('userJoined', handleUserJoined);
      const unsubscribeUserLeft = chatSocketService.on('userLeft', handleUserLeft);
      const unsubscribeUserTyping = chatSocketService.on('userTyping', handleUserTyping);
      const unsubscribeUserStoppedTyping = chatSocketService.on('userStoppedTyping', handleUserStoppedTyping);

      // Cleanup
      return () => {
        unsubscribeNewMessage();
        unsubscribePreviousMessages();
        unsubscribeUserJoined();
        unsubscribeUserLeft();
        unsubscribeUserTyping();
        unsubscribeUserStoppedTyping();
      };
    }
  }, [user]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending messages
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (messageInput.trim() && isConnected) {
      chatSocketService.sendMessage(messageInput.trim());
      setMessageInput('');
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      chatSocketService.sendStopTyping();
    }
  };

  // Handle typing indicator
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    
    // Send typing indicator
    if (isConnected) {
      chatSocketService.sendTyping();
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set a timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        chatSocketService.sendStopTyping();
      }, 2000);
    }
  };

  // Toggle chat open/closed
  const toggleChat = () => {
    setIsOpen(prev => !prev);
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return null; // Don't render for unauthenticated users
  }

  return (
    <>
      {/* Chat toggle button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-20 right-4 lg:bottom-4 z-40 bg-accent-gold text-bg-base rounded-full w-12 h-12 shadow-glow-gold cursor-pointer flex items-center justify-center hover:bg-accent-gold-light transition-colors duration-200"
          aria-label="Open chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-status-error text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {messages.length > 99 ? '99+' : messages.length}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 lg:bottom-20 z-40 w-80 bg-bg-card border border-border rounded-xl shadow-card overflow-hidden flex flex-col" style={{ height: '384px' }}>
          {/* Header */}
          <div
            className="bg-bg-elevated p-3 border-b border-border flex justify-between items-center cursor-pointer"
            onClick={toggleChat}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-text-primary text-sm">Global Chat</h3>
              <span className="w-2 h-2 rounded-full bg-status-success"></span>
            </div>
            <button className="text-text-muted hover:text-text-primary transition-colors" aria-label="Close chat">
              &#10005;
            </button>
          </div>

          {/* Messages area */}
          <div className="bg-bg-base p-3 overflow-y-auto flex-1">
            {messages.length === 0 ? (
              <div className="text-center text-text-muted py-8 text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id || message._id || `msg-${Date.now()}-${Math.random()}`}
                    className={`flex ${message.system ? 'justify-center' : 'items-start'}`}
                  >
                    {!message.system && (
                      <div className="mr-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary text-xs uppercase font-bold">
                          {message.username?.[0] || '?'}
                        </div>
                      </div>
                    )}

                    <div className={`${message.system ? 'text-center text-text-muted text-xs italic' : 'bg-bg-elevated rounded-lg p-2.5 max-w-[75%]'}`}>
                      {!message.system && (
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-accent-gold text-xs">
                            {message.username || 'Unknown User'}
                          </span>
                          <span className="text-xs text-text-muted ml-2">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      )}
                      <p className={`text-sm ${message.system ? '' : 'text-text-primary'}`}>
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <div className="bg-bg-base px-3 py-1 text-xs text-text-muted border-t border-border">
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.length} people are typing...`}
            </div>
          )}

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="bg-bg-elevated p-3 border-t border-border flex items-center gap-2"
          >
            <input
              type="text"
              value={messageInput}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="bg-bg-surface border border-border text-text-primary rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold"
              disabled={!isConnected}
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || !isConnected}
              className="bg-accent-gold text-bg-base rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-gold-light transition-colors duration-200 cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBox;
