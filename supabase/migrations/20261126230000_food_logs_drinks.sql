-- Drinks are logged as food (they count toward calories) but tagged, so Coach can link them to sleep and the next session.
alter table public.food_logs drop constraint food_logs_source_check;
alter table public.food_logs add constraint food_logs_source_check check (source = any (array['manual','saved','barcode','photo','text','drink']));
alter table public.food_logs add column if not exists drinks smallint check (drinks between 1 and 30);
comment on column public.food_logs.drinks is 'Number of alcoholic drinks in this entry (source = drink). Lets Coach link drinking to sleep and the next session.';
