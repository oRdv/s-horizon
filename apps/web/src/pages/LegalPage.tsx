import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'

type LegalPageKind = 'privacy' | 'terms'

interface LegalPageProps {
  kind: LegalPageKind
}

const privacyContent = `Informações Recolhidas e Modo de Utilização

Tipos de Informações Recolhidas:

1. Informações que nos fornece:

• Quando subscreve uma conta Horizon, solicitamos que nos forneça informações pessoais. Podemos combinar essas informações com outras provenientes de serviços da Horizon ou de terceiros para proporcionar uma melhor experiência e melhorar a qualidade dos nossos serviços.

• Para determinados serviços, podemos oferecer a oportunidade de recusar a combinação dessas informações.

2. Informação de Registo:

• Sempre que acede aos serviços da Horizon através de um navegador, aplicação ou outro cliente, os nossos servidores guardam automaticamente certas informações. Estes registros podem incluir informações como:

• Pedido da Web

• Interação com um serviço

• Endereço IP

• Tipo e idioma do navegador

• Data e hora do pedido

• Um ou mais cookies que podem identificar exclusivamente o seu navegador ou a sua conta.

Utilização das Informações:

• Disponibilizar, manter, proteger e melhorar os nossos serviços (incluindo serviços de publicidade) e desenvolver novos serviços.

• Proteger os direitos ou propriedades da Horizon ou dos nossos utilizadores.

• Caso utilizemos essas informações para fins diferentes dos que originaram a sua recolha, solicitaremos o seu consentimento antes de o fazermos.

Partilha de Informações

A Horizon só partilha informações pessoais com outras empresas ou indivíduos externos à Horizon nas seguintes circunstâncias:

1. Consentimento:

• Solicitamos o consentimento ativo para a partilha de qualquer informação pessoal sensível.

2. Cumprimento Legal:

• Acesso, utilização, preservação ou divulgação dessas informações é necessário para:

• Cumprir qualquer lei ou regulamento aplicável.

• Executar os Termos de Utilização aplicáveis.

• Detectar, impedir ou resolver problemas técnicos, de segurança ou fraude.

• Proteger contra danos os direitos, propriedades ou a segurança da Horizon, dos seus utilizadores ou do público.

3. Processos de Fusão ou Aquisição:

• Em caso de fusão ou aquisição, garantimos a confidencialidade das informações pessoais envolvidas e forneceremos um aviso antes de serem transmitidas e ficarem sujeitas a uma política de privacidade diferente.

Segurança das Informações

• Tomamos medidas de segurança adequadas para a proteção contra acesso, alteração, divulgação e/ou destruição de dados não autorizados.

• Revisões internas das nossas medidas de segurança e práticas de recolha, armazenamento e processamento de dados, incluindo encriptação e segurança física.

• Limitação do acesso a informações pessoais a funcionários que necessitem conhecê-las para processar em nosso nome.

Acesso e Atualização de Informações Pessoais

• Proporcionamos acesso às suas informações pessoais e corrigimos dados incorretos ou eliminamos a seu pedido, caso a retenção não seja exigida por lei ou para fins comerciais legítimos.

• Pedimos identificação aos utilizadores que solicitam acesso, correção ou remoção das informações.

• Podemos recusar pedidos que sejam repetitivos, sistemáticos, que prejudiquem a privacidade de terceiros ou que sejam tecnicamente difíceis de concretizar.

Transparência e Direito de Escolha

• Informamos quais informações coletamos, por que as coletamos e como as usamos para aprimorar a sua experiência.

• Princípios de privacidade da Horizon:

1. Usar as informações para fornecer produtos e serviços relevantes.

2. Desenvolver produtos que reflitam sólidos padrões de privacidade.

3. Tornar a coleta de informações pessoais transparente.

4. Oferecer escolhas significativas para proteger a privacidade.

5. Ser um guardião responsável das informações.

Aplicação

• Revemos regularmente a conformidade com esta Política de Privacidade.

• Em caso de reclamações formais, contatamos o utilizador reclamante relativamente às suas questões.

Alterações à Política de Privacidade

• Esta Política de Privacidade pode ser alterada periodicamente.

• Não reduziremos os direitos adquiridos ao abrigo desta Política sem o seu consentimento expresso.

• Qualquer alteração será publicada nesta página e, se significativas, providenciaremos um aviso mais destacado (incluindo notificação por e-mail).`

