import { Layout } from "@/components/layout/Layout";
import { Terminal, ChevronRight, Shield } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  {
    title: "1. Dados que Coletamos",
    content: `Coletamos apenas os dados necessários para o funcionamento da Plataforma:\n• **Dados de cadastro**: email, nome de usuário e senha (criptografada).\n• **Dados de perfil**: nome de exibição, avatar e biografia (opcionais).\n• **Dados de uso**: páginas visitadas, scripts baixados, interações na plataforma.\n• **Dados de pagamento**: processados diretamente por terceiros (MercadoPago). Não armazenamos dados de cartão.`
  },
  {
    title: "2. Como Usamos seus Dados",
    content: `Seus dados são utilizados para:\n• Manter e operar sua conta na Plataforma.\n• Processar compras e gerenciar licenças de scripts.\n• Enviar notificações relevantes (compras, moderação, licenças).\n• Melhorar a experiência do usuário e segurança da Plataforma.\n• Detectar fraudes e atividades maliciosas.\n• Gerar estatísticas anônimas de uso.`
  },
  {
    title: "3. Compartilhamento de Dados",
    content: `Não vendemos seus dados pessoais. Compartilhamos informações apenas:\n• Com processadores de pagamento para completar transações.\n• Com Modders (apenas seu nome de usuário público) ao adquirir scripts.\n• Quando exigido por lei ou ordem judicial.\n• Para proteger direitos, segurança e propriedade da Plataforma.`
  },
  {
    title: "4. Armazenamento e Segurança",
    content: `Seus dados são armazenados em servidores seguros com criptografia em trânsito (TLS/SSL) e em repouso. Senhas são armazenadas usando hash bcrypt. Implementamos controles de acesso baseados em roles (RBAC) e políticas de segurança em nível de linha (RLS) no banco de dados. Apesar das medidas, nenhum sistema é 100% seguro.`
  },
  {
    title: "5. Cookies e Rastreamento",
    content: `Utilizamos cookies essenciais para:\n• Manter sua sessão de login ativa.\n• Lembrar suas preferências de interface.\n\nNão utilizamos cookies de rastreamento de terceiros para publicidade. Dados analíticos, quando coletados, são anonimizados.`
  },
  {
    title: "6. Seus Direitos (LGPD)",
    content: `De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:\n• **Acesso**: solicitar uma cópia dos seus dados pessoais.\n• **Correção**: corrigir dados incompletos ou desatualizados.\n• **Exclusão**: solicitar a remoção dos seus dados e conta.\n• **Portabilidade**: receber seus dados em formato estruturado.\n• **Revogação**: retirar consentimento a qualquer momento.\n\nPara exercer esses direitos, entre em contato pelo fórum ou painel da plataforma.`
  },
  {
    title: "7. Retenção de Dados",
    content: `Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão da conta:\n• Dados pessoais são removidos em até 30 dias.\n• Registros de transações financeiras são mantidos por 5 anos (obrigação legal).\n• Conteúdo público (scripts, tutoriais) pode ser anonimizado ao invés de removido.`
  },
  {
    title: "8. Menores de Idade",
    content: `A Plataforma não é destinada a menores de 13 anos. Se tomarmos conhecimento de que coletamos dados de menores sem consentimento parental, removeremos as informações o mais rápido possível.`
  },
  {
    title: "9. Alterações nesta Política",
    content: `Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas via notificação na Plataforma. O uso continuado após alterações constitui aceitação da nova política.`
  },
  {
    title: "10. Contato",
    content: `Para questões sobre privacidade e proteção de dados, entre em contato pelo sistema de mensagens da Plataforma ou pelo fórum na categoria "Suporte".`
  }
];

export default function PoliticaPrivacidade() {
  return (
    <Layout>
      <div className="container max-w-4xl py-12 sm:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-neon-green/10 border border-neon-green/20">
              <Shield className="h-6 w-6 text-neon-green" />
            </div>
            <div>
              <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                ~/legal/privacidade
              </p>
              <h1 className="text-2xl sm:text-3xl font-black font-mono">
                Política de <span className="text-neon-green">Privacidade</span>
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-mono border-l-2 border-neon-green/30 pl-4">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </motion.div>

        {/* Terminal-style content */}
        <div className="space-y-6">
          {sections.map((section, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 bg-background/40">
                <Terminal className="h-3.5 w-3.5 text-neon-green" />
                <span className="font-mono font-bold text-sm text-foreground">
                  {section.title}
                </span>
              </div>
              <div className="px-4 py-4">
                {section.content.split("\n").map((line, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-1.5 last:mb-0">
                    {line.startsWith("•") ? (
                      <span className="flex gap-2 items-start">
                        <ChevronRight className="h-3.5 w-3.5 text-neon-green mt-1 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                      </span>
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                    )}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-neon-green">$</span> Sua privacidade é importante para nós. Protegemos seus dados como protegemos nosso código.
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}
