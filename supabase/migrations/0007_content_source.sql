-- Provenance + idempotent re-import for content imported from PDFs/ebooks.
-- content_hash = sha256 of normalized text (question: prompt + options; material: title + body).

alter table public.questions
  add column source text,
  add column content_hash text unique;

alter table public.learning_materials
  add column source text,
  add column content_hash text unique;

create index questions_source_idx on public.questions(source);
create index learning_materials_source_idx on public.learning_materials(source);
