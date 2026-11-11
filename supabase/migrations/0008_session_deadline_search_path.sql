-- Pin search_path (Supabase advisor: function_search_path_mutable).
alter function public.session_deadline(public.study_sessions) set search_path = public;
