-- Prevent overlapping bookings
ALTER TABLE bookings
ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (
  property_id WITH =,
  daterange(start_date, end_date, '[]') WITH &&
)
WHERE (status IN ('approved', 'pending'));

-- Prevent multiple successful payments
CREATE UNIQUE INDEX unique_successful_payment_per_booking
ON payments(booking_id)
WHERE payment_status = 'successful';