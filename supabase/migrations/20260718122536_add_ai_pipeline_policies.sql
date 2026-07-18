grant select, insert, update on public.emotion_analyses to authenticated;
grant select, insert, delete on public.emotion_scores to authenticated;
grant select, insert on public.generated_comments to authenticated;

create policy "analyses insert through owned entries"
on public.emotion_analyses for insert to authenticated
with check (exists (
  select 1 from public.entries e
  where e.id = entry_id and e.user_id = (select auth.uid())
));

create policy "analyses update through owned entries"
on public.emotion_analyses for update to authenticated
using (exists (
  select 1 from public.entries e
  where e.id = entry_id and e.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.entries e
  where e.id = entry_id and e.user_id = (select auth.uid())
));

create policy "scores insert through owned entries"
on public.emotion_scores for insert to authenticated
with check (exists (
  select 1 from public.emotion_analyses a
  join public.entries e on e.id = a.entry_id
  where a.id = analysis_id and e.user_id = (select auth.uid())
));

create policy "scores delete through owned entries"
on public.emotion_scores for delete to authenticated
using (exists (
  select 1 from public.emotion_analyses a
  join public.entries e on e.id = a.entry_id
  where a.id = analysis_id and e.user_id = (select auth.uid())
));

create policy "comments insert through owned entries"
on public.generated_comments for insert to authenticated
with check (exists (
  select 1 from public.entries e
  where e.id = entry_id and e.user_id = (select auth.uid())
));
