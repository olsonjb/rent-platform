# TASK T12: Prompt Registry & AI Configuration

You are an autonomous agent working on the `rent-platform` repository. Your task is to centralize all AI prompts into a versioned registry with metrics tracking.

## Acceptance Criteria

### 1. Prompt Registry (`lib/ai/prompt-registry.ts`)
- Create a registry that stores all prompts as named, versioned templates
- Each prompt has: id, name, version, template (string with `{{variable}}` placeholders), model, max_tokens, temperature
- Registry source: start with a TypeScript file (`lib/ai/prompts/`) per agent, export structured prompt objects
- Include a `renderPrompt(name, version, variables)` function that fills placeholders and returns the final string

### 2. Migrate All Existing Prompts
- Extract prompts from:
  - `lib/chat/system-prompt.ts` → `prompts/tenant-chat.ts`
  - `lib/agent/screening-agent.ts` → `prompts/screening.ts`
  - `lib/agent/decision.ts` → `prompts/listing-decision.ts`
  - `lib/agent/content.ts` → `prompts/listing-content.ts`
  - `lib/maintenance-review.ts` → `prompts/maintenance-estimate.ts`
- Each original file should import from the registry instead of hardcoding prompts
- Verify that the app functions identically after migration

### 3. Prompt Versioning
- Each prompt object has a `version` field (semver string)
- When the `ai_usage_log` table exists (from T03), log which prompt name + version was used for each call
- This enables A/B testing: run two versions side by side and compare output quality

### 4. Model Configuration
- Centralize model selection: `lib/ai/models.ts`
- Define model configs: `{ chat: "claude-sonnet-4-...", screening: "claude-sonnet-4-...", estimate: "claude-sonnet-4-...", content: "claude-sonnet-4-..." }`
- Allow override via environment: `AI_MODEL_CHAT=claude-haiku-4-5-20251001` etc.
- Each agent reads its model from this config, not hardcoded

### 5. Claude API Wrapper (`lib/ai/client.ts`)
- Create a thin wrapper around the Anthropic SDK that:
  - Uses the prompt registry to build messages
  - Uses the model config to select the model
  - Logs usage metrics (integrates with T03 if available, otherwise just console)
  - Handles retries on 529 (overloaded) with exponential backoff
  - Parses JSON responses with a shared `extractJson(text)` utility (replace the duplicated regex pattern)

### 6. Tests
- Test prompt rendering with various variable combinations
- Test that missing variables throw descriptive errors
- Test model config resolution (default + env override)
- Test JSON extraction from various Claude response formats
- Test retry logic on simulated 529 errors

## Technical Constraints
- Do NOT change any external behavior — same prompts, same outputs
- The prompt migration must be a pure refactor with no functional changes
- Keep backward compatibility: if a prompt version is missing, fall back to latest

## Definition of Done
- All prompts live in `lib/ai/prompts/` as structured objects
- All agents use the registry instead of inline strings
- Model selection is centralized and environment-configurable
- JSON extraction is DRY (one utility, not regex in every agent)
- Tests pass, build passes, existing functionality unchanged

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE
