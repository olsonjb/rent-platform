-- Add phone number to tenants for inbound SMS lookup
-- Store in E.164 format e.g. +18015551234
alter table public.tenants add column if not exists phone text unique;
