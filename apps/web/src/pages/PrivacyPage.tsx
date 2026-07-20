import { LegalDocumentPage, type LegalSection } from '@/components/LegalDocumentPage'

const privacySections: LegalSection[] = [
  {
    title: '1. Informações recolhidas e modo de utilização',
    paragraphs: [
      'Quando você cria uma conta na Horizon, podemos solicitar informações pessoais necessárias para prestar nossos serviços. Essas informações podem ser combinadas com dados provenientes de outros serviços da Horizon ou de terceiros para melhorar a experiência e a qualidade dos nossos serviços.',
      'Para determinados serviços, podemos oferecer a possibilidade de recusar a combinação dessas informações.',
    ],
  },
  {
    title: '2. Informações de registro',
    paragraphs: [
      'Sempre que você acessa os serviços da Horizon por um navegador, aplicativo ou outro cliente, nossos servidores podem registrar automaticamente determinadas informações.',
    ],
    items: [
      'Solicitações feitas pela web.',
      'Interações com nossos serviços.',
      'Endereço IP.',
      'Tipo e idioma do navegador.',
      'Data e hora da solicitação.',
      'Cookies que possam identificar exclusivamente seu navegador ou sua conta.',
    ],
  },
  {
    title: '3. Utilização das informações',
    items: [
      'Disponibilizar, manter, proteger e melhorar nossos serviços, incluindo serviços de publicidade, e desenvolver novos serviços.',
      'Proteger os direitos e as propriedades da Horizon e de nossos usuários.',
      'Solicitar seu consentimento antes de utilizar as informações para finalidades diferentes daquelas que motivaram sua coleta.',
    ],
  },
  {
    title: '4. Compartilhamento de informações',
    paragraphs: [
      'A Horizon somente compartilha informações pessoais com empresas ou pessoas externas nas circunstâncias descritas abaixo.',
    ],
    items: [
      'Com seu consentimento ativo, especialmente no caso de informações pessoais sensíveis.',
      'Quando o acesso, uso, preservação ou divulgação for necessário para cumprir leis ou regulamentos aplicáveis.',
      'Para executar os Termos de Uso aplicáveis, detectar ou impedir fraudes e resolver problemas técnicos ou de segurança.',
      'Para proteger contra danos os direitos, as propriedades ou a segurança da Horizon, de seus usuários ou do público.',
      'Em processos de fusão ou aquisição, mantendo a confidencialidade e informando antes que os dados sejam submetidos a outra política de privacidade.',
    ],
  },
  {
    title: '5. Segurança das informações',
    items: [
      'Adotamos medidas adequadas contra acesso, alteração, divulgação ou destruição não autorizada de dados.',
      'Revisamos internamente nossas práticas de coleta, armazenamento e processamento, incluindo criptografia e segurança física quando aplicáveis.',
      'Limitamos o acesso às informações pessoais aos colaboradores que precisam delas para processar atividades em nosso nome.',
    ],
  },
  {
    title: '6. Acesso e atualização de informações pessoais',
    items: [
      'Você pode solicitar acesso, correção ou exclusão de seus dados, desde que a retenção não seja exigida por lei ou por finalidade comercial legítima.',
      'Podemos solicitar identificação para confirmar a legitimidade do pedido.',
      'Pedidos repetitivos, sistemáticos, que prejudiquem a privacidade de terceiros ou sejam tecnicamente inviáveis poderão ser recusados mediante justificativa.',
    ],
  },
  {
    title: '7. Transparência e direito de escolha',
    paragraphs: [
      'Informamos quais dados coletamos, por que os coletamos e como são utilizados para aprimorar sua experiência.',
    ],
    items: [
      'Usar as informações para fornecer produtos e serviços relevantes.',
      'Desenvolver produtos que respeitem padrões sólidos de privacidade.',
      'Manter transparente a coleta de informações pessoais.',
      'Oferecer escolhas significativas para a proteção da privacidade.',
      'Agir como responsável pela proteção das informações sob nosso controle.',
    ],
  },
  {
    title: '8. Aplicação desta política',
    paragraphs: [
      'Revisamos regularmente a conformidade com esta Política de Privacidade. Em caso de reclamação formal, entraremos em contato com o usuário para tratar das questões apresentadas.',
    ],
  },
  {
    title: '9. Alterações à Política de Privacidade',
    paragraphs: [
      'Esta Política de Privacidade pode ser alterada periodicamente. Não reduziremos direitos já adquiridos sem consentimento expresso. Toda alteração será publicada nesta página e, quando significativa, poderá ser comunicada por um aviso de maior destaque, inclusive por e-mail.',
    ],
  },
]

export function PrivacyPage() {
  return (
    <LegalDocumentPage
      eyebrow="Privacidade"
      intro="Esta política explica quais informações a Horizon pode coletar, como elas são utilizadas e quais escolhas estão disponíveis para você."
      sections={privacySections}
      title="Política de Privacidade"
    />
  )
}
