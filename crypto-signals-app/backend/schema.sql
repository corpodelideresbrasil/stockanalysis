-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    has_active_subscription BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL, -- e.g., 'active', 'canceled', 'past_due'
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Signals Table
CREATE TABLE signals (
    id SERIAL PRIMARY KEY,
    asset VARCHAR(50) NOT NULL, -- e.g., 'BTC/USD'
    type VARCHAR(50) NOT NULL, -- e.g., 'Compra', 'Venda', 'Espera'
    entry_price DECIMAL(18, 8),
    target_price DECIMAL(18, 8),
    stop_loss DECIMAL(18, 8),
    status VARCHAR(50) DEFAULT 'active', -- e.g., 'active', 'triggered', 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a default admin user (replace with a secure creation process later)
-- For development purposes only.
-- Make sure to change the password in a real environment.
INSERT INTO users (email, password_hash, is_admin, has_active_subscription) VALUES ('admin@example.com', 'supersecret-hashed-password', TRUE, TRUE);
