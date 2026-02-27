import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Monitor, ExternalLink, Download, Shield, Cpu, Box, Gamepad2, Wrench } from "lucide-react";
import { motion } from "framer-motion";

interface Tool {
  name: string;
  description: string;
  icon: React.ReactNode;
  platform: "android" | "pc" | "both";
  category: "cheat-engine" | "virtualizer" | "utility";
  downloadUrl?: string;
  externalUrl?: string;
  tags: string[];
}

const tools: Tool[] = [
  {
    name: "GameGuardian",
    description: "Editor de memória para jogos Android. Permite modificar valores de HP, moedas, itens e muito mais em tempo real.",
    icon: <Gamepad2 className="h-6 w-6" />,
    platform: "android",
    category: "cheat-engine",
    externalUrl: "https://gameguardian.net",
    tags: ["Memory Editor", "Root", "Virtual Space"],
  },
  {
    name: "Cheat Engine",
    description: "O mais popular editor de memória para PC. Permite escanear e modificar valores em jogos, criar trainers e tabelas.",
    icon: <Shield className="h-6 w-6" />,
    platform: "pc",
    category: "cheat-engine",
    externalUrl: "https://cheatengine.org",
    tags: ["Memory Scanner", "Trainer", "Tables"],
  },
  {
    name: "VMOS Pro",
    description: "Máquina virtual Android dentro do seu celular. Rode um segundo Android com root sem precisar rootear seu dispositivo principal.",
    icon: <Smartphone className="h-6 w-6" />,
    platform: "android",
    category: "virtualizer",
    externalUrl: "https://www.vmos.com",
    tags: ["Virtual Machine", "Root", "Sem Root no Host"],
  },
  {
    name: "Virtual Master",
    description: "Virtualizador leve para Android. Crie espaços virtuais para rodar apps clonados com permissões root.",
    icon: <Box className="h-6 w-6" />,
    platform: "android",
    category: "virtualizer",
    externalUrl: "#",
    tags: ["Clone Apps", "Root", "Leve"],
  },
  {
    name: "X8 Sandbox",
    description: "Ambiente virtual Android com root integrado. Ideal para rodar GameGuardian sem root no dispositivo real.",
    icon: <Cpu className="h-6 w-6" />,
    platform: "android",
    category: "virtualizer",
    externalUrl: "#",
    tags: ["Sandbox", "Root", "GameGuardian"],
  },
  {
    name: "BlueStacks",
    description: "Emulador Android para PC. Rode jogos e apps mobile no computador com ótimo desempenho e compatibilidade.",
    icon: <Monitor className="h-6 w-6" />,
    platform: "pc",
    category: "virtualizer",
    externalUrl: "https://www.bluestacks.com",
    tags: ["Emulador", "Android no PC", "Gaming"],
  },
  {
    name: "LDPlayer",
    description: "Emulador Android leve e otimizado para jogos. Suporte a múltiplas instâncias e mapeamento de teclado.",
    icon: <Monitor className="h-6 w-6" />,
    platform: "pc",
    category: "virtualizer",
    externalUrl: "https://www.ldplayer.net",
    tags: ["Emulador", "Multi-instância", "Leve"],
  },
  {
    name: "ArtMoney",
    description: "Editor de memória clássico para PC. Simples e direto para modificar valores de jogos.",
    icon: <Wrench className="h-6 w-6" />,
    platform: "pc",
    category: "cheat-engine",
    externalUrl: "http://www.artmoney.ru",
    tags: ["Memory Editor", "Clássico", "Simples"],
  },
  {
    name: "Parallel Space",
    description: "Clone e rode múltiplas contas de apps no Android. Útil para testar mods sem afetar a conta principal.",
    icon: <Smartphone className="h-6 w-6" />,
    platform: "android",
    category: "utility",
    externalUrl: "#",
    tags: ["Multi-conta", "Clone", "Seguro"],
  },
];

const categoryLabels: Record<string, string> = {
  "cheat-engine": "Editores de Memória",
  virtualizer: "Virtualizadores / Emuladores",
  utility: "Utilitários",
};

const platformIcon = (p: string) =>
  p === "android" ? <Smartphone className="h-4 w-4" /> : p === "pc" ? <Monitor className="h-4 w-4" /> : null;

const platformLabel = (p: string) =>
  p === "android" ? "Android" : p === "pc" ? "PC" : "Ambos";

export default function Ferramentas() {
  const filterTools = (platform?: string) =>
    platform ? tools.filter((t) => t.platform === platform || t.platform === "both") : tools;

  const renderGrid = (filtered: Tool[]) => {
    const grouped: Record<string, Tool[]> = {};
    filtered.forEach((t) => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    });

    return Object.entries(grouped).map(([cat, items]) => (
      <div key={cat} className="space-y-4">
        <h2 className="text-lg font-semibold font-mono text-neon-green flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          {categoryLabels[cat] ?? cat}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((tool, i) => (
            <motion.div
              key={tool.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full border-border/50 hover:neon-border transition-all duration-300 group">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-secondary text-neon-purple">
                      {tool.icon}
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      {platformIcon(tool.platform)}
                      {platformLabel(tool.platform)}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-base mb-1 group-hover:text-neon-purple transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3 flex-1">
                    {tool.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tool.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {tool.externalUrl && tool.externalUrl !== "#" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        asChild
                      >
                        <a href={tool.externalUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Site Oficial
                        </a>
                      </Button>
                    )}
                    {tool.downloadUrl && (
                      <Button size="sm" className="flex-1 text-xs neon-glow-purple" asChild>
                        <a href={tool.downloadUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-mono mb-2">
            <span className="text-neon-purple">Ferramentas</span> & Instalações
          </h1>
          <p className="text-muted-foreground">
            Tudo que você precisa para começar a moddar — editores de memória, virtualizadores e emuladores para Android e PC.
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-secondary">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="android" className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Android
            </TabsTrigger>
            <TabsTrigger value="pc" className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" /> PC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8 mt-6">
            {renderGrid(filterTools())}
          </TabsContent>
          <TabsContent value="android" className="space-y-8 mt-6">
            {renderGrid(filterTools("android"))}
          </TabsContent>
          <TabsContent value="pc" className="space-y-8 mt-6">
            {renderGrid(filterTools("pc"))}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