const termsContent = `1. Generalidades

1.1. Esteja ciente dos termos e condições ao usar nosso site e nosso serviço.

1.2. O uso do nosso website limita-se aos termos e condições nesta página.

1.3. Você é totalmente responsável por estar ciente dos nossos termos e respeitar o uso do nosso site e/ou serviço.

1.4. Se você deseja recusar nossos termos e condições, entre em contato conosco e explique seus motivos.

1.5. HORIZON está hospedado no site https://www.horizonboost.com.br.

2. Privacidade e Confidencialidade

2.1. Todas e quaisquer partes estão proibidas de usar e/ou divulgar dados de quaisquer clientes ou jogadores envolvidos.

2.2. O cliente, estando ciente, aceita todos os riscos e concorda em manter em sigilo quaisquer dados dos profissionais da HORIZON, bem como não estão autorizados a usar ou vincular a empresa HORIZON, respeitando a propriedade intelectual e imagem.

3. Relação com outras Empresas

3.1. HORIZON não reivindica nenhuma afiliação, associados ou endossados por nenhuma dessas empresas, a menos que especificamente declarado.

3.2. A HORIZON não reivindica qualquer propriedade intelectual de nenhuma empresa, associados ou de qualquer afiliado. Todos os direitos autorais e marcas registradas são de propriedade de seus respectivos proprietários.

3.3. O cliente reconhece que HORIZON não tem nenhuma relação com nenhuma associação, afiliado de quaisquer empresa.

3.4. Cada jogo tem sua marca registrada de sua respectiva empresa; desta forma, a HORIZON não tem afiliação com a associação ou endosso de nenhuma parte.

4. Deveres do Cliente

4.1. HORIZON não está associada com nenhuma empresa, associação, filiação ou qualquer outra entidade vinculada a esta.

4.2. A HORIZON adverte a todas as partes interessadas e potenciais interessados para que se abstenham de violar, infringir ou tomar qualquer ação ilegal relativamente a direitos de propriedade intelectual detidos pela empresa responsavel ou por qualquer outra entidade vinculada a esta.

4.3. Ao entrar no nosso site ou em qualquer extensão do nosso site/serviço, incluindo o download e/ou a observação de conteúdo em qualquer plataforma que serve como uma extensão do nosso site ou serviço, você declara sob pena de perjúrio que não está empregado ou afiliado à nenhuma entidade, associação ou empresa e suas respectivas subsidiárias.

4.4. Ao adquirir ou usar nosso serviço ou qualquer serviço incluído na HORIZON, o cliente reconhece que compreende os serviços que está comprando e que é responsável por fornecer com precisão as informações necessárias no jogo para que possamos concluir e processar seu pedido.

5. Pagamentos e Disputas

5.1. Você, o cliente, reconhece que ao comprar um serviço de reforço da nossa empresa, você não é elegível para proteção do comprador no PayPal, Mercado Pago, ou outra forma eletrônica de pagamento e/ou instituição financeira.

5.2. Qualquer disputa deve ser mediada através de nosso sistema de suporte.

5.3. Se você, o cliente, abrir uma disputa com o PayPal ou outra instituição financeira em relação ao nosso serviço, você está em violação dos nossos termos de serviço.

5.4. A empresa reserva-se o direito de prosseguir ações contra os clientes que abrirem disputas ou estornos, incluindo a adição das informações do cliente a uma lista de compradores inválidos e a divulgação das suas informações a terceiros.

5.5. HORIZON reserva-se o direito de prosseguir ações legais contra pessoas que cometerem fraude financeira relacionada com a compra de serviços no nosso site.

6. Responsabilidades do Cliente

6.1. Você, o cliente, aceita a responsabilidade de perder pontos de liga devido a seus logins, mesmo caindo da série de promoção devido às razões mencionadas, e que os boosters têm o direito de mudar suas runas e configurações dentro do jogo.

6.2. Você, cliente, aceita que boosters podem usar Essência Azul para melhor adaptação e prosseguimento dos trabalhos.

6.3. Você, o cliente, aceita que não estará jogando nenhum jogo enquanto o booster não tiver registrado o serviço como terminado. Caso jogue alguns jogos durante o serviço e perca, nós descontaremos no fim do serviço as derrotas e encerraremos o serviço.

6.4. Você, o cliente, aceita que, se jogar quando o serviço já estiver ativo e ter comprado uma divisão ou um aumento de tier, reservamos o direito de parar o serviço e anunciar o boosting como completo, sem reembolsos oferecidos.

6.5. Você, o cliente, aceita que, se seu ganho de PDL estiver abaixo de 15 PDLs por vitória em qualquer divisão diferente da primeira divisão que você comprou, terá que pagar valor extra referente a uma divisão da mesma liga, ou nós converteremos seu pedido em vitórias seguintes.

6.6. Você, o cliente, aceita que, se iniciar um estorno, estará em violação direta dos termos de uso da HORIZON e legalmente obrigado a fechar o estorno ou pagar o mesmo montante, além de uma taxa determinada pela HORIZON.

6.7. Você, o cliente, aceita que, se abrir uma reivindicação após o fim do pedido ou o serviço tiver sido iniciado ou concluído, estará em violação direta dos termos de uso da HORIZON e legalmente obrigado a fechar o pedido ou a pagar de volta o mesmo montante, além de uma taxa determinada pela HORIZON.

6.8. Você, o cliente, aceita que sua conta será enviada para uma agência de cobradores de dívidas, caso proteste um pagamento feito por um serviço que já havia sido concluído, bem como aceita que terá que pagar taxas extras cobrindo a agência de cobranças e quaisquer outros custos imprevistos em relação ao seu estorno.

7. Garantia de Conta Unranked LVL 30

7.1. A garantia da Conta Unranked LVL 30 não cobre mau uso. Caso seja identificado uso de softwares ou se tiver mais de 7 denúncias de jogadores nas últimas 20 partidas, a sua conta não estará coberta pela garantia.

8. Reembolso de Arquivos Digitais

8.1. Você, o cliente, ao adquirir qualquer arquivo digital, como software, ebook ou qualquer outro item eletrônico, só terá direito ao reembolso caso não tenha efetuado o download ou acessado o conteúdo digital disponibilizado na plataforma. Caso o conteúdo já tenha sido usufruído, estará ciente que abrirá mão ao direito de reembolso.

9. Identificação de Conta

9.1. Você, o cliente, aceita que, caso necessário, terá que fazer a identificação da sua conta, validando a sua identidade enviando os seus documentos e validando a veracidade dos dados informados.

10. Reembolso de Contas Revendidas

10.1. Você, o cliente, aceita que ao adquirir uma conta da HORIZON (revenda), caso seja constatado que houve contato externo, será descontada a tarifa da empresa de 20% para reembolsar o valor. Caso opte por pegar outra conta ou serviço, não será descontado o valor da tarifa.

11. Reembolso de Serviços

11.1. Ao comprar um serviço, você é elegível para um reembolso no prazo de 48 horas de sua compra, se o booster não começar a trabalhar em sua conta dentro do tempo de entrega. Você pode solicitar este reembolso diretamente no Suporte ao Cliente.

12. Prazo de Conclusão

12.1. Os pedidos que não foram concluídos dentro da duração da época de concessão são tratados em conformidade com o ponto “13” destes termos.

12.2. No caso do booster iniciar os serviços e não concluir dentro do prazo informado no ato da contratação, será dado um novo prazo de até 3 dias, e, se necessário, serão dadas vitórias adicionais conforme o que foi realizado.

13. Direito de Acompanhamento

13.1. Os clientes têm o direito de acompanhar qualquer jogo durante o processo e questionar o booster sobre quaisquer dúvidas, fazendo isso por meio do canal de chat do cliente.

14. Idioma

14.1. Os clientes têm o direito, ao se candidatar a um serviço de fila Duo ou a um serviço de coaching, de utilizar um idioma específico para comunicar ao aplicar o serviço, levando em consideração os nossos idiomas disponíveis. Em caso de indisponibilidade do idioma, será providenciado um tradutor.

15. Serviços Disponíveis

15.1. Os clientes têm o direito de comprar o Serviço de Elo Boost, Duo Queues, vitórias e Coaching detidos pela HORIZON, consistindo na elevação do montante de elo, o número de duos filas ou o número de horas para o treinador selecionado, isto após o pagamento ser feito.

16. Riscos e Responsabilidades

16.1. O uso de serviços de "Elo Boosting" pode violar os termos de serviço de muitas plataformas de jogos online. Isso pode resultar em ações tomadas contra sua conta. Tomamos todas as precauções necessárias para garantir sua segurança, mas, em última análise, não somos responsáveis por quaisquer medidas punitivas aplicadas à sua conta.

17. Inatividade

17.1. Você, o cliente, aceita que, se após a compra de um serviço você mostrar inatividade por 28 dias ou mais e não mostrar interesse em encerrar o serviço, vamos fechá-lo e considerá-lo como processado.

18. Legislação Aplicável

18.1. Estes termos e condições de uso são regidos e interpretados de acordo com as leis da República Federativa do Brasil, e todas as disputas, litígios e outros assuntos relacionados serão determinados de acordo com essas leis.`

const legalPages: Record<LegalPageKind, { title: string; eyebrow: string; content: string }> = {
  privacy: {
    title: 'Privacidade',
    eyebrow: 'Política de privacidade',
    content: privacyContent,
  },
  terms: {
    title: 'Termos de Uso',
    eyebrow: 'Termos de uso',
    content: termsContent,
  },
}

export function LegalPage({ kind }: LegalPageProps) {
  const page = legalPages[kind]

  useEffect(() => {
    document.title = `${page.title} | Horizon`
  }, [page.title])

  return (
    <div className="legal-page">
      <div className="landing-background" aria-hidden="true">
        <div className="visual-grid" />
      </div>

      <header className="legal-header">
        <BrandMark />
        <Link className="ghost-button" to="/">
          Voltar
        </Link>
      </header>

      <main className="legal-main">
        <span className="panel__eyebrow">{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <div className="legal-copy">{page.content}</div>
      </main>
    </div>
  )
}
