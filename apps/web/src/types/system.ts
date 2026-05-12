import type { AuthUser, BoosterProfile, UserRole } from '@/types/auth'

export interface DashboardResponse<T = Record<string, unknown>> {
  data: T
}

export interface Paginated<T> {
  data: T[]
  current_page: number
  last_page: number
  total: number
}

export interface ServiceOrder {
  id: number
  service_type: string
  title: string
  description?: string | null
  status: string
  price: string
  base_price?: number | null
  final_price?: number | null
  payment_method?: PaymentMethod | null
  payment_status?: string | null
  currency: string
  metadata?: Record<string, unknown> | null
  customer?: AuthUser | null
  booster?: AuthUser | null
  created_at?: string
  updated_at?: string
  completed_at?: string | null
  chat_available?: boolean
  conversation_id?: number | null
  latest_payment?: PaymentTransaction | null
  payments?: PaymentTransaction[]
  has_game_account?: boolean
}

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
export type PaymentProvider = 'STRIPE' | 'MERCADO_PAGO'

export interface PaymentTransaction {
  id: number
  orderId?: number
  boostId?: number
  provider: PaymentProvider | 'stripe' | 'mercado_pago' | 'manual'
  method: PaymentMethod | 'pix' | 'card'
  direction?: string
  amount: number | string
  baseAmount?: number
  feeAmount?: number
  discountAmount?: number
  finalAmount?: number
  currency: string
  status: string
  providerPaymentId?: string | null
  providerPreferenceId?: string | null
  providerSessionId?: string | null
  paymentIntentId?: string | null
  qrCode?: string | null
  qrCodeBase64?: string | null
  pixCopyPaste?: string | null
  expiresAt?: string | null
  provider_reference?: string | null
  created_at?: string | null
  createdAt?: string | null
  service_order?: ServiceOrder | null
}

export interface PaymentInstallment {
  quantity: number
  amount: number
  total: number
}

export interface PaymentMethodOption {
  method: PaymentMethod
  provider: PaymentProvider
  label: string
  description: string
  finalAmount: number
  installments: PaymentInstallment[]
  available: boolean
  unavailableReason?: string | null
}

export interface PaymentMethodsResponse {
  basePrice: number
  currency: string
  methods: PaymentMethodOption[]
}

export interface PaymentGatewayData {
  type: 'pix' | 'card'
  amount?: string
  currency?: string
  expires_at?: string | null
  pix_copy_paste?: string | null
  qr_code_payload?: string | null
  merchant_name?: string | null
}

export interface PaymentGatewayPayload {
  paymentId?: number
  method?: PaymentMethod
  provider?: PaymentProvider
  clientSecret?: string | null
  publishableKey?: string | null
  qrCode?: string | null
  qrCodeBase64?: string | null
  pixCopyPaste?: string | null
  expiresAt?: string | null
  status?: string
  provider_reference?: string | null
  message?: string | null
  payment_data?: PaymentGatewayData | null
}

export interface OrderChatMessage {
  id: number
  order_conversation_id: number
  conversationId?: number
  sender_id: number
  senderId?: number
  sender_type?: 'CLIENT' | 'BOOSTER' | 'ADMIN'
  senderType?: 'CLIENT' | 'BOOSTER' | 'ADMIN'
  body: string
  message?: string
  is_read?: boolean
  isRead?: boolean
  read_at?: string | null
  readAt?: string | null
  created_at: string
  createdAt?: string
  sender?: AuthUser | null
}

export interface OrderConversation {
  id: number
  orderId: number
  service_order_id?: number
  clientId: number
  customer_id?: number
  boosterId?: number | null
  booster_id?: number | null
  status: 'ACTIVE' | 'CLOSED' | 'BLOCKED'
  lastMessage?: string | null
  lastMessageAt?: string | null
  pinnedMessageId?: number | null
  pinned_message_id?: number | null
  pinnedMessage?: OrderChatMessage | null
  pinned_message?: OrderChatMessage | null
  opened_at?: string | null
  createdAt?: string | null
  created_at?: string | null
  updatedAt?: string | null
  updated_at?: string | null
  customer?: AuthUser | null
  booster?: AuthUser | null
  order?: ServiceOrder | null
}

export interface OrderChatResponse {
  available: boolean
  message?: string
  conversation?: OrderConversation
  messages: OrderChatMessage[]
}

export interface WithdrawalRequest {
  id: number
  amount: string
  method: 'pix' | 'card'
  pix_key?: string | null
  status: string
  notes?: string | null
  rejection_reason?: string | null
  metadata?: Record<string, unknown> | null
  requested_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  booster?: AuthUser | null
  reviewer?: AuthUser | null
}

export interface BoosterApplication extends BoosterProfile {
  id: number
  user_id: number
  reviewed_by?: number | null
  status: 'pending' | 'approved' | 'rejected'
  review_notes?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  user?: AuthUser | null
}

export interface LandingBooster {
  id: number
  user_id?: number | null
  nick: string
  champion_name: string
  rank_label: string
  rank_key: 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond' | 'master' | 'grandmaster' | 'challenger'
  game: string
  sort_order: number
  is_active: boolean
  user?: AuthUser | null
}

export interface MasterDashboard {
  summary: Record<string, number>
  global_goals: Record<string, number>
  users_by_role: Partial<Record<UserRole, number>>
  latest_users: AuthUser[]
  pending_withdrawal_requests: WithdrawalRequest[]
  landing_boosters: LandingBooster[]
  booster_users: AuthUser[]
}

export interface StaffDashboard {
  profile: {
    staff_profile?: string | null
    permissions: string[]
  }
  operation: {
    active_orders: number
    active_boosters: number
    recent_orders: ServiceOrder[]
  }
  finance: {
    pending_withdrawals: number
    pending_transactions: number
    month_revenue: number
  }
}

export interface BoosterDashboard {
  available_orders: ServiceOrder[]
  assigned_orders: ServiceOrder[]
  progress: {
    completed_orders: number
    active_orders: number
  }
  earnings: {
    available: number
    pending_withdrawals: number
  }
  goals: Record<string, number>
}

export interface CustomerDashboard {
  orders: ServiceOrder[]
  payments: PaymentTransaction[]
  history: {
    total_orders: number
    completed_orders: number
  }
}

export interface UsersResponse {
  users: Paginated<AuthUser>
  roles: Array<{ value: UserRole; label: string }>
  staff_profiles: Array<{ value: string; label: string }>
}
