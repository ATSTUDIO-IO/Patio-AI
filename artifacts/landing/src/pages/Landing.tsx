import React, { useEffect, useState, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";
import { CheckCircle2, ChevronRight, QrCode, Smartphone, MessageSquare, CarFront, Zap, Clock, ShieldCheck, Mail, Phone, ExternalLink, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatIA } from "@/components/ChatIA";
import { trackCTAClick, trackPlanClick, trackDemoClick, trackSectionView } from "@/lib/analytics";

// Number Counter Animation Hook
function AnimatedCounter({ value, duration = 2 }: { value: number, duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let start = 0;
      const end = value;
      const totalMilSecDur = duration * 1000;
      const incrementTime = (totalMilSecDur / end) * 5; // adjust for performance
      
      const timer = setInterval(() => {
        start += Math.ceil(end / (totalMilSecDur / 50));
        if (start > end) start = end;
        setCount(start);
        if (start === end) clearInterval(timer);
      }, 50);
      
      return () => clearInterval(timer);
    }
  }, [isInView, value, duration]);

  return <span ref={ref}>{count.toLocaleString('pt-BR')}</span>;
}

function useSectionTracking(sectionName: string) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-20%" });
  useEffect(() => {
    if (isInView) trackSectionView(sectionName);
  }, [isInView, sectionName]);
  return ref;
}

