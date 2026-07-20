import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BrandMark } from '@/components/BrandMark'
import { PublicFooter } from '@/components/PublicFooter'

export interface LegalSection {
  title: string
  paragraphs?: string[]
  items?: string[]
}

interface LegalDocumentPageProps {
  eyebrow: string
  intro: string
  sections: LegalSection[]
  title: string
}

export function LegalDocumentPage({ eyebrow, intro, sections, title }: LegalDocumentPageProps) {
  return (
    <div className="legal-page">
      <div className="landing-background" aria-hidden="true">
        <div className="visual-grid" />
      </div>

      <header className="landing-header legal-header">
        <div className="landing-header__brand">
          <BrandMark label="Horizon" />
        </div>
        <Link className="legal-back-link" to="/">
          <ChevronLeft size={18} />
          Voltar ao início
        </Link>
      </header>

      <main className="legal-main">
        <section className="legal-hero">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Última atualização: 20 de julho de 2026.</small>
        </section>

        <article className="legal-document">
          {sections.map((section) => (
            <section className="legal-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items ? (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </main>

      <PublicFooter />
    </div>
  )
}
