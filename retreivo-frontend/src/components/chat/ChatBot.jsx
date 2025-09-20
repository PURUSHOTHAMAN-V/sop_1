import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FiSend, FiMessageCircle, FiX } from 'react-icons/fi'
import './ChatBot.css' // We'll create this file next

export default function ChatBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Load chat history
  useEffect(() => {
    const fetchChatHistory = async () => {
      // For authenticated users, fetch chat history from API
      if (user) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/history`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch chat history');
          }
          
          const data = await response.json();
          
          if (data.ok && data.messages && data.messages.length > 0) {
            setChatHistory(data.messages);
          } else {
            // If no messages or empty response, show default welcome message
            setDefaultWelcomeMessage();
          }
        } catch (error) {
          console.error('Error fetching chat history:', error);
          setDefaultWelcomeMessage();
        }
      } else {
        // For non-authenticated users, show default welcome message
        setDefaultWelcomeMessage();
      }
    };
    
    const setDefaultWelcomeMessage = () => {
      const welcomeMessage = {
        message_id: 1,
        content: 'Hello! How can I help you today?',
        is_bot: true,
        created_at: new Date().toISOString()
      };
      setChatHistory([welcomeMessage]);
    };
    
    if (isOpen) {
      fetchChatHistory();
    }
  }, [user, isOpen]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async () => {
    try {
      setLoading(true);
      // Get chat history from API
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat history');
      }
      
      const data = await response.json();
      
      if (data.ok && data.messages) {
        setChatHistory(data.messages);
      } else {
        // Fallback welcome message if no history
        setChatHistory([
          { message_id: 1, content: 'Hello! I\'m here to help with anything you need. Feel free to ask about Retreivo or any other topic!', is_bot: true, created_at: new Date().toISOString() },
        ]);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      // Fallback welcome message on error
      setChatHistory([
        { message_id: 1, content: 'Hello! I\'m here to help with anything you need. Feel free to ask about Retreivo or any other topic!', is_bot: true, created_at: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    // Add user message to chat immediately for better UX
    const userMessage = {
      message_id: Date.now(),
      content: message,
      is_bot: false,
      created_at: new Date().toISOString()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      // For authenticated users, use the API
      if (user) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: userMessage.content
          })
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        
        if (data.ok && data.messages && data.messages.length > 1) {
          // The second message is the bot's response
          const botMessageObj = data.messages[1];
          setChatHistory(prev => [...prev, botMessageObj]);
        } else {
          throw new Error('Invalid response from server');
        }
      } else {
        // For non-authenticated users, use client-side logic
        setTimeout(() => {
          let botResponse = '';
          const lowerMessage = message.toLowerCase();
          
          // Retreivo-specific responses
          if (lowerMessage.includes('lost') || lowerMessage.includes('missing')) {
            botResponse = 'To report a lost item, please go to the "Report Lost Item" section and provide details about your item.';
          } else if (lowerMessage.includes('found')) {
            botResponse = 'Thank you for finding an item! Please go to the "Report Found Item" section to help return it to its owner.';
          } else if (lowerMessage.includes('reward') || lowerMessage.includes('points')) {
            botResponse = 'You can earn rewards by helping return lost items to their owners. Check your rewards balance in the "Rewards" section.';
          } else if (lowerMessage.includes('claim')) {
            botResponse = 'If you see your lost item in the search results, you can claim it by clicking the "Claim" button on the item.';
          } 
          // General responses
          else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            botResponse = 'Hello! I\'m here to help with anything you need. Feel free to ask me about Retreivo or any other topic.';
          } else if (lowerMessage.includes('weather')) {
            botResponse = 'I don\'t have real-time weather data, but I can suggest checking a weather app or website for the most accurate forecast.';
          } else if (lowerMessage.includes('time')) {
            botResponse = `The current time is ${new Date().toLocaleTimeString()}.`;
          } else if (lowerMessage.includes('date')) {
            botResponse = `Today's date is ${new Date().toLocaleDateString()}.`;
          } else if (lowerMessage.includes('joke')) {
            const jokes = [
              'Why don\'t scientists trust atoms? Because they make up everything!',
              'What do you call a fake noodle? An impasta!',
              'Why did the scarecrow win an award? Because he was outstanding in his field!',
              'I told my wife she was drawing her eyebrows too high. She looked surprised.',
              'What do you call a bear with no teeth? A gummy bear!'
            ];
            botResponse = jokes[Math.floor(Math.random() * jokes.length)];
          } else if (lowerMessage.includes('thank')) {
            botResponse = 'You\'re welcome! Is there anything else I can help you with?';
          } else if (lowerMessage.includes('name')) {
            botResponse = 'I\'m the Smart Assistant! I can help with Retreivo features and general questions too!';
          } else if (lowerMessage.includes('how are you')) {
            botResponse = 'I\'m doing well, thank you for asking! How can I assist you today?';
          } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
            botResponse = 'Goodbye! Feel free to chat again if you need any help.';
          } else if (lowerMessage.includes('help')) {
            botResponse = 'I can help with Retreivo features like reporting lost items, finding items, or claiming rewards. I can also answer general questions, tell jokes, or just chat!';
          } else {
            // General fallback response
            botResponse = 'I\'m here to help with both Retreivo features and general questions. Feel free to ask me about lost items, rewards, or anything else you\'re curious about!';
          }

          const botMessageObj = {
            message_id: Date.now() + 1,
            content: botResponse,
            is_bot: true,
            created_at: new Date().toISOString()
          };

          setChatHistory(prev => [...prev, botMessageObj]);
        }, 1000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add a fallback error message
      const errorMessage = {
        message_id: Date.now() + 1,
        content: 'Sorry, I encountered an error processing your request. Please try again later.',
        is_bot: true,
        created_at: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Remove the user check to make the chatbot visible for all users
  // if (!user) return null;

  return (
    <div className="chatbot-container">
      {/* Chat toggle button */}
      <button 
        className="chat-toggle-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chat"
      >
        {isOpen ? <FiX size={24} /> : <FiMessageCircle size={24} />}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <h3>Smart Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="close-button">
              <FiX size={18} />
            </button>
          </div>
          <div className="chat-messages">
            {chatHistory.map((chat) => (
              <div 
                key={chat.message_id} 
                className={`message ${chat.is_bot ? 'bot' : 'user'}`}
              >
                <div className="message-content">{chat.content}</div>
              </div>
            ))}
            {loading && <div className="message bot"><div className="loading-dots"><span>.</span><span>.</span><span>.</span></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              disabled={loading}
            />
            <button 
              onClick={handleSendMessage} 
              disabled={!message.trim() || loading}
              className="send-button"
            >
              <FiSend size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}