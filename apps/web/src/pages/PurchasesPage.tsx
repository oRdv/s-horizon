import { AppShell } from '@/components/AppShell'
import { PricingBuilder } from '@/components/PricingBuilder'
import { authService } from '@/services/auth'
import { useSessionStore } from '@/store/useSessionStore'

export function PurchasesPage() {
  const user = useSessionStore((state) => state.user)
  const isBooster = user?.role === 'booster'

  async function handleLogout() {
    await authService.logout()
  }

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="purchases-page">
        <section className="purchase-section" id="novo-pedido">
          <PricingBuilder
            canCheckout={!isBooster}
            description="Escolha o formato, ajuste o elo atual e o destino final. O valor aparece no resumo antes de fechar."
            eyebrow={isBooster ? 'Consulta de preços' : 'Novo pedido'}
            showReferenceTable={isBooster}
            title={isBooster ? 'Tabela de preços para consulta' : 'Escolha o serviço e monte sua rota'}
          />
        </section>
      </div>
    </AppShell>
  )
}
