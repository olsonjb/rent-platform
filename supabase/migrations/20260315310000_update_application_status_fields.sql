-- Add compliance fields to rental_applications

-- Add ai_reviewed to the application_status enum
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'ai_reviewed' AFTER 'screening';

-- Add compliance columns
ALTER TABLE public.rental_applications
  ADD COLUMN IF NOT EXISTS ai_recommendation varchar(10),
  ADD COLUMN IF NOT EXISTS ai_recommendation_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS adverse_action_notice text;
