import type { PromptTemplate } from '../types';

/** Key for the prompt registry map: name + version. */
function registryKey(name: string, version: string): string {
  return `${name}@${version}`;
}

export interface PromptRegistry {
  /** Register a prompt template. Throws if name+version already exists. */
  register(template: PromptTemplate): void;
  /** Get a specific version, or the latest registered version if omitted. */
  get(name: string, version?: string): PromptTemplate;
  /** Render a prompt by filling {{variable}} placeholders. */
  render(name: string, variables: Record<string, string>, version?: string): string;
  /** Check if a prompt name exists. */
  has(name: string): boolean;
}

/**
 * Create a new prompt registry instance.
 * Stores templates in an in-memory Map keyed by name@version.
 * Tracks the latest version per name for fallback resolution.
 */
export function createPromptRegistry(): PromptRegistry {
  const templates = new Map<string, PromptTemplate>();
  const latestVersions = new Map<string, string>();

  function register(template: PromptTemplate): void {
    const key = registryKey(template.name, template.version);
    if (templates.has(key)) {
      throw new Error(`Prompt "${template.name}@${template.version}" is already registered`);
    }
    templates.set(key, template);
    latestVersions.set(template.name, template.version);
  }

  function get(name: string, version?: string): PromptTemplate {
    if (version) {
      const key = registryKey(name, version);
      const template = templates.get(key);
      if (template) return template;
      // Fall back to latest if requested version not found
    }

    const latestVersion = latestVersions.get(name);
    if (!latestVersion) {
      throw new Error(`Prompt "${name}" is not registered`);
    }

    const template = templates.get(registryKey(name, latestVersion));
    if (!template) {
      throw new Error(`Prompt "${name}" is not registered`);
    }
    return template;
  }

  function render(name: string, variables: Record<string, string>, version?: string): string {
    const template = get(name, version);

    if (typeof template.template === 'function') {
      return template.template(variables);
    }

    let result = template.template;
    const missingVars: string[] = [];

    // Find all {{variable}} placeholders
    result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
      if (varName in variables) {
        return variables[varName];
      }
      missingVars.push(varName);
      return `{{${varName}}}`;
    });

    if (missingVars.length > 0) {
      throw new Error(
        `Missing variables for prompt "${name}": ${missingVars.join(', ')}`,
      );
    }

    return result;
  }

  function has(name: string): boolean {
    return latestVersions.has(name);
  }

  return { register, get, render, has };
}

/** Global prompt registry singleton. */
export const promptRegistry = createPromptRegistry();

/** Convenience: register a prompt on the global registry. */
export function registerPrompt(template: PromptTemplate): void {
  promptRegistry.register(template);
}

/** Convenience: get a prompt from the global registry. */
export function getPrompt(name: string, version?: string): PromptTemplate {
  return promptRegistry.get(name, version);
}

/** Convenience: render a prompt from the global registry. */
export function renderPrompt(
  name: string,
  variables: Record<string, string>,
  version?: string,
): string {
  return promptRegistry.render(name, variables, version);
}
