import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { sendEmail as sendEmailUtil } from './utils/emailService.js';

const { Pool } = pkg;

// Email configuration
const gmailUser = (process.env.GMAIL_USER || 'guha91776@gmail.com').trim();
// Gmail app passwords are shown with spaces; remove any whitespace to be safe
const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPassword
  }
});

// Email helper functions
async function sendEmail(to, subject, html) {
  try {
    // Check if email is properly configured
    if (!gmailUser || !gmailAppPassword) {
      console.log('Email not configured - skipping email send');
      return { success: false, error: 'Email not configured - please set GMAIL_USER and GMAIL_APP_PASSWORD' };
    }

    const mailOptions = {
      from: gmailUser,
      to: to,
      subject: subject,
      html: html
    };
    
    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

async function sendClaimNotificationEmail(userEmail, itemName, status, hubMessage = '') {
  const statusMessages = {
    'approved': 'Your claim has been approved! You can now collect your item.',
    'rejected': 'Your claim has been rejected. Please contact the hub for more information.',
    'partial': 'Your claim requires additional verification. Please meet in person for verification.'
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Claim Status Update</h2>
      <p>Dear User,</p>
      <p>Your claim for <strong>${itemName}</strong> has been updated:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Status:</strong> ${status.toUpperCase()}</p>
        <p><strong>Message:</strong> ${statusMessages[status]}</p>
        ${hubMessage ? `<p><strong>Hub Message:</strong> ${hubMessage}</p>` : ''}
      </div>
      <p>Thank you for using Retreivo!</p>
      <hr>
      <p style="color: #666; font-size: 12px;">This is an automated message from Retreivo Lost & Found Platform</p>
    </div>
  `;

  return await sendEmail(userEmail, `Claim Update: ${itemName}`, html);
}

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Basic rate limit
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// Database
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:Vpcare@24x7@localhost:5432/retreivo';
const pool = new Pool({ connectionString: databaseUrl });
const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_me';

// JWT Middleware for protected routes
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Access token required' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, jwtSecret);
    
    // Add user info to request
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Token expired' });
    }
    return res.status(403).json({ ok: false, error: 'Invalid token' });
  }
};

// Health check endpoint that doesn't require database
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend service is running' });
});

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to) {
      return res.status(400).json({ ok: false, error: 'Email address required' });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Test Email from Retreivo</h2>
        <p>This is a test email to verify email functionality.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Message:</strong> ${message || 'Test message'}</p>
        </div>
        <p>If you receive this email, the email system is working correctly!</p>
        <hr>
        <p style="color: #666; font-size: 12px;">This is a test message from Retreivo Lost & Found Platform</p>
      </div>
    `;

    const result = await sendEmail(to, subject || 'Test Email from Retreivo', html);
    
    if (result.success) {
      res.json({ ok: true, message: 'Test email sent successfully', messageId: result.messageId });
    } else {
      res.status(500).json({ ok: false, error: result.error });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ ok: false, error: 'Failed to send test email' });
  }
});
// Simple email send endpoint
app.post('/api/email/send-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body || {};

    if (!to || !subject || !message) {
      return res.status(400).json({ ok: false, error: 'to, subject, and message are required' });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Claim Update</h2>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; white-space: pre-wrap;">
          ${String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
        <p style="color: #666; font-size: 12px;">This is an automated message from Retreivo</p>
      </div>
    `;

    const result = await sendEmailUtil({ to, subject, text: message, html });
    if (result.ok) {
      return res.json({ ok: true, messageId: result.messageId });
    }
    return res.status(500).json({ ok: false, error: result.error || 'Failed to send email' });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ ok: false, error: error?.message || 'Internal server error' });
  }
});

// Hub email endpoint
app.post('/api/hub/send-email', authenticateToken, async (req, res) => {
  try {
    const { to, subject, html, emailConfig } = req.body;
    
    if (!to) {
      return res.status(400).json({ ok: false, error: 'Email address required' });
    }

    // Use provided email configuration or default to system config
    let emailResult;
    if (emailConfig && emailConfig.enabled) {
      // Custom email configuration
      const customTransporter = nodemailer.createTransport({
        service: emailConfig.service || 'gmail',
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password
        }
      });
      
      const mailOptions = {
        from: emailConfig.user,
        to: to,
        subject: subject,
        html: html
      };
      
      try {
        const result = await customTransporter.sendMail(mailOptions);
        emailResult = { success: true, messageId: result.messageId };
      } catch (emailError) {
        console.error('Custom email error:', emailError);
        emailResult = { success: false, error: emailError.message };
      }
    } else {
      // Use system email configuration
      emailResult = await sendEmail(to, subject, html);
    }
    
    if (emailResult.success) {
      res.json({ ok: true, message: 'Email sent successfully', messageId: emailResult.messageId });
    } else {
      res.status(500).json({ ok: false, error: emailResult.error });
    }
  } catch (error) {
    console.error('Hub email error:', error);
    res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: result.rows[0].ok === 1, message: 'Backend service is running with database connection' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing required fields: name, email, and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const result = await pool.query(
      'INSERT INTO users(name, email, phone, password_hash, role) VALUES($1, $2, $3, $4, $5) RETURNING user_id, name, email, role, created_at',
      [name, email, phone || null, hashedPassword, 'citizen']
    );
    
    const user = result.rows[0];
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: user.user_id, 
        email: user.email, 
        role: user.role 
      }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );
    
    console.log(`User created successfully: ${user.email}`);
    
    res.status(201).json({ 
      ok: true, 
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }, 
      token 
    });
    
  } catch (err) {
    console.error('Signup error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: 'Email already exists' });
    }
    res.status(500).json({ ok: false, error: 'Internal server error during signup' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT user_id, name, email, role, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rowCount === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log(`Failed login attempt for email: ${email}`);
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: user.user_id, 
        email: user.email, 
        role: user.role 
      }, 
      jwtSecret, 
      { expiresIn: '7d' }
    );
    
    console.log(`User logged in successfully: ${user.email}`);
    
    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;
    
    res.json({ 
      ok: true, 
      user: userWithoutPassword, 
      token 
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error during login' });
  }
});

// Get current user profile
app.get('/api/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      const result = await pool.query(
        'SELECT user_id, name, email, phone, role, rewards_balance, created_at FROM users WHERE user_id = $1',
        [decoded.sub]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }
      
      res.json({ ok: true, user: result.rows[0] });
    } catch (jwtError) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
    
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// Update user profile
app.put('/api/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      const { name, phone } = req.body || {};
      
      if (!name) {
        return res.status(400).json({ ok: false, error: 'Name is required' });
      }
      
      const result = await pool.query(
        'UPDATE users SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 RETURNING user_id, name, email, phone, role, rewards_balance, updated_at',
        [name, phone || null, decoded.sub]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ ok: false, error: 'User not found' });
      }
      
      res.json({ ok: true, user: result.rows[0] });
    } catch (jwtError) {
      return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
    }
    
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/api/auth/otp-verify', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
app.post('/api/auth/digilocker', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
app.post('/api/auth/refresh', (_req, res) => res.status(501).json({ message: 'Not implemented' }));

// User endpoints (protected)
app.post('/api/user/report-lost', authenticateToken, async (req, res) => {
  try {
    const { name, category, description, location, date_lost, images, contact_email } = req.body || {};
    const userId = req.user.sub;
    
    if (!name || !description) {
      return res.status(400).json({ ok: false, error: 'Name and description are required' });
    }
    
    // Insert into database (persist preview image as image_url if provided)
    const imageUrl = images && images.length > 0 ? images[0] : null;
    const result = await pool.query(
      'INSERT INTO lost_items(user_id, name, category, description, location, date_lost, contact_email, image_url) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING item_id, name, category, description, location, date_lost, contact_email, image_url, status, created_at',
      [userId, name, category || null, description, location || null, date_lost || null, contact_email || null, imageUrl]
    );
    
    const item = result.rows[0];
    
    // Store item in ML service for future matching
    try {
      const mlResponse = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:5002'}/store-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.item_id,
          item_type: 'lost',
          item_name: name,
          category,
          description,
          location,
          date: date_lost,
          image: imageUrl
        })
      });
      
      const mlData = await mlResponse.json();
      if (!mlData.ok) {
        console.warn('ML service warning:', mlData);
      } else {
        console.log('Item stored in ML service:', mlData);
      }
    } catch (mlErr) {
      // Don't fail the request if ML service is down
      console.error('ML service error:', mlErr);
    }
    
    res.status(201).json({ 
      ok: true, 
      item,
      available_for_matching: true
    });
  } catch (err) {
    console.error('Report lost item error:', err);
    res.status(500).json({ ok: false, error: 'Failed to report lost item' });
  }
});

app.post('/api/user/report-found', authenticateToken, async (req, res) => {
  try {
    const { name, category, description, location, date_found, images, contact_email } = req.body || {};
    const userId = req.user.sub;
    
    if (!name || !description) {
      return res.status(400).json({ ok: false, error: 'Name and description are required' });
    }
    
    // Insert into database (persist preview image as image_url if provided)
    const imageUrl = images && images.length > 0 ? images[0] : null;
    const result = await pool.query(
      'INSERT INTO found_items(user_id, name, category, description, location, date_found, contact_email, image_url) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING item_id, name, category, description, location, date_found, contact_email, image_url, status, created_at',
      [userId, name, category || null, description, location || null, date_found || null, contact_email || null, imageUrl]
    );
    
    const item = result.rows[0];
    
    // Store item in ML service for future matching
    try {
      const mlResponse = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:5002'}/store-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.item_id,
          item_type: 'found',
          item_name: name,
          category,
          description,
          location,
          date: date_found,
          image: imageUrl
        })
      });
      
      const mlData = await mlResponse.json();
      if (!mlData.ok) {
        console.warn('ML service warning:', mlData);
      } else {
        console.log('Item stored in ML service:', mlData);
      }
    } catch (mlErr) {
      // Don't fail the request if ML service is down
      console.error('ML service error:', mlErr);
    }
    
    // Award 10 reward points to the finder
    try {
      await pool.query('UPDATE users SET rewards_balance = rewards_balance + $1 WHERE user_id = $2', [10, userId]);
      await pool.query('INSERT INTO rewards(user_id, amount, reason) VALUES($1, $2, $3)', [userId, 10, `👍 Reported found item "${name}"`]);
    } catch (rewardsErr) {
      console.error('Failed to award finder rewards:', rewardsErr);
    }

    res.status(201).json({ ok: true, item, available_for_matching: true });
  } catch (err) {
    console.error('Report found item error:', err);
    res.status(500).json({ ok: false, error: 'Failed to report found item' });
  }
});

// Rewards: get balance and history
app.get('/api/rewards', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const [userRow, history, redemptions] = await Promise.all([
      pool.query('SELECT rewards_balance FROM users WHERE user_id = $1', [userId]),
      pool.query('SELECT reward_id, amount, reason, created_at FROM rewards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]),
      pool.query('SELECT redemption_id, type, points_spent, cash_value, product_name, created_at FROM reward_redemptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId])
    ]);
    res.json({ ok: true, balance: userRow.rows[0]?.rewards_balance || 0, earnings: history.rows, redemptions: redemptions.rows });
  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch rewards' });
  }
});

// Rewards: list partner products
app.get('/api/rewards/products', async (_req, res) => {
  try {
    const r = await pool.query('SELECT product_id, name, description, points_price, partner_name FROM partner_products WHERE active = TRUE ORDER BY points_price ASC');
    res.json({ ok: true, products: r.rows });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ ok: false, error: 'Failed to list products' });
  }
});

// Rewards: redeem cash (1 point = 1 INR)
app.post('/api/rewards/redeem/cash', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.sub;
    const { points } = req.body || {};
    const pts = Math.max(0, parseInt(points || 0, 10));
    if (pts <= 0) return res.status(400).json({ ok: false, error: 'Points must be > 0' });

    await client.query('BEGIN');
    const balRes = await client.query('SELECT rewards_balance FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = balRes.rows[0]?.rewards_balance || 0;
    if (balance < pts) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Insufficient points' });
    }
    await client.query('UPDATE users SET rewards_balance = rewards_balance - $1 WHERE user_id = $2', [pts, userId]);
    await client.query(
      'INSERT INTO reward_redemptions(user_id, type, points_spent, cash_value) VALUES($1, $2, $3, $4)',
      [userId, 'cash', pts, pts]
    );
    await client.query('COMMIT');
    res.json({ ok: true, message: `Redeemed ₹${pts}`, points_spent: pts, cash_value: pts });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Redeem cash error:', error);
    res.status(500).json({ ok: false, error: 'Failed to redeem cash' });
  } finally {
    client.release();
  }
});

// Rewards: redeem a partner product
app.post('/api/rewards/redeem/product', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId = req.user.sub;
    const { product_id } = req.body || {};
    if (!product_id) return res.status(400).json({ ok: false, error: 'product_id required' });

    await client.query('BEGIN');
    const pRes = await client.query('SELECT product_id, name, points_price FROM partner_products WHERE product_id = $1 AND active = TRUE', [product_id]);
    if (pRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }
    const product = pRes.rows[0];
    const balRes = await client.query('SELECT rewards_balance FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = balRes.rows[0]?.rewards_balance || 0;
    if (balance < product.points_price) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Insufficient points' });
    }
    await client.query('UPDATE users SET rewards_balance = rewards_balance - $1 WHERE user_id = $2', [product.points_price, userId]);
    await client.query(
      'INSERT INTO reward_redemptions(user_id, type, points_spent, product_id, product_name) VALUES($1, $2, $3, $4, $5)',
      [userId, 'product', product.points_price, product.product_id, product.name]
    );
    await client.query('COMMIT');
    res.json({ ok: true, message: `Redeemed ${product.name}`, points_spent: product.points_price, product });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Redeem product error:', error);
    res.status(500).json({ ok: false, error: 'Failed to redeem product' });
  } finally {
    client.release();
  }
});

app.get('/api/user/reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const [lostItems, foundItems] = await Promise.all([
      pool.query('SELECT * FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      pool.query('SELECT * FROM found_items WHERE user_id = $1 ORDER BY created_at DESC', [userId])
    ]);
    
    res.json({ 
      ok: true, 
      lost_items: lostItems.rows,
      found_items: foundItems.rows
    });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch reports' });
  }
});

// Dedicated image search endpoint
app.post('/api/user/search-by-image', authenticateToken, async (req, res) => {
  try {
    const { image, item_name, category, description, location, date } = req.body || {};
    const userId = req.user.sub;
    
    if (!image) {
      return res.status(400).json({ ok: false, error: 'Image is required for image search' });
    }
    
    // Call ML service for image similarity search
    try {
      const mlResponse = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:5002'}/search-by-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: image,
          item_type: 'lost',  // We're searching for lost items
          limit: 20
        })
      });
      
      const mlData = await mlResponse.json();
      if (!mlData.ok) {
        console.warn('ML service warning:', mlData);
        return res.status(500).json({ ok: false, error: 'Image search failed' });
      }
      
      // Get full item details from database for matched items
      if (mlData.results && mlData.results.length > 0) {
        const itemIds = mlData.results.map(r => r.item_id);
        const dbResults = await pool.query(`
          SELECT 'found' as type, item_id, name, category, description, location, date_found as date, status, created_at, image_url
          FROM found_items 
          WHERE item_id = ANY($1) AND status IN ('available', 'pending_claim')
        `, [itemIds]);
        
        // Combine ML scores with database results
        const enhancedResults = dbResults.rows.map(dbItem => {
          const mlItem = mlData.results.find(r => r.item_id === dbItem.item_id);
          return {
            ...dbItem,
            match_score: mlItem ? mlItem.similarity_score : 0,
            image_similarity: mlItem ? mlItem.similarity_score : 0,
            match_confidence: mlItem ? mlItem.match_confidence : 'Low',
            search_method: 'ml_image_similarity'
          };
        });
        
        // Sort by similarity score
        enhancedResults.sort((a, b) => b.image_similarity - a.image_similarity);
        
        return res.json({ 
          ok: true, 
          results: enhancedResults,
          match_found: enhancedResults.length > 0,
          best_match_score: enhancedResults.length > 0 ? enhancedResults[0].image_similarity : 0,
          search_method: 'ml_image_similarity',
          total_matches: enhancedResults.length
        });
      } else {
        return res.json({ 
          ok: true, 
          results: [],
          match_found: false,
          best_match_score: 0,
          search_method: 'ml_image_similarity',
          total_matches: 0
        });
      }
    } catch (mlErr) {
      console.error('ML service error:', mlErr);
      return res.status(500).json({ ok: false, error: 'Image search service unavailable' });
    }
  } catch (err) {
    console.error('Image search error:', err);
    res.status(500).json({ ok: false, error: 'Image search failed' });
  }
});

app.post('/api/user/search', authenticateToken, async (req, res) => {
  try {
    const { query, category, location, item_name, description, date, images } = req.body || {};
    const userId = req.user.sub;
    
    // If we have images or detailed metadata, use ML service for advanced matching
    if (images && images.length > 0) {
      try {
        // Call ML service for image matching
        const mlResponse = await fetch(`${process.env.ML_SERVICE_URL || 'http://localhost:5002'}/match-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_type: 'lost',  // We're searching for a lost item
            item_name: item_name || query,
            category,
            description,
            location,
            date,
            image: images[0]
          })
        });
        
        const mlData = await mlResponse.json();
        if (!mlData.ok) {
          console.warn('ML service warning:', mlData);
          // Fall back to database search
        } else {
          // Process ML results
          const mlResults = mlData.results || [];
          
          // Fetch full item details from database for the matched items
          if (mlResults.length > 0) {
            const itemIds = mlResults.map(r => r.item_id);
            const dbResults = await pool.query(`
              SELECT 'found' as type, item_id, name, category, description, location, date_found as date, status, created_at
              FROM found_items 
              WHERE item_id = ANY($1) AND status IN ('available', 'pending_claim')
            `, [itemIds]);
            
            // Combine ML scores with database results
            const enhancedResults = dbResults.rows.map(dbItem => {
              const mlItem = mlResults.find(r => r.item_id === dbItem.item_id);
              return {
                ...dbItem,
                match_score: mlItem ? mlItem.match_score : 0,
                image_similarity: mlItem ? mlItem.image_similarity : 0,
                metadata_similarity: mlItem ? mlItem.metadata_similarity : 0,
                next_step: mlItem ? mlItem.next_step : 'reject'
              };
            });
            
            return res.json({ 
              ok: true, 
              results: enhancedResults,
              match_found: enhancedResults.length > 0,
              best_match_score: enhancedResults.length > 0 ? enhancedResults[0].match_score : 0,
              search_method: 'ml_service'
            });
          }
        }
      } catch (mlErr) {
        console.error('ML service error:', mlErr);
        // Fall back to database search
      }
    }
    
    // Traditional database search as fallback
    if (!query && !category && !location) {
      return res.status(400).json({ ok: false, error: 'Search query, category, or location is required' });
    }
    
    // Search in both lost and found items
    // Include items that are available OR pending claim (so multiple users can see them until hub approval)
    // Only include basic details for security - no personal contact info
    const searchQuery = `
      SELECT 'lost' as type, item_id, name, category, description, location, date_lost as date, status, created_at, image_url
      FROM lost_items 
      WHERE (name ILIKE $1 OR description ILIKE $1 OR $1 IS NULL) 
        AND ($2::text IS NULL OR category = $2)
        AND ($3::text IS NULL OR location ILIKE $3)
        AND status IN ('active', 'pending_claim')
      UNION ALL
      SELECT 'found' as type, item_id, name, category, description, location, date_found as date, status, created_at, image_url
      FROM found_items 
      WHERE (name ILIKE $1 OR description ILIKE $1 OR $1 IS NULL) 
        AND ($2::text IS NULL OR category = $2)
        AND ($3::text IS NULL OR location ILIKE $3)
        AND status IN ('available', 'pending_claim')
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    const result = await pool.query(searchQuery, [
      query ? `%${query}%` : null, 
      category || null, 
      location ? `%${location}%` : null
    ]);
    
    res.json({ 
      ok: true, 
      results: result.rows,
      search_method: 'database'
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ ok: false, error: 'Search failed' });
  }
});

app.post('/api/user/claim', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { item_id, item_type } = req.body || {};
    const userId = req.user.sub;
    
    if (!item_id || !item_type) {
      return res.status(400).json({ ok: false, error: 'Item ID and type are required' });
    }
    
    if (!['lost', 'found'].includes(item_type)) {
      return res.status(400).json({ ok: false, error: 'Invalid item type' });
    }
    
    await client.query('BEGIN');
    
    // First, check if the item is available for claiming
    let itemStatus;
    if (item_type === 'found') {
      const itemResult = await client.query('SELECT status FROM found_items WHERE item_id = $1', [item_id]);
      if (itemResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Item not found' });
      }
      itemStatus = itemResult.rows[0].status;
      
      if (itemStatus !== 'available') {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Item is not available for claiming' });
      }
      
      // Don't change item status immediately - keep it visible to other users until hub approval
      // The item will remain 'available' and visible in search results
    } else if (item_type === 'lost') {
      const itemResult = await client.query('SELECT status FROM lost_items WHERE item_id = $1', [item_id]);
      if (itemResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'Item not found' });
      }
      itemStatus = itemResult.rows[0].status;
      
      if (itemStatus !== 'active') {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'Item is not available for claiming' });
      }
      
      // Don't change item status immediately - keep it visible to other users until hub approval
      // The item will remain 'active' and visible in search results
    }
    
    // Create the claim
    const result = await client.query(
      'INSERT INTO claims(user_id, item_id, item_type, status) VALUES($1, $2, $3, $4) RETURNING claim_id, user_id, item_id, item_type, status, created_at',
      [userId, item_id, item_type, 'pending']
    );
    
    // Mark the item as pending_claim but keep it visible in searches
    if (item_type === 'found') {
      await client.query("UPDATE found_items SET status = 'pending_claim' WHERE item_id = $1 AND status = 'available'", [item_id]);
    } else {
      await client.query("UPDATE lost_items SET status = 'pending_claim' WHERE item_id = $1 AND status = 'active'", [item_id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, claim: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Claim error:', err);
    res.status(500).json({ ok: false, error: 'Failed to create claim' });
  } finally {
    client.release();
  }
});

// Get user's claim history
app.get('/api/user/claim-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const claims = await pool.query(`
      SELECT c.claim_id, c.item_id, c.item_type, c.status, c.hub_message, c.created_at,
             COALESCE(f.name, l.name) as item_name,
             COALESCE(f.description, l.description) as item_description,
             COALESCE(f.location, l.location) as item_location,
             COALESCE(f.date_found, l.date_lost) as item_date
      FROM claims c
      LEFT JOIN found_items f ON c.item_id = f.item_id AND c.item_type = 'found'
      LEFT JOIN lost_items l ON c.item_id = l.item_id AND c.item_type = 'lost'
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [userId]);
    
    res.json({ 
      ok: true, 
      claims: claims.rows
    });
  } catch (err) {
    console.error('Get claim history error:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch claim history' });
  }
});

