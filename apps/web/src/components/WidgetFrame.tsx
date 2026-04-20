import type { ReactNode } from 'react'

interface WidgetFrameProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function WidgetFrame({ title, subtitle, children }: WidgetFrameProps) {
  return (
    <section className="panel widget-frame">
      <header className="widget-frame__header">
        <div>
          <span className="panel__eyebrow">{title}</span>
          <p>{subtitle}</p>
        </div>
      </header>

      {children}
    </section>
  )
}
