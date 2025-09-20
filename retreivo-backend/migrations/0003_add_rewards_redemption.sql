-- Rewards redemption schema additions

CREATE TABLE IF NOT EXISTS reward_redemptions (
    redemption_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    type VARCHAR(20) CHECK (type IN ('cash','product')) NOT NULL,
    points_spent INTEGER NOT NULL,
    cash_value INTEGER, -- in INR, for type='cash'
    product_id INTEGER, -- for type='product'
    product_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_price INTEGER NOT NULL,
    partner_name VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed a few partner products
INSERT INTO partner_products (name, description, points_price, partner_name)
VALUES
('Laptop Sleeve', 'Protective sleeve for 13-14 inch laptops', 1000, 'Trusted Partner - TechGear'),
('Phone Case', 'Durable case for popular phone models', 500, 'Trusted Partner - CaseWorks'),
('Backpack Rain Cover', 'Waterproof rain cover for backpacks', 700, 'Trusted Partner - TravelPro')
ON CONFLICT DO NOTHING;




