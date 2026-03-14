create policy "Tenants delete own messages" on public.chat_messages
  for delete using (tenant_id = auth.uid());
