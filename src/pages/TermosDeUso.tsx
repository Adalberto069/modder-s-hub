import { Layout } from "@/components/layout/Layout";
import { Terminal, ChevronRight, Scale } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  {
    title: "1. Aceitação dos Termos",
    content: `Ao acessar e usar a plataforma HiddenMod ("Plataforma"), você concorda com estes Termos de Uso. Se não concordar, não utilize nossos serviços. Reservamo-nos o direito de atualizar estes termos a qualquer momento, notificando os usuários sobre mudanças significativas.`
  },
  {
    title: "2. Definições",
    content: `• **Plataforma**: o site HiddenMod e todos os serviços associados.\n• **Usuário**: qualquer pessoa que acesse ou use a Plataforma.\n• **Modder**: usuário com permissão aprovada para publicar scripts.\n• **Script**: código Lua ou similar publicado na Plataforma.\n• **Licença**: autorização digital de uso de um script pago.`
  },
  {
    title: "3. Cadastro e Conta",
    content: `Para usar funcionalidades da Plataforma, você deve criar uma conta com informações verdadeiras. Você é responsável por manter a confidencialidade de suas credenciais. Atividades realizadas sob sua conta são de sua responsabilidade. Contas com informações falsas poderão ser suspensas ou removidas.`
  },
  {
    title: "4. Uso Permitido",
    content: `A Plataforma é destinada a fins educacionais e de desenvolvimento. É proibido:\n• Usar scripts para obter vantagem ilegal em jogos online competitivos com anti-cheat ativo.\n• Distribuir malware, vírus ou código malicioso.\n• Violar direitos autorais de terceiros.\n• Realizar engenharia reversa de scripts protegidos.\n• Compartilhar licenças, chaves de acesso ou senhas com terceiros.\n• Usar a Plataforma para atividades ilegais.`
  },
  {
    title: "5. Propriedade Intelectual",
    content: `Os scripts publicados permanecem propriedade intelectual de seus respectivos autores (Modders). A Plataforma atua apenas como intermediária. Ao publicar, o Modder concede à Plataforma uma licença não exclusiva para hospedar, exibir e distribuir o conteúdo. Usuários que adquirem licenças recebem apenas direito de uso pessoal.`
  },
  {
    title: "6. Pagamentos e Reembolsos",
    content: `Pagamentos são processados via integrações de terceiros (PIX/MercadoPago). A Plataforma retém uma comissão sobre vendas de scripts pagos. Reembolsos podem ser solicitados em até 7 dias após a compra, desde que o script não tenha sido baixado. Após o download, reembolsos ficam a critério do Modder e da administração.`
  },
  {
    title: "7. Moderação e Análise de Segurança",
    content: `Todos os scripts passam por análise automática e/ou manual antes da publicação. A Plataforma reserva-se o direito de remover ou suspender scripts que violem estes termos, contenham código malicioso ou recebam denúncias fundamentadas. Decisões de moderação podem ser contestadas via sistema de mensagens.`
  },
  {
    title: "8. Isenção de Responsabilidade",
    content: `A Plataforma é fornecida "como está". Não garantimos que scripts funcionem em todos os dispositivos, jogos ou versões. Não nos responsabilizamos por banimentos em jogos decorrentes do uso de scripts. O uso é por conta e risco do usuário. Não nos responsabilizamos por danos diretos ou indiretos.`
  },
  {
    title: "9. Suspensão e Encerramento",
    content: `Podemos suspender ou encerrar sua conta a qualquer momento por violação destes termos, sem aviso prévio em casos graves. Em caso de encerramento, licenças ativas podem ser revogadas sem reembolso se a causa for violação dos termos.`
  },
  {
    title: "10. Disposições Gerais",
    content: `Estes termos são regidos pelas leis brasileiras. Questões não previstas serão resolvidas de boa-fé entre as partes. A nulidade de qualquer cláusula não afeta as demais. Ao continuar usando a Plataforma após alterações, você aceita os novos termos.`
  }
];

export default function TermosDeUso() {
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
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
                ~/legal/termos
              </p>
              <h1 className="text-2xl sm:text-3xl font-black font-mono">
                Termos de <span className="text-primary">Uso</span>
              </h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-mono border-l-2 border-primary/30 pl-4">
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
              {/* Section header - terminal style */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 bg-background/40">
                <Terminal className="h-3.5 w-3.5 text-neon-green" />
                <span className="font-mono font-bold text-sm text-foreground">
                  {section.title}
                </span>
              </div>
              {/* Content */}
              <div className="px-4 py-4">
                {section.content.split("\n").map((line, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-1.5 last:mb-0">
                    {line.startsWith("•") ? (
                      <span className="flex gap-2 items-start">
                        <ChevronRight className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />
                        <span>{line.slice(2)}</span>
                      </span>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 text-center"
        >
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-neon-green">$</span> Dúvidas? Entre em contato pelo fórum ou painel da plataforma.
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}
