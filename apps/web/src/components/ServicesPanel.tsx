import type { UpcomingService } from '@/types/dashboard'

interface ServicesPanelProps {
  services: UpcomingService[]
}

export function ServicesPanel({ services }: ServicesPanelProps) {
  return (
    <div className="services-panel">
      {services.length ? (
        services.map((service) => (
          <article className="service-item" key={service.id}>
            <div className="service-item__meta">
              <span className="service-item__time">{service.scheduleLabel}</span>
              <span className="service-item__queue">{service.queue}</span>
            </div>

            <div className="service-item__body">
              <strong>{service.customer}</strong>
              <p>{service.notes}</p>
            </div>
          </article>
        ))
      ) : (
        <div className="empty-state">Nenhum servico real registrado ainda.</div>
      )}
    </div>
  )
}
