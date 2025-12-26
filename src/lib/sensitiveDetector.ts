export interface SensitiveMatch {
  type: 'email' | 'phone' | 'api_key' | 'password' | 'credit_card' | 'ssn' | 'ip_address';
  value: string;
  start: number;
  end: number;
}

const patterns = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  api_key: /(sk_live_|sk_test_|pk_live_|pk_test_|api[_-]?key[=:\s]*['"]?)[a-zA-Z0-9]{20,}/gi,
  password: /(password|passwd|pwd)[=:\s]*['"]?[^\s'"]{6,}/gi,
  credit_card: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
};

export function detectSensitiveData(text: string): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: type as SensitiveMatch['type'],
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  
  // Sort by position
  return matches.sort((a, b) => a.start - b.start);
}

export function maskSensitiveData(text: string): string {
  const matches = detectSensitiveData(text);
  let result = text;
  let offset = 0;
  
  for (const match of matches) {
    const maskedValue = maskValue(match.value, match.type);
    result = result.slice(0, match.start + offset) + maskedValue + result.slice(match.end + offset);
    offset += maskedValue.length - match.value.length;
  }
  
  return result;
}

function maskValue(value: string, type: SensitiveMatch['type']): string {
  switch (type) {
    case 'email':
      const [local, domain] = value.split('@');
      return `${local[0]}***@${domain}`;
    case 'phone':
      return value.replace(/\d(?=\d{4})/g, '*');
    case 'credit_card':
      return '**** **** **** ' + value.slice(-4);
    case 'ssn':
      return '***-**-' + value.slice(-4);
    case 'api_key':
      return value.slice(0, 8) + '****' + value.slice(-4);
    case 'password':
      return value.split(/[=:\s]/)[0] + '=********';
    case 'ip_address':
      return value.replace(/\d+/g, '***');
    default:
      return '****';
  }
}

export function getSensitivityLevel(matches: SensitiveMatch[]): 'none' | 'low' | 'medium' | 'high' {
  if (matches.length === 0) return 'none';
  
  const highRisk = ['credit_card', 'ssn', 'api_key', 'password'];
  const hasHighRisk = matches.some(m => highRisk.includes(m.type));
  
  if (hasHighRisk) return 'high';
  if (matches.length > 5) return 'medium';
  return 'low';
}
