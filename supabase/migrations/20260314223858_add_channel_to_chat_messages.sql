alter table public.chat_messages
  add column if not exists channel text not null default 'web'
  check (channel in ('web', 'sms'));
