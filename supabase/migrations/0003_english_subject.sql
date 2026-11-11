-- Bahasa Inggris: dipakai di SKB sejumlah instansi (format mirip TOEFL/TOEP), bukan bagian SKD.
-- Soal objektif biasa (question_type = 'objective'), tanpa listening karena CAT berbasis teks.

alter table public.subjects drop constraint subjects_code_check;
alter table public.subjects
  add constraint subjects_code_check check (code in ('TWK', 'TIU', 'TKP', 'ENG'));

insert into public.subjects (code, name, description, sort_order)
values (
  'ENG',
  'Bahasa Inggris',
  'Persiapan tes Bahasa Inggris SKB: grammar, error recognition, vocabulary, dan reading.',
  4
)
on conflict (code) do nothing;

insert into public.topics (subject_id, name, sort_order)
select s.id, t.name, t.sort_order
from public.subjects s
cross join (values
  ('Structure (Grammar)', 1),
  ('Written Expression (Error Recognition)', 2),
  ('Vocabulary (Synonym & Antonym)', 3),
  ('Reading Comprehension', 4)
) as t(name, sort_order)
where s.code = 'ENG'
on conflict (subject_id, name) do nothing;
