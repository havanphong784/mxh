type ApiErrorShape = {
  response?: {
    data?: {
      message?: unknown;
      errors?: unknown;
    };
  };
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const data = (error as ApiErrorShape).response?.data;
  const details = data?.errors;
  if (Array.isArray(details)) {
    const messages = details.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    if (messages.length > 0) return messages.join('. ');
  }

  const message = data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const messages = message.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    if (messages.length > 0) return messages.join('. ');
  }

  return fallback;
}
