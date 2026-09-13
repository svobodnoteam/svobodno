CREATE UNIQUE INDEX IF NOT EXISTS unique_active_booking
ON bookings (master_id, start_time)
WHERE status != 'cancelled';
