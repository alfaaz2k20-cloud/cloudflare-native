-- ==============================================================================
-- Development Seed Data: Alfaaz Collective
-- Version: 0001_dev_seed.sql
-- Fabricated testing data ONLY. No production credentials or secrets.
-- ==============================================================================

-- 1. Master Administrator & Test Volunteer
-- Passwords: admin -> 'curator2026!' | volunteer -> 'alfaaz2026!'
INSERT OR IGNORE INTO users (id, email, password, full_name, status) VALUES
(1, 'admin@alfaaz.com', '0df14623474ea17cc4e62d3a5ca57bf9:2d4f90ebad455edb3c9ea1c320eda4594a9394de888d9bb763b2f4c21ccde303', 'The Curator', 'ADMIN'),
(2, 'volunteer@alfaaz.com', 'aadac75aa9440935eaafb7d27d046d37:cd0d19846fef44d6e5d877b63c8c6dd4a2b91ce01971deed6c2dc21d116275cf', 'Zainab Mir', 'PARTICIPANT');

-- 2. Master Exhibition Configuration
INSERT OR IGNORE INTO exhibitions_list (id, title, date_text, venue, about_text, is_active, tnc_pdf_url, registration_fee, payment_instructions, payment_qr_url) VALUES
(1, 'KAAMIL III — The Vernacular Breath', 'November 15–22, 2026', 'Mahatta Art Gallery, The Bund, Srinagar', 'A dedicated showcase celebrating the quiet resilience of Himalayan craft, contemporary visual expression, and vernacular poetry.', 1, '/legal/exhibition-terms.pdf', '₹500', 'Please complete UPI transfer to alfaaz2k20@upi and upload the receipt screenshot.', '/images/favicon.ico');

-- 3. Community Gatherings & Workshops
INSERT OR IGNORE INTO events (id, name, description, event_date, registration_open, capacity) VALUES
(1, 'Harud Poetry Gathering', 'An autumn evening of reflective verse and spoken word in memory of Agha Shahid Ali.', 'Nov 08, 2026 · 4:00 PM', 1, 30),
(2, 'Vernacular Woodwork & Pinjrakari Workshop', 'Hands-on introductory craft session exploring traditional Kashmiri architectural geometry.', 'Nov 12, 2026 · 11:00 AM', 1, 15);

-- 4. Initial Event Registration
INSERT OR IGNORE INTO event_registrations (id, event_id, user_email, whatsapp_number) VALUES
(1, 1, 'volunteer@alfaaz.com', '+91 94190 00000');

-- 5. Curated Archives / Articles
INSERT OR IGNORE INTO blogs (id, title, excerpt, content, cover_image, is_published) VALUES
(1, 'The Geometry of Stillness: Pinjrakari and Kashmiri Space', 'How traditional lattice woodwork mediates light, privacy, and contemplative space in vernacular architecture.', '<p>In the quiet alleyways of old Srinagar, light does not simply enter a room; it is filtered through intricate geometric rhythms. Pinjrakari—the traditional craft of assembling delicate wooden battens without glue or nails—is an architectural contemplation on permeability and sanctuary.</p><p>As Sohrab Sepehri reminds us, to see differently requires removing the barriers of habit. The pinjra screen is not a wall that divides; it is a membrane that breathes.</p>', '/images/slider-1.jpg', 1),
(2, 'The Autumn Leaves of Nigeen: On the Origin of Harud', 'Remembering our foundational autumn gathering in 2020 and the philosophy of creative harvest.', '<p>Harud is the season when the chinar tree sheds its fiery red foliage into the still waters of Dal and Nigeen. Founded in autumn 2020, Alfaaz Collective was conceived not as an institution, but as a harvest of voices.</p><p>It belongs to where it lives.</p>', '/images/slider-2.jpg', 1);

-- 6. Interview Settings
INSERT OR IGNORE INTO interview_settings (id, slots_json, skip_days_json) VALUES
(1, '["11:00 AM", "03:00 PM", "05:30 PM", "07:00 PM"]', '["Sunday"]');
