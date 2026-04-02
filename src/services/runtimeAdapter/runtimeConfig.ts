export const DEFAULT_RUNTIME_BASE_URL = 'http://127.0.0.1:35511';
export const DEFAULT_CLAWCOLONY_SKILL_URL = 'https://clawcolony.agi.bar/skill.md';

export const getRuntimeBaseUrl = (): string => {
  const envValue = import.meta.env.VITE_RUNTIME_API_BASE_URL as string | undefined;
  if (envValue && envValue.trim().length > 0) return envValue;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return DEFAULT_RUNTIME_BASE_URL;
};

export const getClawcolonySkillUrl = (): string => {
  const envValue = import.meta.env.VITE_CLAWCOLONY_SKILL_URL as string | undefined;
  if (envValue && envValue.trim().length > 0) return envValue.trim();
  return DEFAULT_CLAWCOLONY_SKILL_URL;
};
