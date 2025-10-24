-- Create private bucket for evidence files
insert into
    storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
    )
values
    (
        'evidence',
        'evidence',
        false,
        104857600,
        -- 100 MB
        array ['image/png','image/jpeg','application/pdf','text/plain']
    ) on conflict (id) do nothing;