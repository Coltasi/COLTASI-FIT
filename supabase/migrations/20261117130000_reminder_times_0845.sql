-- Default reminder time for sleep log and weekly weigh-in is 08:45.
alter table public.profiles alter column sleep_time set default '08:45';
alter table public.profiles alter column weigh_in_time set default '08:45';
update public.profiles set sleep_time = '08:45', weigh_in_time = '08:45' where display_name in ('Colin', 'Colin Constantine');
