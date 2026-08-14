import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import { getRuntimePriceTable } from '@/data/pricing'

export function AdminPricingPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)

  const [pricing, setPricing] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const adminRows = await systemService.getAdminPricing()

        // Start from the runtime default table (includes apex tiers)
        const base = getRuntimePriceTable()

        // Merge admin overrides (if any) into the base rows by tier
        const merged = base.map((row) => {
          const override = Array.isArray(adminRows) ? adminRows.find((r: any) => r.tier === row.tier) : null
          if (!override) return row

          return {
            ...row,
            solo: override.solo ?? row.solo,
            duo: override.duo ?? row.duo,
            wins: override.wins ?? row.wins,
            md5Package: override.md5Package ?? row.md5Package,
            md5Equivalent: override.md5Equivalent ?? row.md5Equivalent,
            coaching: override.coaching ?? row.coaching,
          }
        })

        if (active) setPricing(merged)
      } catch (err) {
        // ignore for now
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  function updateRange(tierIndex: number, key: string, field: 'min' | 'max', value: number) {
    const next = [...pricing]
    next[tierIndex] = { ...next[tierIndex] }
    next[tierIndex][key] = { ...next[tierIndex][key], [field]: Number(value) }
    setPricing(next)
  }

  async function save() {
    setSaving(true)
    try {
      await systemService.updateAdminPricing(pricing)
      // reload
      const data = await systemService.getAdminPricing()
      setPricing(data ?? [])
      addToast({ tone: 'success', title: 'Preços atualizados', description: 'Os valores foram salvos.' })
    } catch (err: unknown) {
      addToast({ tone: 'error', title: 'Erro', description: 'Não foi possível salvar os preços.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    navigate('/login', { replace: true })
  }

  return (
    <AppShell onLogout={handleLogout} userName={user?.name ?? 'Admin'}>
      <section className="system-hero panel">
        <div>
          <span className="panel__eyebrow">Admin</span>
          <h1>Preços por divisão</h1>
          <p>Edite os valores base para cada fila e modo (solo, duo, wins).</p>
        </div>
      </section>

      <section className="management-panel panel">
        <div className="form-panel-title">
          <div>
            <span className="panel__eyebrow">Tabela</span>
            <h2>Preços por divisão</h2>
          </div>
        </div>

        <div className="panel__content">
          <table className="admin-pricing-table">
            <thead>
              <tr>
                <th>Elo</th>
                <th>Solo (min)</th>
                <th>Solo (max)</th>
                <th>Duo (min)</th>
                <th>Duo (max)</th>
                <th>Wins (min)</th>
                <th>Wins (max)</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((row, i) => (
                <tr key={row.tier}>
                  <td>{row.tier}</td>
                  <td>
                    <input type="number" value={row.solo?.min ?? 0} onChange={(e) => updateRange(i, 'solo', 'min', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" value={row.solo?.max ?? 0} onChange={(e) => updateRange(i, 'solo', 'max', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" value={row.duo?.min ?? 0} onChange={(e) => updateRange(i, 'duo', 'min', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" value={row.duo?.max ?? 0} onChange={(e) => updateRange(i, 'duo', 'max', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" value={row.wins?.min ?? 0} onChange={(e) => updateRange(i, 'wins', 'min', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" value={row.wins?.max ?? 0} onChange={(e) => updateRange(i, 'wins', 'max', Number(e.target.value))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <button className="primary-button" onClick={save} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  )
}
