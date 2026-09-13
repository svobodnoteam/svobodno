ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id integer;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_email text;

UPDATE bookings
SET start_time = slot_time
WHERE start_time IS NULL AND slot_time IS NOT NULL;
