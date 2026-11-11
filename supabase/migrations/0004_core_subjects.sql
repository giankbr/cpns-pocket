-- Taksonomi SKD: subjek dan topik TWK/TIU/TKP. Soal tetap dikelola admin.

insert into public.subjects (code, name, description, sort_order)
values
  ('TWK', 'Tes Wawasan Kebangsaan', 'Pancasila, UUD 1945, Bhinneka Tunggal Ika, NKRI, dan sejarah.', 1),
  ('TIU', 'Tes Intelegensia Umum', 'Penalaran verbal, numerik, logis, analitis, dan figural.', 2),
  ('TKP', 'Tes Karakteristik Pribadi', 'Pelayanan publik, jejaring kerja, sosial budaya, TI, profesionalisme, anti-radikalisme.', 3)
on conflict (code) do nothing;

insert into public.topics (subject_id, name, sort_order)
select s.id, t.name, t.sort_order
from (values
  ('TWK', 'Pancasila', 1),
  ('TWK', 'UUD 1945', 2),
  ('TWK', 'Bhinneka Tunggal Ika', 3),
  ('TWK', 'NKRI', 4),
  ('TWK', 'Sejarah dan Wawasan Kebangsaan', 5),
  ('TIU', 'Verbal', 1),
  ('TIU', 'Numerik', 2),
  ('TIU', 'Logika', 3),
  ('TIU', 'Analitis', 4),
  ('TIU', 'Figural', 5),
  ('TKP', 'Pelayanan Publik', 1),
  ('TKP', 'Jejaring Kerja', 2),
  ('TKP', 'Sosial Budaya', 3),
  ('TKP', 'Teknologi Informasi', 4),
  ('TKP', 'Profesionalisme', 5),
  ('TKP', 'Anti-radikalisme', 6)
) as t(code, name, sort_order)
join public.subjects s on s.code = t.code
on conflict (subject_id, name) do nothing;