export default function Landing() {
  const painelUrl = "/painel/cadastro";

  const heroRef = useSectionTracking("hero");
  const comoFuncionaRef = useSectionTracking("como_funciona");
  const diferenciaisRef = useSectionTracking("diferenciais");
  const planosRef = useSectionTracking("planos");

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-cyan-accent selection:text-indigo-primary">
      
      {/* 1. NAVBAR */}
      <nav className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <span className="text-2xl font-bold tracking-tight text-indigo-primary">Pátio</span>
              <span className="text-2xl font-bold tracking-tight text-cyan-accent">AI</span>
            </div>
            
            <div className="hidden md:flex space-x-8 items-center">
              <a href="#como-funciona" className="text-sm font-medium text-gray-600 hover:text-indigo-primary transition-colors">Como funciona</a>
              <a href="#diferenciais" className="text-sm font-medium text-gray-600 hover:text-indigo-primary transition-colors">Diferenciais</a>
              <a href="#planos" className="text-sm font-medium text-gray-600 hover:text-indigo-primary transition-colors">Planos</a>
            </div>
            
            <div className="flex items-center gap-4">
              <a href="/painel/login" className="text-sm font-medium text-indigo-primary hover:text-indigo-800 transition-colors hidden sm:block">Login</a>
              <a href={painelUrl} onClick={() => trackCTAClick("navbar")} className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-indigo-primary hover:bg-indigo-900 rounded-lg transition-all shadow-sm hover:shadow-md">
                Começar grátis
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. HERO */}
      <section ref={heroRef} className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-indigo-primary flex items-center justify-center min-h-[90vh]">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-cyan-accent/20 blur-[120px]"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/30 blur-[100px]"
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white mb-8 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 rounded-full bg-cyan-accent"></span>
            <span className="text-xs font-medium tracking-wide uppercase">Sem cartão de crédito • Cancele quando quiser</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 max-w-4xl mx-auto leading-tight"
          >
            Seu veículo fala por <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-accent to-blue-400">si mesmo</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            QR code no para-brisa. Cliente escaneia. Agente de voz em português atende em segundos. Lead no CRM automático.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a href={painelUrl} onClick={() => trackCTAClick("hero")} className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-indigo-primary bg-cyan-accent hover:bg-cyan-400 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:-translate-y-1">
              Começar grátis
            </a>
            <a href="#demo" onClick={() => trackDemoClick()} className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-transparent border-2 border-white/20 hover:border-white/40 hover:bg-white/5 rounded-xl transition-all">
              Ver demo
            </a>
          </motion.div>
        </div>
      </section>

      {/* 3. MÉTRICAS ANIMADAS */}
      <section className="bg-white border-b border-gray-100 py-12 relative z-20 shadow-sm -mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center divide-x divide-gray-100">
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                <AnimatedCounter value={12000} /><span className="text-cyan-accent">+</span>
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Leads capturados</p>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                <AnimatedCounter value={98} /><span className="text-cyan-accent">%</span>
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Satisfação dos lojistas</p>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                24<span className="text-cyan-accent">/</span>7
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Disponibilidade</p>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-indigo-primary mb-2 flex justify-center items-center">
                <span className="text-cyan-accent mr-1">&lt;</span><AnimatedCounter value={3} />s
              </div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Tempo de resposta</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMO FUNCIONA */}
      <section id="como-funciona" ref={comoFuncionaRef} className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6">Como uma máquina de vendas funciona</h2>
            <p className="text-lg text-gray-600">Esqueça a planilha. Esqueça o WhatsApp não respondido no fim de semana. O processo é simples e automático.</p>
          </div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-12 relative"
          >
            {/* Linha conectora (Desktop apenas) */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-gray-200 via-cyan-accent/50 to-gray-200 z-0"></div>

            {/* Passo 1 */}
            <motion.div variants={item} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-lg border border-gray-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-cyan-accent/20">
                <QrCode className="w-10 h-10 text-indigo-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1. Lojista cola o QR</h3>
              <p className="text-gray-600 leading-relaxed">Gere um QR code único para cada veículo no seu pátio e cole no para-brisa em segundos.</p>
            </motion.div>

            {/* Passo 2 */}
            <motion.div variants={item} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-2xl bg-indigo-primary shadow-lg border border-indigo-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-cyan-accent/40 relative">
                <div className="absolute inset-0 bg-cyan-accent/20 rounded-2xl animate-ping"></div>
                <Smartphone className="w-10 h-10 text-cyan-accent relative z-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">2. Cliente fala com IA</h3>
              <p className="text-gray-600 leading-relaxed">O cliente escaneia com o celular e tira dúvidas com um agente de voz natural 24/7.</p>
            </motion.div>

            {/* Passo 3 */}
            <motion.div variants={item} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-2xl bg-cyan-accent shadow-lg border border-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-cyan-accent/30">
                <CheckCircle2 className="w-10 h-10 text-indigo-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">3. Lead no CRM</h3>
              <p className="text-gray-600 leading-relaxed">Nome, telefone, veículo e intenção de compra caem no seu painel organizados na hora.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 6. DEMO ANIMADA (Intercalada antes de diferenciais para quebrar o ritmo) */}
      <section id="demo" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6 leading-tight">
                Uma conversa natural que <span className="text-cyan-accent">vende.</span>
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Nenhuma inteligência artificial genérica. O PátioAI foi treinado com milhares de negociações de veículos para entender gírias, simular financiamentos reais e capturar o lead no momento de maior interesse.
              </p>
              <ul className="space-y-4 mb-10">
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-cyan-accent/20 p-1 rounded-full"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /></div>
                  <span className="text-gray-700 font-medium">Responde perguntas técnicas do veículo</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-cyan-accent/20 p-1 rounded-full"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /></div>
                  <span className="text-gray-700 font-medium">Faz pré-avaliação de carro na troca</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 bg-cyan-accent/20 p-1 rounded-full"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /></div>
                  <span className="text-gray-700 font-medium">Extrai nome e contato sutilmente</span>
                </li>
              </ul>
              <a href={painelUrl} onClick={() => trackCTAClick("demo_section")} className="inline-flex items-center font-bold text-indigo-primary hover:text-cyan-accent transition-colors">
                Criar conta para testar <ChevronRight className="w-5 h-5 ml-1" />
              </a>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 lg:order-2 flex justify-center lg:justify-end"
            >
              {/* Celular Mockup */}
              <div className="relative w-[300px] h-[600px] bg-gray-900 rounded-[40px] border-[8px] border-gray-800 shadow-2xl overflow-hidden flex flex-col">
                <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 rounded-b-xl w-40 mx-auto z-20"></div>
                
                {/* Header App */}
                <div className="bg-indigo-primary pt-10 pb-4 px-4 flex items-center gap-3 z-10 shadow-md">
                  <div className="w-10 h-10 rounded-full bg-cyan-accent flex items-center justify-center text-indigo-primary font-bold">
                    IA
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">Consultor PátioAI</h4>
                    <p className="text-cyan-accent text-xs">Online agora</p>
                  </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 bg-gray-50 p-4 overflow-hidden flex flex-col gap-4 relative">
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className="self-end max-w-[85%]"
                  >
                    <div className="bg-indigo-primary text-white text-sm py-2 px-3 rounded-2xl rounded-tr-sm shadow-sm">
                      Quanto custa esse Civic? Tem financiamento?
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.5 }}
                    className="self-start max-w-[85%]"
                  >
                    <div className="bg-white border border-gray-200 text-gray-800 text-sm py-2 px-3 rounded-2xl rounded-tl-sm shadow-sm">
                      Oi! O Honda Civic 2022 está por R$89.900. Com entrada de 20%, as parcelas ficam em torno de R$1.680/mês em 48x. Quer simular outro valor?
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 3.5 }}
                    className="self-end max-w-[85%]"
                  >
                    <div className="bg-indigo-primary text-white text-sm py-2 px-3 rounded-2xl rounded-tr-sm shadow-sm">
                      Pode ser! E aceita meu carro na troca?
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 4.5 }}
                    className="self-start max-w-[85%]"
                  >
                    <div className="bg-white border border-gray-200 text-gray-800 text-sm py-2 px-3 rounded-2xl rounded-tl-sm shadow-sm">
                      Com certeza! Me fala o modelo e o ano que já te passo uma estimativa. E qual seu nome?
                    </div>
                  </motion.div>

                  {/* Typing indicator */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 6.5, repeat: Infinity, repeatDelay: 5 }}
                    className="self-start mt-2"
                  >
                    <div className="bg-gray-200 rounded-full px-3 py-2 flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </motion.div>
                </div>

                {/* Input area */}
                <div className="bg-white p-3 border-t border-gray-200 flex gap-2 items-center">
                  <div className="flex-1 bg-gray-100 rounded-full h-10 px-4 flex items-center text-gray-400 text-sm">Mensagem...</div>
                  <div className="w-10 h-10 bg-indigo-primary rounded-full flex items-center justify-center text-white">
                    <Send className="w-4 h-4" />
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. DIFERENCIAIS */}
      <section id="diferenciais" ref={diferenciaisRef} className="py-24 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6">Tudo que sua loja precisa</h2>
            <p className="text-lg text-gray-600">Não é só um chatbot. É um ecossistema completo desenhado especificamente para revendas de veículos.</p>
          </div>

          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Card 1 */}
            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center mb-6">
                <Clock className="w-7 h-7 text-indigo-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Voz em Português 24/7</h3>
              <p className="text-gray-600 leading-relaxed">Seu cliente escaneia o carro no domingo à noite e recebe atendimento impecável na hora. Nunca mais perca venda por falta de resposta.</p>
            </motion.div>

            {/* Card 2 */}
            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-cyan-50 flex items-center justify-center mb-6">
                <Database className="w-7 h-7 text-cyan-accent" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">CRM Automático</h3>
              <p className="text-gray-600 leading-relaxed">Adeus preenchimento manual. O PátioAI extrai nome, telefone, email e intenção de compra da conversa e organiza tudo em um funil Kanban visual.</p>
            </motion.div>

            {/* Card 3 */}
            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center mb-6">
                <Calculator className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Simulação de Financiamento</h3>
              <p className="text-gray-600 leading-relaxed">A IA é capaz de calcular parcelas aproximadas com base nas taxas de mercado e valor de entrada que o cliente informar na hora.</p>
            </motion.div>

            {/* Card 4 */}
            <motion.div variants={item} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center mb-6">
                <Printer className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">QR Único por Veículo</h3>
              <p className="text-gray-600 leading-relaxed">Cada placa ganha um link e QR code exclusivos. Rastreável, substituível e imprimível em 1 clique direto no painel.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 7. PLANOS */}
      <section id="planos" ref={planosRef} className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-indigo-primary mb-6">Preços simples, sem surpresa</h2>
            <p className="text-lg text-gray-600">Escolha o plano ideal para o tamanho do seu pátio. Todos incluem 14 dias de teste grátis.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col mt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-gray-900">R$129,90</span>
                <span className="text-gray-500 ml-2">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">60 conversas/mês</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">1 usuário</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">CRM Básico</span></li>
                <li className="flex items-center gap-3 opacity-50"><Minus className="w-5 h-5 text-gray-400" /><span className="text-gray-500">Financiamento IA</span></li>
                <li className="flex items-center gap-3 opacity-50"><Minus className="w-5 h-5 text-gray-400" /><span className="text-gray-500">Personalização</span></li>
              </ul>
              <a href={painelUrl} onClick={() => trackPlanClick("starter")} className="w-full block text-center px-6 py-3 rounded-xl border-2 border-indigo-primary text-indigo-primary font-bold hover:bg-indigo-50 transition-colors">
                Começar agora
              </a>
            </div>

            {/* Pro - Destaque */}
            <div className="bg-indigo-primary rounded-3xl p-8 border-2 border-cyan-accent shadow-2xl flex flex-col relative transform md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cyan-accent text-indigo-primary font-bold px-4 py-1 rounded-full text-sm">
                Mais Popular
              </div>
              <h3 className="text-xl font-semibold text-cyan-accent mb-2">Pro</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-white">R$249,90</span>
                <span className="text-gray-300 ml-2">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /><span className="text-white">200 conversas/mês</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /><span className="text-white">5 usuários</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /><span className="text-white">CRM Completo</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /><span className="text-white">Financiamento IA</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /><span className="text-white">Personalização</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-cyan-accent" /><span className="text-white">Suporte Prioritário</span></li>
              </ul>
              <a href={painelUrl} onClick={() => trackPlanClick("pro")} className="w-full block text-center px-6 py-3 rounded-xl bg-cyan-accent text-indigo-primary font-bold hover:bg-cyan-400 transition-colors shadow-lg">
                Começar agora
              </a>
            </div>

            {/* Full */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col mt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Full</h3>
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-extrabold text-gray-900">R$449,90</span>
                <span className="text-gray-500 ml-2">/mês</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">500 conversas/mês</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">Usuários ilimitados</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">CRM Completo</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">Financiamento IA</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">Relatórios Avançados</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">Suporte Prioritário</span></li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-indigo-primary" /><span className="text-gray-600">Consulta Documental</span></li>
              </ul>
              <a href={painelUrl} onClick={() => trackPlanClick("full")} className="w-full block text-center px-6 py-3 rounded-xl border-2 border-indigo-primary text-indigo-primary font-bold hover:bg-indigo-50 transition-colors">
                Começar agora
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 9. CTA FINAL */}
      <section className="py-24 bg-indigo-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl bg-cyan-accent/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            Cada minuto sem o PátioAI é um <span className="text-cyan-accent underline decoration-4 underline-offset-8">lead perdido.</span>
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Centenas de lojistas já capturando leads com IA. Comece hoje e veja o resultado no primeiro fim de semana.
          </p>
          
          <div className="flex flex-col items-center justify-center">
            <a href={painelUrl} onClick={() => trackCTAClick("cta_final")} className="inline-flex items-center justify-center px-10 py-5 text-lg font-bold text-indigo-primary bg-cyan-accent hover:bg-cyan-400 rounded-xl transition-all shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_40px_rgba(6,182,212,0.7)] hover:-translate-y-1 w-full sm:w-auto">
              Criar conta grátis
            </a>
            <p className="mt-4 text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Configuração em menos de 5 minutos
            </p>
          </div>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-white">Pátio</span>
            <span className="text-2xl font-bold tracking-tight text-cyan-accent">AI</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-cyan-accent transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-cyan-accent transition-colors">Privacidade</a>
            <a href="#" className="hover:text-cyan-accent transition-colors">Contato</a>
          </div>
          
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} PátioAI. Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* Chat Flutuante */}
      <ChatIA />
    </div>
  );
}

// Icon fallbacks para ícones não exportados diretamente no topo
function Database(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>;
}

function Calculator(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>;
}

function Printer(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>;
}

function Minus(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="5" x2="19" y1="12" y2="12"/></svg>;
}
