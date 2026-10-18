insert into storage.buckets (id, name, public, file_size_limit)
values ('cad', 'cad', false, 104857600)
on conflict (id) do nothing;
