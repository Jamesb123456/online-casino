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
    <div className={`fixed bottom-0 right-4 z-50 flex flex-col rounded-t-lg shadow-lg transition-all duration-300 ${isOpen ? 'h-96' : 'h-12'}`}>
      {/* Chat Header */}
      <div 
        className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center rounded-t-lg cursor-pointer"
        onClick={toggleChat}
      >
        <div className="flex items-center">
          <h3 className="font-medium">Global Chat</h3>
          {!isOpen && messages.length > 0 && (
            <span className="ml-2 bg-amber-500 text-xs px-2 py-1 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <button className="text-gray-300 hover:text-white">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {/* Chat Messages */}
      {isOpen && (
        <>
          <div className="bg-gray-900 flex-1 p-4 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
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
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white uppercase">
                          {message.username?.[0] || '?'}
                        </div>
                      </div>
                    )}
                    
                    <div className={`${message.system ? 'text-center text-gray-500 text-sm italic' : 'bg-gray-800 rounded-lg p-3 max-w-[75%]'}`}>
                      {!message.system && (
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-amber-400">
                            {message.username || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      )}
                      <p className={`${message.system ? '' : 'text-white'}`}>
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
            <div className="bg-gray-900 px-4 py-1 text-xs text-gray-400">
              {typingUsers.length === 1
                ? `${typingUsers[0]} is typing...`
                : `${typingUsers.length} people are typing...`}
            </div>
          )}

          {/* Message Input */}
          <form 
            onSubmit={handleSubmit}
            className="bg-gray-800 p-2 flex items-center"
          >
            <input
              type="text"
              value={messageInput}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="bg-gray-700 text-white rounded-lg px-3 py-2 flex-1 focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={!isConnected}
            />
            <button
              type="submit"
              disabled={!messageInput.trim() || !isConnected}
              className="ml-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg p-2"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatBox;
