-- Freehand pen strokes on a material ("ink"): one row per stroke.
-- ink = { w: <content width in px when drawn>, color, size, points: [[x, y], ...] }
alter table public.annotations add column ink jsonb;
alter table public.annotations drop constraint annotations_kind_check;
alter table public.annotations add constraint annotations_kind_check check (kind in ('highlight', 'underline', 'strike', 'note', 'ink'));
alter table public.annotations add constraint annotations_ink_check check ((kind = 'ink') = (ink is not null));
