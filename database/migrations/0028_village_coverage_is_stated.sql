-- 0028 · Maharashtra's village level says how complete it is.
--
-- 0025 recorded coverage for districts, talukas and urban local bodies and left
-- villages out. Forty are held — every one of them inside Nagpur district,
-- pulled in by an early district-scoped Overpass query — against a state that
-- has more than forty thousand.
--
-- That omission is the same defect 0025 exists to prevent, one level further
-- down: a reader who reaches a taluka and sees no village would read it as a
-- statement about the taluka. It is a statement about a query nobody has run.

INSERT INTO geography_coverage (admin_unit_id, level, status, source_id, note)
SELECT u.id, 'village', 'partial', 'openstreetmap-overpass',
       'Forty villages are held, all within Nagpur district, from an early district-scoped query. Maharashtra has more than forty thousand. No village register has been collected, so a taluka showing no village means none is held.'
  FROM admin_unit u
 WHERE u.level = 'state' AND u.lgd_code = '27'
ON CONFLICT DO NOTHING;
