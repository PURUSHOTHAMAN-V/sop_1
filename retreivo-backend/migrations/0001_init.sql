-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15),
    password_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'citizen',
    digilocker_id VARCHAR(50),
    rewards_balance INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hubs table (referenced by found_items)
CREATE TABLE IF NOT EXISTS hubs (
    hub_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lost items table
CREATE TABLE IF NOT EXISTS lost_items (
    item_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    image_url VARCHAR(500),
    image_features JSONB,
    location VARCHAR(200),
    date_lost DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Found items table
CREATE TABLE IF NOT EXISTS found_items (
    item_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    hub_id INTEGER REFERENCES hubs(hub_id),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    image_url VARCHAR(500),
    image_features JSONB,
    location VARCHAR(200),
    date_found DATE,
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Additional tables (skeletons)
CREATE TABLE IF NOT EXISTS claims (
    claim_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    item_id INTEGER,
    item_type VARCHAR(10) CHECK (item_type IN ('lost','found')),
    status VARCHAR(20) DEFAULT 'pending',
    hub_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rewards (
    reward_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    amount INTEGER NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donations (
    donation_id SERIAL PRIMARY KEY,
    hub_id INTEGER REFERENCES hubs(hub_id),
    item_id INTEGER,
    item_type VARCHAR(10) CHECK (item_type IN ('lost','found')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_reports (
    fraud_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    score NUMERIC(4,3) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot tables
-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    conversation_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id),
    content TEXT NOT NULL,
    is_bot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chatbot predefined responses table
CREATE TABLE IF NOT EXISTS chatbot_responses (
    response_id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    keyword VARCHAR(100) NOT NULL,
    response_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some default chatbot responses
INSERT INTO chatbot_responses (category, keyword, response_text) VALUES
('greeting', 'hello', 'Hello! I''m here to help with anything you need. Feel free to ask me about Retreivo or any other topic.'),
('greeting', 'hi', 'Hi there! How can I assist you today?'),
('retreivo', 'lost', 'To report a lost item, please go to the "Report Lost Item" section and provide details about your item.'),
('retreivo', 'found', 'Thank you for finding an item! Please go to the "Report Found Item" section to help return it to its owner.'),
('retreivo', 'reward', 'You can earn rewards by helping return lost items to their owners. Check your rewards balance in the "Rewards" section.'),
('retreivo', 'claim', 'If you see your lost item in the search results, you can claim it by clicking the "Claim" button on the item.'),
('general', 'help', 'I can help with Retreivo features like reporting lost items, finding items, or claiming rewards. I can also answer general questions, tell jokes, or just chat!'),
('general', 'thanks', 'You''re welcome! Is there anything else I can help you with?'),
('general', 'bye', 'Goodbye! Feel free to chat again if you need any help.');