app.get('/api/user/rewards', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    const [userRewards, rewardHistory] = await Promise.all([
      pool.query('SELECT rewards_balance FROM users WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM rewards WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId])
    ]);
    
    res.json({ 
      ok: true, 
      balance: userRewards.rows[0]?.rewards_balance || 0,
      history: rewardHistory.rows
    });
  } catch (err) {
    console.error('Get rewards error:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch rewards' });
  }
});

// Helper function to calculate fraud score
const calculateFraudScore = async (userId, itemId, itemType) => {
  try {
    // Get user's claim history
    const userClaims = await pool.query(`
      SELECT COUNT(*) as total_claims, 
             COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_claims,
             COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_claims
      FROM claims 
      WHERE user_id = $1
    `, [userId]);
    
    const { total_claims, approved_claims, rejected_claims } = userClaims.rows[0];
    
    // Get user's account age
    const userAccount = await pool.query(`
      SELECT created_at FROM users WHERE user_id = $1
    `, [userId]);
    
    const accountAge = userAccount.rows[0] ? 
      (Date.now() - new Date(userAccount.rows[0].created_at)) / (1000 * 60 * 60 * 24) : 0;
    
    // Calculate fraud score based on multiple factors
    let fraudScore = 0;
    
    // Factor 1: Claim success rate (lower is more suspicious)
    if (total_claims > 0) {
      const successRate = approved_claims / total_claims;
      if (successRate < 0.3) fraudScore += 30;
      else if (successRate < 0.5) fraudScore += 15;
    }
    
    // Factor 2: Account age (newer accounts are more suspicious)
    if (accountAge < 7) fraudScore += 25;
    else if (accountAge < 30) fraudScore += 10;
    
    // Factor 3: Claim frequency (too many claims in short time)
    const recentClaims = await pool.query(`
      SELECT COUNT(*) as recent_claims
      FROM claims 
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    `, [userId]);
    
    if (recentClaims.rows[0].recent_claims > 5) fraudScore += 20;
    else if (recentClaims.rows[0].recent_claims > 3) fraudScore += 10;
    
    // Factor 4: Item value estimation (higher value items are riskier)
    const itemDetails = await pool.query(`
      SELECT name, category, description 
      FROM ${itemType === 'found' ? 'found_items' : 'lost_items'} 
      WHERE item_id = $1
    `, [itemId]);
    
    if (itemDetails.rows[0]) {
      const { name, category } = itemDetails.rows[0];
      const highValueKeywords = ['iphone', 'laptop', 'watch', 'jewelry', 'gold', 'diamond', 'camera'];
      const isHighValue = highValueKeywords.some(keyword => 
        name.toLowerCase().includes(keyword) || category.toLowerCase().includes(keyword)
      );
      
      if (isHighValue) fraudScore += 15;
    }
    
    // Cap fraud score at 100
    return Math.min(fraudScore, 100);
  } catch (err) {
    console.error('Error calculating fraud score:', err);
    return 50; // Default moderate risk
  }
};

