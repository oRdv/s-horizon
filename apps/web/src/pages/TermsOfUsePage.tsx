import { LegalDocumentPage, type LegalSection } from '@/components/LegalDocumentPage'

const termsSections: LegalSection[] = [
  {
    title: '1. Generalidades',
    items: [
      '1.1. Esteja ciente destes termos e condições ao utilizar nosso site e nossos serviços.',
      '1.2. O uso do nosso site está sujeito aos termos e condições apresentados nesta página.',
      '1.3. Você é responsável por conhecer estes termos e respeitá-los ao utilizar nosso site ou qualquer serviço.',
      '1.4. Caso não concorde com estes termos e condições, entre em contato conosco e não utilize os serviços.',
      '1.5. A Horizon está disponível em https://www.horizonboost.com.br.',
    ],
  },
  {
    title: '2. Privacidade e confidencialidade',
    items: [
      '2.1. É proibido utilizar ou divulgar dados de clientes, jogadores ou profissionais envolvidos na prestação dos serviços.',
      '2.2. O cliente concorda em manter sob sigilo os dados dos profissionais da Horizon e em respeitar a propriedade intelectual e a imagem da empresa.',
    ],
  },
  {
    title: '3. Relação com outras empresas',
    items: [
      '3.1. A Horizon não reivindica afiliação, associação ou endosso de terceiros, salvo quando isso for expressamente declarado.',
      '3.2. A Horizon não reivindica propriedade intelectual de outras empresas ou afiliados. Direitos autorais e marcas pertencem aos respectivos proprietários.',
      '3.3. O cliente reconhece que a Horizon não possui relação com associações ou afiliados de empresas mencionadas no site.',
      '3.4. Cada jogo e produto possui marcas de seus respectivos proprietários; seu uso no site não representa afiliação, associação ou endosso.',
    ],
  },
  {
    title: '4. Deveres do cliente',
    items: [
      '4.1. O cliente reconhece que a Horizon não está associada a empresas, associações, filiações ou outras entidades mencionadas nos serviços.',
      '4.2. Todas as partes devem se abster de violar direitos de propriedade intelectual de empresas ou entidades responsáveis.',
      '4.3. Ao acessar nosso site ou suas extensões, incluindo conteúdos disponibilizados em outras plataformas, você declara que não atua em nome de entidade interessada em infringir ou prejudicar os serviços da Horizon.',
      '4.4. Ao adquirir um serviço, o cliente declara que compreende o que está comprando e que fornecerá corretamente as informações necessárias para a execução do pedido.',
    ],
  },
  {
    title: '5. Pagamentos e disputas',
    items: [
      '5.1. O cliente reconhece que as regras de proteção ao comprador variam conforme o meio de pagamento, como PayPal, Mercado Pago, cartões ou outras instituições financeiras.',
      '5.2. Qualquer divergência deve ser apresentada inicialmente ao nosso suporte para tentativa de mediação.',
      '5.3. Abrir uma disputa indevida após o início ou a conclusão do serviço poderá caracterizar violação destes termos.',
      '5.4. A empresa poderá adotar medidas contra fraudes, disputas indevidas ou estornos, respeitando a legislação aplicável.',
      '5.5. A Horizon reserva-se o direito de tomar as medidas legais cabíveis em casos de fraude financeira relacionada à compra de serviços no site.',
    ],
  },
  {
    title: '6. Responsabilidades do cliente',
    items: [
      '6.1. O cliente aceita os riscos relacionados a alterações de pontuação, séries de promoção, runas e configurações necessárias durante a execução do serviço.',
      '6.2. O cliente reconhece que profissionais poderão utilizar recursos disponíveis na conta, como Essência Azul, quando isso for necessário para a execução do pedido.',
      '6.3. O cliente não deverá jogar na conta enquanto o serviço estiver ativo. Partidas realizadas nesse período poderão afetar o resultado contratado.',
      '6.4. Caso o cliente jogue durante um serviço ativo e altere o progresso contratado, a Horizon poderá suspender ou encerrar o pedido conforme o trabalho já executado.',
      '6.5. Se o ganho de PDL estiver abaixo do esperado para a divisão contratada, poderá ser necessário ajustar o valor ou converter o pedido em vitórias, sempre com comunicação ao cliente.',
      '6.6. Estornos indevidos relacionados a serviços iniciados ou concluídos deverão ser solucionados com a Horizon e poderão gerar cobrança dos valores e custos aplicáveis.',
      '6.7. Reivindicações abertas após a conclusão ou o início do pedido serão analisadas conforme o serviço prestado e estes Termos de Uso.',
      '6.8. Fraudes ou contestações indevidas poderão ser encaminhadas para cobrança, observada a legislação aplicável e os custos relacionados.',
    ],
  },
  {
    title: '7. Garantia de conta unranked nível 30',
    items: [
      '7.1. A garantia não cobre mau uso, utilização de softwares proibidos ou situações em que a conta apresente histórico incompatível com as condições informadas no momento da compra.',
    ],
  },
  {
    title: '8. Reembolso de arquivos digitais',
    items: [
      '8.1. Arquivos digitais, softwares, ebooks e outros itens eletrônicos somente poderão ser reembolsados se ainda não tiverem sido baixados ou acessados, respeitadas as regras legais aplicáveis.',
    ],
  },
  {
    title: '9. Identificação de conta',
    items: [
      '9.1. Quando necessário para segurança ou prevenção de fraude, o cliente poderá ser solicitado a confirmar sua identidade e a veracidade dos dados informados.',
    ],
  },
  {
    title: '10. Reembolso de contas revendidas',
    items: [
      '10.1. Em aquisições de contas revendidas, contatos externos ou alterações não autorizadas poderão afetar o reembolso. Se houver devolução financeira, poderá ser descontada a tarifa operacional informada na contratação.',
    ],
  },
  {
    title: '11. Reembolso de serviços',
    items: [
      '11.1. O cliente poderá solicitar reembolso em até 48 horas após a compra caso o serviço não tenha sido iniciado dentro do prazo de entrega informado. A solicitação deverá ser feita ao suporte.',
    ],
  },
  {
    title: '12. Prazo de conclusão',
    items: [
      '12.1. Pedidos não concluídos dentro do prazo serão avaliados conforme o progresso realizado e as condições do serviço contratado.',
      '12.2. Caso o serviço seja iniciado e não concluído no prazo informado, poderá ser concedido novo prazo de até três dias e, quando aplicável, vitórias adicionais proporcionais ao que foi realizado.',
    ],
  },
  {
    title: '13. Direito de acompanhamento',
    items: [
      '13.1. O cliente poderá acompanhar o processo e esclarecer dúvidas com o profissional responsável por meio dos canais disponibilizados pela Horizon.',
    ],
  },
  {
    title: '14. Idioma',
    items: [
      '14.1. Em serviços Duo ou de coaching, o cliente poderá informar o idioma desejado, sujeito à disponibilidade de profissionais ou de tradução.',
    ],
  },
  {
    title: '15. Serviços disponíveis',
    items: [
      '15.1. A Horizon oferece serviços Solo, Duo, vitórias, MD5 e coaching, conforme as opções, quantidades, prazos e valores apresentados no momento da contratação.',
    ],
  },
  {
    title: '16. Riscos e responsabilidades',
    items: [
      '16.1. Serviços de evolução de conta podem contrariar regras de determinadas plataformas de jogos. Embora sejam adotadas precauções de segurança, o cliente reconhece os riscos e a possibilidade de medidas aplicadas por terceiros à sua conta.',
    ],
  },
  {
    title: '17. Inatividade',
    items: [
      '17.1. Se, após a compra, o cliente permanecer inativo por 28 dias ou mais e não demonstrar interesse em continuar o serviço, o pedido poderá ser encerrado de acordo com o progresso realizado.',
    ],
  },
  {
    title: '18. Legislação aplicável',
    items: [
      '18.1. Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Disputas e demais questões relacionadas serão analisadas conforme a legislação brasileira aplicável.',
    ],
  },
]

export function TermsOfUsePage() {
  return (
    <LegalDocumentPage
      eyebrow="Termos legais"
      intro="Leia atentamente as condições aplicáveis ao acesso ao site, à contratação e ao acompanhamento dos serviços oferecidos pela Horizon."
      sections={termsSections}
      title="Termos de Uso"
    />
  )
}
