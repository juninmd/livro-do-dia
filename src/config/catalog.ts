export interface CatalogBook {
  /** Título em português (usado na busca do Google Books e da Amazon). */
  title: string;
  author: string;
  /** Categoria curta exibida no post. */
  category: string;
}

/**
 * Curadoria fixa no espírito de "Nada Pode Me Ferir" e "Os Segredos da Mente Milionária":
 * mentalidade, disciplina, hábitos, dinheiro, estoicismo, performance e negócios.
 */
export const catalog: CatalogBook[] = [
  {
    title: "Nada Pode Me Ferir",
    author: "David Goggins",
    category: "Mentalidade & Disciplina",
  },
  {
    title: "Never Finished",
    author: "David Goggins",
    category: "Mentalidade & Disciplina",
  },
  {
    title: "Os Segredos da Mente Milionária",
    author: "T. Harv Eker",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "Pai Rico, Pai Pobre",
    author: "Robert Kiyosaki",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "O Homem Mais Rico da Babilônia",
    author: "George S. Clason",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "A Psicologia Financeira",
    author: "Morgan Housel",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "Do Mil ao Milhão",
    author: "Thiago Nigro",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "Os Axiomas de Zurique",
    author: "Max Gunther",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "Quem Pensa Enriquece",
    author: "Napoleon Hill",
    category: "Dinheiro & Mentalidade",
  },
  {
    title: "O Investidor Inteligente",
    author: "Benjamin Graham",
    category: "Investimentos",
  },
  {
    title: "Hábitos Atômicos",
    author: "James Clear",
    category: "Hábitos & Produtividade",
  },
  {
    title: "O Poder do Hábito",
    author: "Charles Duhigg",
    category: "Hábitos & Produtividade",
  },
  {
    title: "Trabalho Focado",
    author: "Cal Newport",
    category: "Hábitos & Produtividade",
  },
  { title: "Essencialismo", author: "Greg McKeown", category: "Hábitos & Produtividade" },
  { title: "A Única Coisa", author: "Gary Keller", category: "Hábitos & Produtividade" },
  {
    title: "O Milagre da Manhã",
    author: "Hal Elrod",
    category: "Hábitos & Produtividade",
  },
  {
    title: "Comece pelo Porquê",
    author: "Simon Sinek",
    category: "Propósito & Liderança",
  },
  {
    title: "Mindset: A Nova Psicologia do Sucesso",
    author: "Carol S. Dweck",
    category: "Mentalidade & Disciplina",
  },
  {
    title: "Garra: O Poder da Paixão e da Perseverança",
    author: "Angela Duckworth",
    category: "Mentalidade & Disciplina",
  },
  {
    title: "A Coragem de Ser Imperfeito",
    author: "Brené Brown",
    category: "Autoconhecimento",
  },
  { title: "Meditações", author: "Marco Aurélio", category: "Estoicismo" },
  { title: "O Obstáculo é o Caminho", author: "Ryan Holiday", category: "Estoicismo" },
  { title: "O Ego é Seu Inimigo", author: "Ryan Holiday", category: "Estoicismo" },
  { title: "Cartas de um Estoico", author: "Sêneca", category: "Estoicismo" },
  {
    title: "A Sutil Arte de Ligar o F*da-se",
    author: "Mark Manson",
    category: "Autoconhecimento",
  },
  {
    title: "Rápido e Devagar: Duas Formas de Pensar",
    author: "Daniel Kahneman",
    category: "Decisão & Comportamento",
  },
  {
    title: "As Armas da Persuasão",
    author: "Robert Cialdini",
    category: "Decisão & Comportamento",
  },
  {
    title: "Como Fazer Amigos e Influenciar Pessoas",
    author: "Dale Carnegie",
    category: "Relações & Comunicação",
  },
  {
    title: "Comunicação Não-Violenta",
    author: "Marshall Rosenberg",
    category: "Relações & Comunicação",
  },
  {
    title: "Negocie Como Se Sua Vida Dependesse Disso",
    author: "Chris Voss",
    category: "Relações & Comunicação",
  },
  {
    title: "Antifrágil",
    author: "Nassim Nicholas Taleb",
    category: "Risco & Estratégia",
  },
  {
    title: "A Lógica do Cisne Negro",
    author: "Nassim Nicholas Taleb",
    category: "Risco & Estratégia",
  },
  {
    title: "As 48 Leis do Poder",
    author: "Robert Greene",
    category: "Risco & Estratégia",
  },
  { title: "Maestria", author: "Robert Greene", category: "Risco & Estratégia" },
  { title: "A Arte da Guerra", author: "Sun Tzu", category: "Risco & Estratégia" },
  { title: "Do Zero ao Um", author: "Peter Thiel", category: "Negócios & Startups" },
  { title: "A Startup Enxuta", author: "Eric Ries", category: "Negócios & Startups" },
  {
    title: "12 Meses para 1 Milhão",
    author: "Ryan Daniel Moran",
    category: "Negócios & Startups",
  },
  {
    title: "O Mito do Empreendedor",
    author: "Michael Gerber",
    category: "Negócios & Startups",
  },
  {
    title: "Empresas Feitas para Vencer",
    author: "Jim Collins",
    category: "Negócios & Startups",
  },
  {
    title: "A Regra é Não Ter Regras",
    author: "Reed Hastings",
    category: "Negócios & Startups",
  },
  {
    title: "Sapiens: Uma Breve História da Humanidade",
    author: "Yuval Noah Harari",
    category: "Visão de Mundo",
  },
  {
    title: "O Homem em Busca de um Sentido",
    author: "Viktor Frankl",
    category: "Visão de Mundo",
  },
  {
    title: "12 Regras para a Vida",
    author: "Jordan Peterson",
    category: "Visão de Mundo",
  },
  {
    title: "Os 7 Hábitos das Pessoas Altamente Eficazes",
    author: "Stephen Covey",
    category: "Hábitos & Produtividade",
  },
  {
    title: "Por Que Dormimos",
    author: "Matthew Walker",
    category: "Corpo & Performance",
  },
  {
    title: "Foco: A Atenção e Seu Papel Fundamental para o Sucesso",
    author: "Daniel Goleman",
    category: "Corpo & Performance",
  },
  {
    title: "Inteligência Emocional",
    author: "Daniel Goleman",
    category: "Corpo & Performance",
  },
  {
    title: "O Corpo Guarda as Marcas",
    author: "Bessel van der Kolk",
    category: "Corpo & Performance",
  },
  { title: "Roube Como um Artista", author: "Austin Kleon", category: "Criatividade" },
  { title: "A Guerra da Arte", author: "Steven Pressfield", category: "Criatividade" },
  { title: "O Poder do Agora", author: "Eckhart Tolle", category: "Autoconhecimento" },
  {
    title: "Ikigai: Os Segredos dos Japoneses para uma Vida Longa e Feliz",
    author: "Héctor García",
    category: "Autoconhecimento",
  },
  { title: "O Alquimista", author: "Paulo Coelho", category: "Autoconhecimento" },
  { title: "O Príncipe", author: "Nicolau Maquiavel", category: "Risco & Estratégia" },
  {
    title: "Trabalhe 4 Horas por Semana",
    author: "Timothy Ferriss",
    category: "Hábitos & Produtividade",
  },
  {
    title: "Ferramentas dos Titãs",
    author: "Timothy Ferriss",
    category: "Mentalidade & Disciplina",
  },
  { title: "A Regra 10x", author: "Grant Cardone", category: "Mentalidade & Disciplina" },
  {
    title: "Disciplina é Liberdade",
    author: "Jocko Willink",
    category: "Mentalidade & Disciplina",
  },
  {
    title: "Como Chegar ao Sim",
    author: "Roger Fisher",
    category: "Relações & Comunicação",
  },
];