// Hub endpoints
// Enhanced claims endpoint with ML matching and fraud detection
app.get('/api/hub/claims', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const fraudScoreMin = req.query.fraud_score_min || 0;
    const fraudScoreMax = req.query.fraud_score_max || 100;

    const foundClaims = await pool.query(`
      SELECT c.claim_id, c.user_id AS claimer_user_id, c.item_id, c.item_type, c.status, c.created_at,
             f.name AS item_name, f.description AS item_description, f.location AS item_location,
             f.user_id AS finder_user_id, f.date_found,
             u.name AS claimer_name, u.email AS claimer_email, u.phone AS claimer_phone
      FROM claims c
      JOIN found_items f ON c.item_id = f.item_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.item_type = 'found' AND c.status = $1
      ORDER BY c.created_at DESC
    `, [status]);

    const lostClaims = await pool.query(`
      SELECT c.claim_id, c.user_id AS claimer_user_id, c.item_id, c.item_type, c.status, c.created_at,
             l.name AS item_name, l.description AS item_description, l.location AS item_location,
             l.date_lost, NULL::INTEGER AS finder_user_id,
             u.name AS claimer_name, u.email AS claimer_email, u.phone AS claimer_phone
      FROM claims c
      JOIN lost_items l ON c.item_id = l.item_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.item_type = 'lost' AND c.status = $1
      ORDER BY c.created_at DESC
    `, [status]);

    // Calculate fraud scores for all claims using ML service
    const allClaims = [...foundClaims.rows, ...lostClaims.rows];
    const claimsWithFraudScores = await Promise.all(
      allClaims.map(async (claim) => {
        try {
          // Prefer ML compare between user's most recent lost report and the found item when possible
          let fraudScoreFromMl = null;
          let indicators = [];

          if (claim.item_type === 'found') {
            // Compare the claimer's most recent lost item against this found item
            const [lostRes, foundRes] = await Promise.all([
              pool.query(
                `SELECT item_id, name, category, description, location, date_lost AS date, image_url AS image
                 FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [claim.claimer_user_id]
              ),
              pool.query(
                `SELECT item_id, name, category, description, location, date_found AS date, image_url AS image
                 FROM found_items WHERE item_id = $1`,
                [claim.item_id]
              )
            ]);

            if (lostRes.rows.length > 0 && foundRes.rows.length > 0) {
              const lostItem = lostRes.rows[0];
              const foundItem = foundRes.rows[0];
              const r = await fetch(`${mlServiceBaseUrl}/compare-items`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ lost_item: lostItem, found_item: foundItem })
              });
              if (r.ok) {
                const ml = await r.json();
                if (ml && ml.ok) {
                  fraudScoreFromMl = typeof ml.fraud_probability === 'number' ? ml.fraud_probability : null;
                  indicators = Array.isArray(ml.explanation) ? ml.explanation : [];
                }
              }
            }
          }

          const fraudScore = fraudScoreFromMl != null ? fraudScoreFromMl : await calculateFraudScore(claim.user_id, claim.item_id, claim.item_type);

          return {
            ...claim,
            fraud_score: fraudScore,
            fraud_indicators: indicators,
            risk_level: fraudScore < 20 ? 'Low' : fraudScore < 50 ? 'Medium' : fraudScore < 80 ? 'High' : 'Critical'
          };
        } catch (error) {
          console.error('Error calculating fraud score:', error);
          const fraudScore = await calculateFraudScore(claim.user_id, claim.item_id, claim.item_type);
          return {
            ...claim,
            fraud_score: fraudScore,
            fraud_indicators: [],
            risk_level: fraudScore < 20 ? 'Low' : fraudScore < 50 ? 'Medium' : fraudScore < 80 ? 'High' : 'Critical'
          };
        }
      })
    );

    // Filter by fraud score range
    const filteredClaims = claimsWithFraudScores.filter(claim => 
      claim.fraud_score >= fraudScoreMin && claim.fraud_score <= fraudScoreMax
    );

    res.json({ ok: true, claims: filteredClaims });
  } catch (err) {
    console.error('List claims error:', err);
    res.status(500).json({ ok: false, error: 'Failed to list claims' });
  }
});

// Export claims as CSV (applies same fraud scoring and filters)
app.get('/api/hub/claims/export', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const fraudScoreMin = Number(req.query.fraud_score_min || 0);
    const fraudScoreMax = Number(req.query.fraud_score_max || 100);

    const foundClaims = await pool.query(`
      SELECT c.claim_id, c.user_id AS claimer_user_id, c.item_id, c.item_type, c.status, c.created_at,
             f.name AS item_name, f.description AS item_description, f.location AS item_location,
             f.user_id AS finder_user_id, f.date_found,
             u.name AS claimer_name, u.email AS claimer_email, u.phone AS claimer_phone
      FROM claims c
      JOIN found_items f ON c.item_id = f.item_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.item_type = 'found' AND c.status = $1
      ORDER BY c.created_at DESC
    `, [status]);

    const lostClaims = await pool.query(`
      SELECT c.claim_id, c.user_id AS claimer_user_id, c.item_id, c.item_type, c.status, c.created_at,
             l.name AS item_name, l.description AS item_description, l.location AS item_location,
             l.date_lost, NULL::INTEGER AS finder_user_id,
             u.name AS claimer_name, u.email AS claimer_email, u.phone AS claimer_phone
      FROM claims c
      JOIN lost_items l ON c.item_id = l.item_id
      JOIN users u ON c.user_id = u.user_id
      WHERE c.item_type = 'lost' AND c.status = $1
      ORDER BY c.created_at DESC
    `, [status]);

    const allClaims = [...foundClaims.rows, ...lostClaims.rows];

    const claimsWithFraudScores = await Promise.all(
      allClaims.map(async (claim) => {
        try {
          // Try ML scoring for found claims using compare-items
          let fraudScoreFromMl = null;
          if (claim.item_type === 'found') {
            const [lostRes, foundRes] = await Promise.all([
              pool.query(
                `SELECT item_id, name, category, description, location, date_lost AS date, image_url AS image
                 FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [claim.claimer_user_id]
              ),
              pool.query(
                `SELECT item_id, name, category, description, location, date_found AS date, image_url AS image
                 FROM found_items WHERE item_id = $1`,
                [claim.item_id]
              )
            ]);
            if (lostRes.rows.length > 0 && foundRes.rows.length > 0) {
              const r = await fetch(`${mlServiceBaseUrl}/compare-items`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ lost_item: lostRes.rows[0], found_item: foundRes.rows[0] })
              });
              if (r.ok) {
                const ml = await r.json();
                if (ml && ml.ok && typeof ml.fraud_probability === 'number') {
                  fraudScoreFromMl = ml.fraud_probability;
                }
              }
            }
          }
          const fraudScore = fraudScoreFromMl != null ? fraudScoreFromMl : await calculateFraudScore(claim.user_id, claim.item_id, claim.item_type);
          return { ...claim, fraud_score: fraudScore };
        } catch (e) {
          const fraudScore = await calculateFraudScore(claim.user_id, claim.item_id, claim.item_type);
          return { ...claim, fraud_score: fraudScore };
        }
      })
    );

    const filtered = claimsWithFraudScores.filter(c => c.fraud_score >= fraudScoreMin && c.fraud_score <= fraudScoreMax);

    // Build CSV
    const headers = [
      'claim_id','item_type','status','created_at','item_name','item_location','claimer_name','claimer_email','claimer_phone','fraud_score'
    ];
    const rows = filtered.map(c => [
      c.claim_id,
      c.item_type,
      c.status,
      new Date(c.created_at).toISOString(),
      (c.item_name || '').replace(/\n|\r|,/g, ' '),
      (c.item_location || '').replace(/\n|\r|,/g, ' '),
      (c.claimer_name || '').replace(/\n|\r|,/g, ' '),
      (c.claimer_email || '').replace(/\n|\r|,/g, ' '),
      (c.claimer_phone || '').replace(/\n|\r|,/g, ' '),
      Math.round(c.fraud_score)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `claims_export_${status}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export claims error:', error);
    res.status(500).json({ ok: false, error: 'Failed to export claims' });
  }
});

// Approve claim and reward finder
app.put('/api/hub/claim/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    const claimId = Number(req.params.id);
    const { message } = req.body || {};
    await client.query('BEGIN');

    const claimRes = await client.query(`
      SELECT c.*, 
             COALESCE(f.name, l.name) as item_name,
             COALESCE(f.description, l.description) as item_description
      FROM claims c
      LEFT JOIN found_items f ON c.item_id = f.item_id AND c.item_type = 'found'
      LEFT JOIN lost_items l ON c.item_id = l.item_id AND c.item_type = 'lost'
      WHERE c.claim_id = $1
    `, [claimId]);
    if (claimRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Claim not found' });
    }
    const claim = claimRes.rows[0];
    if (claim.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Claim is not pending' });
    }

    // Update claim status
    await client.query('UPDATE claims SET status = $1, hub_message = $2 WHERE claim_id = $3', 
      ['approved', message || 'Claim approved by hub', claimId]);

    // If this is a found item claim, mark item claimed and reward finder
    if (claim.item_type === 'found') {
      const foundItemRes = await client.query('SELECT user_id FROM found_items WHERE item_id = $1 FOR UPDATE', [claim.item_id]);
      const finderUserId = foundItemRes.rows[0]?.user_id;
      await client.query("UPDATE found_items SET status = 'claimed' WHERE item_id = $1", [claim.item_id]);
      
      // Reward the finder
      if (finderUserId) {
        const rewardAmount = 100; // Base reward amount
        await client.query('UPDATE users SET rewards_balance = rewards_balance + $1 WHERE user_id = $2', [rewardAmount, finderUserId]);
        // Get item name for reward record
        const itemRes = await client.query('SELECT name FROM found_items WHERE item_id = $1', [claim.item_id]);
        const itemName = itemRes.rows[0]?.name || 'Unknown Item';
        await client.query('INSERT INTO rewards(user_id, amount, reason) VALUES($1, $2, $3)', 
          [finderUserId, rewardAmount, `🎉 Found item "${itemName}" successfully claimed and verified! You helped reunite someone with their lost item.`]);
      }
    } else if (claim.item_type === 'lost') {
      // For lost item claim approval, mark lost item resolved and reward the original reporter
      const lostItemRes = await client.query('SELECT user_id FROM lost_items WHERE item_id = $1 FOR UPDATE', [claim.item_id]);
      const reporterUserId = lostItemRes.rows[0]?.user_id;
      await client.query("UPDATE lost_items SET status = 'found' WHERE item_id = $1", [claim.item_id]);
      
      // Reward the original reporter (person who lost the item)
      if (reporterUserId) {
        const rewardAmount = 50; // Reward for lost item being found
        await client.query('UPDATE users SET rewards_balance = rewards_balance + $1 WHERE user_id = $2', [rewardAmount, reporterUserId]);
        // Get item name for reward record
        const itemRes = await client.query('SELECT name FROM lost_items WHERE item_id = $1', [claim.item_id]);
        const itemName = itemRes.rows[0]?.name || 'Unknown Item';
        await client.query('INSERT INTO rewards(user_id, amount, reason) VALUES($1, $2, $3)', 
          [reporterUserId, rewardAmount, `🎉 Your lost item "${itemName}" has been found and verified! Thank you for reporting it and helping others.`]);
      }
    }

    // Auto-reject other pending claims for the same item (only one approval allowed)
    await client.query(
      `UPDATE claims
       SET status = 'rejected', hub_message = COALESCE(hub_message, 'Another claim for this item was approved by hub')
       WHERE item_id = $1 AND claim_id <> $2 AND status = 'pending'`,
      [claim.item_id, claimId]
    );

    // Get claimer email for notification
    const claimerRes = await client.query('SELECT email, name FROM users WHERE user_id = $1', [claim.user_id]);
    const claimerEmail = claimerRes.rows[0]?.email;
    const claimerName = claimerRes.rows[0]?.name;

    await client.query('COMMIT');

    // Send email notification
    if (claimerEmail) {
      try {
        const itemName = claim.item_name || 'Unknown Item';
        await sendClaimNotificationEmail(
          claimerEmail, 
          itemName, 
          'approved', 
          message || 'Claim approved by hub'
        );
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    res.json({ ok: true, claim_id: claimId, status: 'approved', message: message || 'Claim approved' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve claim error:', err);
    res.status(500).json({ ok: false, error: err?.message || 'Failed to approve claim' });
  } finally {
    client.release();
  }
});

// Hub history endpoint: returns claims by status and counts
app.get('/api/hub/history', async (req, res) => {
  try {
    const status = req.query.status || null; // optional filter
    const params = [];
    let whereClause = '';
    if (status) {
      params.push(status);
      whereClause = 'WHERE c.status = $1';
    }

    const claimsResult = await pool.query(
      `SELECT c.claim_id, c.user_id AS claimer_user_id, c.item_id, c.item_type, c.status, c.created_at,
              COALESCE(f.name, l.name) AS item_name,
              COALESCE(f.description, l.description) AS item_description,
              COALESCE(f.location, l.location) AS item_location,
              u.name AS claimer_name, u.email AS claimer_email, u.phone AS claimer_phone
       FROM claims c
       LEFT JOIN found_items f ON c.item_type = 'found' AND c.item_id = f.item_id
       LEFT JOIN lost_items l  ON c.item_type = 'lost'  AND c.item_id = l.item_id
       LEFT JOIN users u ON c.user_id = u.user_id
       ${whereClause}
       ORDER BY c.created_at DESC`
      , params
    );

    const countsResult = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM claims
       GROUP BY status`
    );

    const counts = countsResult.rows.reduce((acc, r) => { acc[r.status] = r.count; return acc; }, {});

    res.json({ ok: true, counts, claims: claimsResult.rows });
  } catch (error) {
    console.error('Hub history error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// User history endpoint: reports (lost & found) and claim outcomes for current user
app.get('/api/user/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id || req.user.user_id;

    const myLostResult = await pool.query(
      `SELECT item_id, name, description, location, date_lost, status, created_at
       FROM lost_items WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const myFoundResult = await pool.query(
      `SELECT item_id, name, description, location, date_found, status, created_at
       FROM found_items WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const myClaimsResult = await pool.query(
      `SELECT c.claim_id, c.item_id, c.item_type, c.status, c.hub_message, c.created_at,
              COALESCE(f.name, l.name) AS item_name
       FROM claims c
       LEFT JOIN found_items f ON c.item_type = 'found' AND c.item_id = f.item_id
       LEFT JOIN lost_items l  ON c.item_type = 'lost'  AND c.item_id = l.item_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({ ok: true, lost_reports: myLostResult.rows, found_reports: myFoundResult.rows, claims: myClaimsResult.rows });
  } catch (error) {
    console.error('User history error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Reject claim
app.put('/api/hub/claim/:id/reject', async (req, res) => {
  const client = await pool.connect();
  try {
    const claimId = Number(req.params.id);
    const { message } = req.body || {};
    await client.query('BEGIN');

    const claimRes = await client.query(`
      SELECT c.*, 
             COALESCE(f.name, l.name) as item_name,
             COALESCE(f.description, l.description) as item_description
      FROM claims c
      LEFT JOIN found_items f ON c.item_id = f.item_id AND c.item_type = 'found'
      LEFT JOIN lost_items l ON c.item_id = l.item_id AND c.item_type = 'lost'
      WHERE c.claim_id = $1
    `, [claimId]);
    if (claimRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Claim not found' });
    }
    const claim = claimRes.rows[0];
    if (claim.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Claim is not pending' });
    }

    // Update claim status
    await client.query('UPDATE claims SET status = $1, hub_message = $2 WHERE claim_id = $3', 
      ['rejected', message || 'Claim rejected by hub', claimId]);

    // If this was a found item claim, make the item available again
    if (claim.item_type === 'found') {
      await client.query("UPDATE found_items SET status = 'available' WHERE item_id = $1", [claim.item_id]);
    }

    // Get claimer email for notification
    const claimerRes = await client.query('SELECT email, name FROM users WHERE user_id = $1', [claim.user_id]);
    const claimerEmail = claimerRes.rows[0]?.email;

    await client.query('COMMIT');

    // Send email notification
    if (claimerEmail) {
      try {
        const itemName = claim.item_name || 'Unknown Item';
        await sendClaimNotificationEmail(
          claimerEmail, 
          itemName, 
          'rejected', 
          message || 'Claim rejected by hub'
        );
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    res.json({ ok: true, claim_id: claimId, status: 'rejected', message: message || 'Claim rejected' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject claim error:', err);
    res.status(500).json({ ok: false, error: 'Failed to reject claim' });
  } finally {
    client.release();
  }
});

// Mark claim as partially verified (meet in person)
app.put('/api/hub/claim/:id/partial', async (req, res) => {
  const client = await pool.connect();
  try {
    const claimId = Number(req.params.id);
    const { message } = req.body || {};
    await client.query('BEGIN');

    const claimRes = await client.query(`
      SELECT c.*, 
             COALESCE(f.name, l.name) as item_name,
             COALESCE(f.description, l.description) as item_description
      FROM claims c
      LEFT JOIN found_items f ON c.item_id = f.item_id AND c.item_type = 'found'
      LEFT JOIN lost_items l ON c.item_id = l.item_id AND c.item_type = 'lost'
      WHERE c.claim_id = $1
    `, [claimId]);
    if (claimRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Claim not found' });
    }
    const claim = claimRes.rows[0];
    if (claim.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Claim is not pending' });
    }

    // Update claim status
    await client.query('UPDATE claims SET status = $1, hub_message = $2 WHERE claim_id = $3', 
      ['partial_verification', message || 'Please meet in person for verification', claimId]);

    // Get claimer email for notification
    const claimerRes = await client.query('SELECT email, name FROM users WHERE user_id = $1', [claim.user_id]);
    const claimerEmail = claimerRes.rows[0]?.email;

    await client.query('COMMIT');

    // Send email notification
    if (claimerEmail) {
      try {
        const itemName = claim.item_name || 'Unknown Item';
        await sendClaimNotificationEmail(
          claimerEmail, 
          itemName, 
          'partial', 
          message || 'Please meet in person for verification'
        );
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    res.json({ ok: true, claim_id: claimId, status: 'partial_verification', message: message || 'Partial verification required' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Partial verification error:', err);
    res.status(500).json({ ok: false, error: 'Failed to update claim status' });
  } finally {
    client.release();
  }
});

// Send a custom message to the claimer for a given claim
app.post('/api/hub/claim/:id/message', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const claimId = Number(req.params.id);
    const { subject, message, to, email } = req.body || {};

    // Basic validation
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }

    await client.query('BEGIN');

    // Fetch claim and user email
    const claimRes = await client.query('SELECT * FROM claims WHERE claim_id = $1', [claimId]);
    let claim = claimRes.rows[0];

    let recipientEmail = (to || '').trim();
    if (!recipientEmail && claim) {
      const userRes = await client.query('SELECT email, name FROM users WHERE user_id = $1', [claim.user_id || claim.user_id]);
      recipientEmail = userRes.rows[0]?.email || '';
    }

    await client.query('COMMIT');

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(404).json({ ok: false, error: 'Claim not found (no email available). Provide "to".' });
    }

    const itemName = (claim && claim.item_name) ? claim.item_name : 'Your claim';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Message from Hub</h2>
        <p>Regarding your claim for <strong>${itemName}</strong>:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; white-space: pre-wrap;">
          ${String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>
        <p>Thank you for using Retreivo.</p>
      </div>
    `;

    // Use custom email configuration if provided
    let result;
    if (email && email.enabled) {
      // Use the hub/send-email endpoint's functionality directly
      const customTransporter = nodemailer.createTransport({
        service: email.service || 'gmail',
        auth: {
          user: email.user,
          pass: email.password
        }
      });
      
      const mailOptions = {
        from: email.user,
        to: recipientEmail,
        subject: subject && subject.trim().length > 0 ? subject : `Update about your claim`,
        html: html
      };
      
      try {
        const emailResult = await customTransporter.sendMail(mailOptions);
        result = { success: true, messageId: emailResult.messageId };
      } catch (emailError) {
        console.error('Custom email error in claim message:', emailError);
        result = { success: false, error: emailError.message };
      }
    } else {
      // Use system email configuration
      result = await sendEmail(
        recipientEmail,
        subject && subject.trim().length > 0 ? subject : `Update about your claim`,
        html
      );
    }

    if (result.success) {
      return res.json({ ok: true, messageId: result.messageId });
    } else {
      return res.status(500).json({ ok: false, error: result.error || 'Failed to send email' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Send custom claim message error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to send message' });
  } finally {
    client.release();
  }
});

app.get('/api/hub/reports', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
app.get('/api/hub/donations', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
app.get('/api/hub/fraud-alerts', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
app.get('/api/hub/analytics', (_req, res) => res.status(501).json({ message: 'Not implemented' }));

// Chatbot endpoints
app.post('/api/chat/message', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body || {};
    const userId = req.user.sub;
    
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message is required' });
    }
    
    // Store user message
    await pool.query(
      'INSERT INTO chat_messages(user_id, content, is_bot) VALUES($1, $2, $3)',
      [userId, message, false]
    );
    
    // Generate bot response based on user message
    let botResponse = '';
    
    if (message.toLowerCase().includes('lost') || message.toLowerCase().includes('missing')) {
      botResponse = 'To report a lost item, please go to the "Report Lost Item" section and provide details about your item.';
    } else if (message.toLowerCase().includes('found')) {
      botResponse = 'Thank you for finding an item! Please go to the "Report Found Item" section to help return it to its owner.';
    } else if (message.toLowerCase().includes('reward') || message.toLowerCase().includes('points')) {
      botResponse = 'You can earn rewards by helping return lost items to their owners. Check your rewards balance in the "Rewards" section.';
    } else if (message.toLowerCase().includes('claim')) {
      botResponse = 'If you see your lost item in the search results, you can claim it by clicking the "Claim" button on the item.';
    } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
      botResponse = 'Hello! How can I help you with Retreivo today?';
    } else {
      botResponse = 'I\'m here to help with lost and found items. You can ask me about reporting lost items, found items, rewards, or claims.';
    }
    
    // Store bot response
    const result = await pool.query(
      'INSERT INTO chat_messages(user_id, content, is_bot) VALUES($1, $2, $3) RETURNING message_id, content, is_bot, created_at',
      [userId, botResponse, true]
    );
    
    res.status(201).json({ ok: true, message: result.rows[0] });
  } catch (err) {
    console.error('Chat message error:', err);
    res.status(500).json({ ok: false, error: 'Failed to process chat message' });
  }
});

app.get('/api/chat/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await pool.query(
      'SELECT message_id, content, is_bot, created_at FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT $2',
      [userId, limit]
    );
    
    res.json({ ok: true, messages: result.rows });
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch chat history' });
  }
});

// ML endpoints proxy (stubs)
const mlServiceBaseUrl = process.env.ML_BASE_URL || 'http://localhost:5002';

app.get('/api/ml/health', async (_req, res) => {
  try {
    const r = await fetch(`${mlServiceBaseUrl}/health`);
    const data = await r.json();
    res.json(data);
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.post('/api/ml/match-image', async (req, res) => {
  try {
    const r = await fetch(`${mlServiceBaseUrl}/match-image`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.post('/api/ml/match-text', async (req, res) => {
  try {
    const r = await fetch(`${mlServiceBaseUrl}/match-text`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (error) {
    res.status(502).json({ message: 'Not implemented' });
  }
});

app.post('/api/ml/detect-duplicate', async (req, res) => {
  try {
    const r = await fetch(`${mlServiceBaseUrl}/detect-fraud`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

app.post('/api/ml/compare-items', async (req, res) => {
  try {
    const r = await fetch(`${mlServiceBaseUrl}/compare-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
});

// Chatbot API endpoints

// Get chat history for a user
app.get('/api/chat/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get the user's most recent conversation or create a new one
    let conversationResult = await pool.query(
      'SELECT conversation_id FROM chat_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );
    
    let conversationId;
    if (conversationResult.rows.length === 0) {
      // Create a new conversation
      const newConversation = await pool.query(
        'INSERT INTO chat_conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING conversation_id',
        [userId, 'New Conversation']
      );
      conversationId = newConversation.rows[0].conversation_id;
    } else {
      conversationId = conversationResult.rows[0].conversation_id;
    }
    
    // Get messages for this conversation
    const messagesResult = await pool.query(
      'SELECT message_id, content, is_bot, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    );
    
    res.json({
      ok: true,
      conversation_id: conversationId,
      messages: messagesResult.rows
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Send a message to the chatbot
app.post('/api/chat/message', authenticateToken, async (req, res) => {
  try {
    const { content, conversation_id } = req.body;
    const userId = req.user.id;
    
    if (!content) {
      return res.status(400).json({ ok: false, error: 'Message content is required' });
    }
    
    // Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const newConversation = await pool.query(
        'INSERT INTO chat_conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING conversation_id',
        [userId, content.substring(0, 50) + (content.length > 50 ? '...' : '')]
      );
      conversationId = newConversation.rows[0].conversation_id;
    } else {
      // Update conversation timestamp
      await pool.query(
        'UPDATE chat_conversations SET updated_at = NOW() WHERE conversation_id = $1',
        [conversationId]
      );
    }
    
    // Save user message
    const userMessage = await pool.query(
      'INSERT INTO chat_messages (conversation_id, user_id, content, is_bot, created_at) VALUES ($1, $2, $3, false, NOW()) RETURNING message_id, content, is_bot, created_at',
      [conversationId, userId, content]
    );
    
    // Generate bot response based on predefined responses or simple logic
    let botResponseText = '';
    
    // Check for keyword matches in predefined responses
    const keywordResult = await pool.query(
      'SELECT response_text FROM chatbot_responses WHERE $1 ILIKE (\'%\' || keyword || \'%\') ORDER BY RANDOM() LIMIT 1',
      [content.toLowerCase()]
    );
    
    if (keywordResult.rows.length > 0) {
      botResponseText = keywordResult.rows[0].response_text;
    } else {
      // Fallback responses based on message content
      const lowerContent = content.toLowerCase();
      
      if (lowerContent.includes('lost') || lowerContent.includes('missing')) {
        botResponseText = 'To report a lost item, please go to the "Report Lost Item" section and provide details about your item.';
      } else if (lowerContent.includes('found')) {
        botResponseText = 'Thank you for finding an item! Please go to the "Report Found Item" section to help return it to its owner.';
      } else if (lowerContent.includes('reward') || lowerContent.includes('points')) {
        botResponseText = 'You can earn rewards by helping return lost items to their owners. Check your rewards balance in the "Rewards" section.';
      } else if (lowerContent.includes('claim')) {
        botResponseText = 'If you see your lost item in the search results, you can claim it by clicking the "Claim" button on the item.';
      } else if (lowerContent.includes('hello') || lowerContent.includes('hi')) {
        botResponseText = 'Hello! I\'m here to help with anything you need. Feel free to ask me about Retreivo or any other topic.';
      } else {
        botResponseText = 'I\'m here to help with both Retreivo features and general questions. Feel free to ask me about lost items, rewards, or anything else you\'re curious about!';
      }
    }
    
    // Save bot response
    const botMessage = await pool.query(
      'INSERT INTO chat_messages (conversation_id, user_id, content, is_bot, created_at) VALUES ($1, $2, $3, true, NOW()) RETURNING message_id, content, is_bot, created_at',
      [conversationId, userId, botResponseText]
    );
    
    res.json({
      ok: true,
      conversation_id: conversationId,
      messages: [
        userMessage.rows[0],
        botMessage.rows[0]
      ]
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get all conversations for a user
app.get('/api/chat/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const conversationsResult = await pool.query(
      'SELECT conversation_id, title, created_at, updated_at FROM chat_conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    
    res.json({
      ok: true,
      conversations: conversationsResult.rows
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
  console.log(`Database URL: ${databaseUrl}`);
  console.log(`JWT Secret: ${jwtSecret.substring(0, 10)}...`);
});


