import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'

const whatsappUrl = 'https://wa.me/5512981419074'

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer__content">
        <div className="public-footer__brand">
          <BrandMark label="Horizon" />
          <p>© 2026 Horizon. Todos os direitos reservados.</p>
        </div>

        <a className="public-footer__contact" href={whatsappUrl} rel="noreferrer" target="_blank">
          CONTATO: 12 981419074 (WhatsApp)
        </a>

        <p className="public-footer__disclaimer">
          Os nomes de produtos, logotipos, imagens e marcas registradas mencionadas ou usadas neste site são
          propriedade de seus respectivos proprietários. Nós não somos afiliados, associados ou endossados por
          nenhuma dessas empresas, a menos que especificamente declarado. Todos os direitos autorais, marcas e marcas
          de serviço pertencem aos seus respectivos proprietários.
        </p>

        <nav className="public-footer__links" aria-label="Links legais">
          <Link to="/privacidade">Privacidade</Link>
          <span aria-hidden="true">•</span>
          <Link to="/termos-de-uso">Termos de Uso</Link>
        </nav>
      </div>
    </footer>
  )
}
