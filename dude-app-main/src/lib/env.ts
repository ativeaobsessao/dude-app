/**
 * Guardião de Chaves e Higiene do Ambiente (.env Guard)
 * Evita o vazamento acidental de chaves de API secretas (OpenAI, Anthropic, ElevenLabs, etc) no cliente Vite.
 */

// Chaves que NUNCA devem estar sob prefixo VITE_ ou jogadas no bundle do client-side
const FORBIDDEN_PATTERNS = [
  'OPENAI',
  'ANTHROPIC',
  'CLAUDE',
  'OPENAI_API_KEY',
  'STRIPE_SECRET',
  'SERVICE_ROLE',
  'AWS_SECRET',
  'GEMINI_API_KEY'
];

export function validateEnvironment() {
  if (typeof window === 'undefined') return;

  // 1. Auditar import.meta.env
  try {
    const envObj = (import.meta as any).env || {};
    for (const key of Object.keys(envObj)) {
      // Se a chave contiver algum padrão proibido e estiver exposta ao frontend (geralmente via VITE_)
      const upperKey = key.toUpperCase();
      const hasForbiddenPattern = FORBIDDEN_PATTERNS.some(pattern => upperKey.includes(pattern));
      
      if (hasForbiddenPattern && envObj[key]) {
        console.error(`[CRITICAL SECOPS ALERT] Chave sensível detectada no ambiente client-side: ${key}`);
        throw new Error(
          `SEGURANÇA BLOQUEADA: A variável de ambiente "${key}" possui valor ativo e viola as políticas Zero Trust do frontend. ` +
          `Apenas a URL do Supabase e a Anon Key são permitidas sob prefixação VITE_. Remova esta chave do arquivo de ambiente do frontend imediatamente!`
        );
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('SEGURANÇA BLOQUEADA')) {
      // Exibe overlay ou trava a aplicação para garantir que o programador perceba imediatamente
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = '#7f1d1d';
      overlay.style.color = '#fef2f2';
      overlay.style.zIndex = '999999';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.fontFamily = 'monospace';
      overlay.style.padding = '20px';
      overlay.style.textAlign = 'center';
      overlay.innerHTML = `
        <h1 style="font-size: 24px; margin-bottom: 20px;">🚨 VAZAMENTO DE CHAVE DETECTADO (SECOPS)</h1>
        <p style="font-size: 16px; max-width: 600px; line-height: 1.5; margin-bottom: 20px;">
          ${error.message}
        </p>
        <span style="font-size: 12px; opacity: 0.7;">DUDE Zero Trust Architecture • Camada 4 Ativa</span>
      `;
      document.body.appendChild(overlay);
      throw error;
    }
  }
}
