import { supabase } from './supabase';

/**
 * DUDE Secure AI Proxy Client (Camada 4 - Isolamento Backend/Edge)
 * 
 * DESIGN PATTERN: "Boundary Translation & Endpoint Isolation"
 * 
 * REVISÃO DE SEGURANÇA:
 * NUNCA chame as APIs da OpenAI, Anthropic ou Gemini diretamente do navegador.
 * Este módulo demonstra a arquitetura correta de proxy via Supabase Edge Functions.
 * As chaves secretas residem exclusivamente no lado do servidor Supabase (Vault ou variáveis do Edge), 
 * e o frontend apenas consome o endpoint encapsulado por autenticação JWT (User Session).
 */

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

/**
 * Envia uma mensagem ou prompt para ser processado de forma segura através do AI Proxy (Edge Function)
 * @param prompt O prompt ou texto fornecido pelo usuário ou gerado pelo frontend
 * @param model O modelo alvo opcional (ex: 'gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-pro')
 */
export async function callAIProxy(prompt: string, model = 'gemini-1.5-pro'): Promise<AIResponse> {
  try {
    // 1. Obter a sessão ativa para anexar o Bearer Auth Token automaticamente
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: 'Autenticação necessária. Usuário não autenticado no Supabase.'
      };
    }

    // 2. Chamar a Supabase Edge Function com segurança pelo endpoint RPC / Functions do Supabase
    // Observação: Na implantação de produção da DUDE, basta invocar o método customizado:
    /*
    const { data, error } = await supabase.functions.invoke('ai-assistant-proxy', {
      body: { prompt, model }
    });
    
    if (error) throw error;
    return { success: true, text: data?.text };
    */

    // Rascunho funcional/mock para manter integridade da compilação antes de instanciar a Edge Function
    console.log(`[AI SECURE PROXY] Simulação de chamada segura à IA (${model}). Sabor de segurança: Edge Isolation.`);
    return {
      success: true,
      text: `[Isolamento Backend] Resposta mockada recebida com sucesso. Prompt enviado: "${prompt}". Nenhuma chave vazada!`
    };
  } catch (err: any) {
    console.error('Erro ao invocar o proxy de IA seguro:', err);
    return {
      success: false,
      error: err.message || 'Falha desconhecida no canal seguro de IA.'
    };
  }
}
