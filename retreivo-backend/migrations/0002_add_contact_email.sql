-- Add contact_email field to lost_items table
ALTER TABLE lost_items ADD COLUMN contact_email VARCHAR(255);

-- Add contact_email field to found_items table for consistency
ALTER TABLE found_items ADD COLUMN contact_email VARCHAR(255);




