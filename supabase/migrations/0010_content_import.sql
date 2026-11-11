-- Admin-only content import. Lets the import script run as a signed-in admin
-- (no service-role key needed) while answer keys stay unreadable from the client.
--
-- p_questions: [{subject_code, topic, type, prompt, explanation, difficulty, source, content_hash,
--                options: [text x5], answer_index | scores: [int x5]}]
-- p_materials: [{subject_code, topic, title, body, source, content_hash}]
-- Everything is inserted as 'draft'. Rows whose content_hash already exists are skipped.

create or replace function public.import_content(p_questions jsonb default '[]'::jsonb, p_materials jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_topic uuid;
  v_question uuid;
  v_option uuid;
  v_index integer;
  v_questions integer := 0;
  v_materials integer := 0;
  v_skipped integer := 0;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  for item in select * from jsonb_array_elements(p_questions) loop
    select t.id into v_topic
    from topics t join subjects s on s.id = t.subject_id
    where s.code = item ->> 'subject_code' and t.name = item ->> 'topic';

    if v_topic is null or jsonb_array_length(item -> 'options') <> 5 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into questions (topic_id, type, prompt, explanation, difficulty, status, source, content_hash)
    values (
      v_topic,
      (item ->> 'type')::question_type,
      item ->> 'prompt',
      nullif(item ->> 'explanation', ''),
      coalesce(item ->> 'difficulty', 'medium')::difficulty_level,
      'draft',
      item ->> 'source',
      item ->> 'content_hash'
    )
    on conflict (content_hash) do nothing
    returning id into v_question;

    if v_question is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    for v_index in 0..4 loop
      insert into question_options (question_id, label, sort_order)
      values (v_question, item -> 'options' ->> v_index, v_index)
      returning id into v_option;

      if item ->> 'type' = 'weighted' then
        insert into question_answer_keys (option_id, score) values (v_option, (item -> 'scores' ->> v_index)::smallint);
      else
        insert into question_answer_keys (option_id, is_correct) values (v_option, v_index = (item ->> 'answer_index')::int);
      end if;
    end loop;
    v_questions := v_questions + 1;
  end loop;

  for item in select * from jsonb_array_elements(p_materials) loop
    select t.id into v_topic
    from topics t join subjects s on s.id = t.subject_id
    where s.code = item ->> 'subject_code' and t.name = item ->> 'topic';

    if v_topic is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into learning_materials (topic_id, title, body, status, source, content_hash)
    values (v_topic, item ->> 'title', item ->> 'body', 'draft', item ->> 'source', item ->> 'content_hash')
    on conflict (content_hash) do nothing;
    if found then v_materials := v_materials + 1; else v_skipped := v_skipped + 1; end if;
  end loop;

  return jsonb_build_object('questions', v_questions, 'materials', v_materials, 'skipped', v_skipped);
end;
$$;

-- Publish reviewed drafts (optionally only one source file).
create or replace function public.publish_content(p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_questions integer;
  v_materials integer;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update questions set status = 'published', updated_at = now()
  where status = 'draft' and (p_source is null or source = p_source);
  get diagnostics v_questions = row_count;

  update learning_materials set status = 'published', updated_at = now()
  where status = 'draft' and (p_source is null or source = p_source);
  get diagnostics v_materials = row_count;

  return jsonb_build_object('questions', v_questions, 'materials', v_materials);
end;
$$;

revoke all on function public.import_content(jsonb, jsonb) from public, anon;
revoke all on function public.publish_content(text) from public, anon;
grant execute on function public.import_content(jsonb, jsonb) to authenticated;
grant execute on function public.publish_content(text) to authenticated;
