import { apiClient } from '@/services/api/client'
import type { AuthUser, BoosterProfile, UserRole } from '@/types/auth'
import type {
  BoosterDashboard,
  BoosterApplication,
  BoosterTrackerSession,
  BoosterTrackerStatusResponse,
  CustomerDashboard,
  DashboardResponse,
  MasterDashboard,
  LandingBooster,
  PaymentTransaction,
  PaymentGatewayPayload,
  PaymentMethod,
  PaymentMethodsResponse,
  OrderConversation,
  OrderChatResponse,
  OrderChatMessage,
  ServiceOrder,
  StaffDashboard,
  TrackerDownloadMetadata,
  TrackerRelease,
  UsersResponse,
  WithdrawalRequest,
} from '@/types/system'

const dashboardEndpointByRole: Record<UserRole, string> = {
  master_admin: '/dashboards/master',
  staff: '/dashboards/staff',
  booster: '/dashboards/booster',
  customer: '/dashboards/customer',
}

export type RoleDashboard = MasterDashboard | StaffDashboard | BoosterDashboard | CustomerDashboard

export type LandingBoosterPayload = Omit<LandingBooster, 'id' | 'user'>

export const systemService = {
  async getDashboard(role: UserRole): Promise<RoleDashboard> {
    const response = await apiClient.get<DashboardResponse<RoleDashboard>>(dashboardEndpointByRole[role])

    return response.data.data
  },

  async getPublicLandingBoosters(): Promise<LandingBooster[]> {
    const response = await apiClient.get<DashboardResponse<{ boosters: LandingBooster[] }>>('/landing/boosters')

    return response.data.data.boosters
  },

  async getAdminLandingBoosters(): Promise<{ boosters: LandingBooster[]; booster_users: AuthUser[] }> {
    const response = await apiClient.get<DashboardResponse<{ boosters: LandingBooster[]; booster_users: AuthUser[] }>>(
      '/admin/landing-boosters',
    )

    return response.data.data
  },

  async createLandingBooster(payload: LandingBoosterPayload): Promise<LandingBooster> {
    const response = await apiClient.post<DashboardResponse<{ booster: LandingBooster }>>('/admin/landing-boosters', payload)

    return response.data.data.booster
  },

  async updateLandingBooster(id: number, payload: LandingBoosterPayload): Promise<LandingBooster> {
    const response = await apiClient.patch<DashboardResponse<{ booster: LandingBooster }>>(
      `/admin/landing-boosters/${id}`,
      payload,
    )

    return response.data.data.booster
  },

  async deleteLandingBooster(id: number): Promise<void> {
    await apiClient.delete(`/admin/landing-boosters/${id}`)
  },

  async getUsers(role?: string): Promise<UsersResponse> {
    const response = await apiClient.get<DashboardResponse<UsersResponse>>('/admin/users', {
      params: role ? { role } : undefined,
    })

    return response.data.data
  },

  async createUser(payload: {
    name: string
    email: string
    password: string
    role: UserRole
    staff_profile?: string | null
    booster_profile?: BoosterProfile | null
  }): Promise<AuthUser> {
    const response = await apiClient.post<DashboardResponse<{ user: AuthUser }>>('/admin/users', payload)

    return response.data.data.user
  },

  async updateUser(
    userId: number,
    payload: {
      name?: string
      email?: string
      password?: string
      role?: UserRole
      staff_profile?: string | null
      booster_profile?: BoosterProfile | null
    },
  ): Promise<AuthUser> {
    const response = await apiClient.patch<DashboardResponse<{ user: AuthUser }>>(`/admin/users/${userId}`, payload)

    return response.data.data.user
  },

  async deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`)
  },

  async setUserActive(userId: number, active: boolean): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/${active ? 'activate' : 'deactivate'}`)
  },

  async getMyBoosterApplication(): Promise<BoosterApplication | null> {
    const response = await apiClient.get<DashboardResponse<{ application: BoosterApplication | null }>>(
      '/booster-applications/me',
    )

    return response.data.data.application
  },

  async submitBoosterApplication(payload: BoosterProfile): Promise<BoosterApplication> {
    const response = await apiClient.post<DashboardResponse<{ application: BoosterApplication }>>(
      '/booster-applications',
      payload,
    )

    return response.data.data.application
  },

  async submitPublicBoosterApplication(
    payload: BoosterProfile & {
      name: string
      email: string
      password: string
      password_confirmation: string
    },
  ): Promise<{ application: BoosterApplication; user: AuthUser }> {
    const response = await apiClient.post<DashboardResponse<{ application: BoosterApplication; user: AuthUser }>>(
      '/booster-applications/public',
      payload,
    )

    return response.data.data
  },

  async getBoosterApplications(status = 'pending'): Promise<BoosterApplication[]> {
    const response = await apiClient.get<DashboardResponse<{ applications: { data: BoosterApplication[] } }>>(
      '/admin/booster-applications',
      { params: { status } },
    )

    return response.data.data.applications.data
  },

  async reviewBoosterApplication(
    id: number,
    action: 'approve' | 'reject',
    reviewNotes?: string,
  ): Promise<BoosterApplication> {
    const response = await apiClient.patch<DashboardResponse<{ application: BoosterApplication }>>(
      `/admin/booster-applications/${id}/${action}`,
      { review_notes: reviewNotes },
    )

    return response.data.data.application
  },

  async getPayments(): Promise<PaymentTransaction[]> {
    const response = await apiClient.get<DashboardResponse<{ transactions: { data: PaymentTransaction[] } }>>('/payments')

    return response.data.data.transactions.data
  },

  async createCustomerPayment(payload: {
    service_type: string
    title: string
    description?: string
    amount: number
    metadata?: Record<string, unknown>
  }): Promise<{ order: ServiceOrder }> {
    const response = await apiClient.post<DashboardResponse<{ order: ServiceOrder }>>('/payments/customer', payload)

    return response.data.data
  },

  async getPaymentMethods(boostId: number): Promise<PaymentMethodsResponse> {
    const response = await apiClient.get<DashboardResponse<PaymentMethodsResponse>>(`/payments/methods/${boostId}`)

    return response.data.data
  },

  async createPayment(payload: {
    boostId: number
    orderId: number
    method: PaymentMethod
    installments?: number
  }): Promise<PaymentGatewayPayload & { payment: PaymentTransaction }> {
    const response = await apiClient.post<DashboardResponse<PaymentGatewayPayload & { payment: PaymentTransaction }>>(
      '/payments/create',
      payload,
    )

    return response.data.data
  },

  async getPaymentStatus(paymentId: number): Promise<PaymentTransaction> {
    const response = await apiClient.get<DashboardResponse<PaymentTransaction>>(`/payments/${paymentId}/status`)

    return response.data.data
  },

  async getOrders(): Promise<ServiceOrder[]> {
    const response = await apiClient.get<DashboardResponse<{ orders: ServiceOrder[] }>>('/orders')

    return response.data.data.orders
  },

  async getOrder(orderId: number): Promise<ServiceOrder> {
    const response = await apiClient.get<DashboardResponse<{ order: ServiceOrder }>>(`/orders/${orderId}`)

    return response.data.data.order
  },

  async getOrderTrackerStatus(orderId: number): Promise<BoosterTrackerStatusResponse> {
    const response = await apiClient.get<DashboardResponse<BoosterTrackerStatusResponse>>(
      `/booster-tracker/orders/${orderId}/status`,
    )

    return response.data.data
  },

  async getTrackerRelease(platform?: string): Promise<TrackerRelease> {
    const response = await apiClient.get<DashboardResponse<TrackerRelease>>('/booster-tracker/release', {
      params: platform ? { platform } : undefined,
    })

    return response.data.data
  },

  async recordTrackerEvent(type: string, metadata?: Record<string, unknown>, platform?: string): Promise<void> {
    await apiClient.post('/booster-tracker/events', {
      type,
      platform,
      metadata,
    })
  },

  async downloadTracker(download: TrackerDownloadMetadata): Promise<{ filename: string; size: number }> {
    if (!download.url) {
      throw new Error('Link de download indisponivel. Atualize o guia e tente novamente.')
    }

    const link = document.createElement('a')
    link.href = download.url
    link.download = download.filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()

    return {
      filename: download.filename,
      size: download.size_bytes ?? 0,
    }
  },

  async getLiveBoosters(): Promise<BoosterTrackerSession[]> {
    const response = await apiClient.get<DashboardResponse<{ boosters: BoosterTrackerSession[] }>>(
      '/admin/boosters/live',
    )

    return response.data.data.boosters
  },

  async saveOrderGameAccount(orderId: number, payload: { email: string; password: string }): Promise<ServiceOrder> {
    const response = await apiClient.post<DashboardResponse<{ order: ServiceOrder }>>(
      `/orders/${orderId}/game-account`,
      payload,
    )

    return response.data.data.order
  },

  async getOrderChat(orderId: number): Promise<OrderChatResponse> {
    const response = await apiClient.get<DashboardResponse<OrderChatResponse>>(`/orders/${orderId}/chat`)

    return response.data.data
  },

  async getOrderConversation(orderId: number): Promise<OrderChatResponse> {
    const response = await apiClient.get<DashboardResponse<OrderChatResponse>>(`/orders/${orderId}/conversation`)

    return response.data.data
  },

  async getConversationMessages(conversationId: number): Promise<OrderChatMessage[]> {
    const response = await apiClient.get<DashboardResponse<{ messages: { data: OrderChatMessage[] } }>>(
      `/conversations/${conversationId}/messages`,
      { params: { per_page: 200 } },
    )

    return response.data.data.messages.data
  },

  async sendOrderChatMessage(orderId: number, body: string): Promise<OrderChatMessage> {
    const response = await apiClient.post<DashboardResponse<{ message: OrderChatMessage }>>(
      `/orders/${orderId}/chat/messages`,
      { body },
    )

    return response.data.data.message
  },

  async sendConversationMessage(conversationId: number, message: string): Promise<OrderChatMessage> {
    const response = await apiClient.post<DashboardResponse<{ message: OrderChatMessage }>>(
      `/conversations/${conversationId}/messages`,
      { message },
    )

    return response.data.data.message
  },

  async markConversationRead(conversationId: number): Promise<void> {
    await apiClient.patch(`/conversations/${conversationId}/read`)
  },

  async pinConversationMessage(conversationId: number, messageId: number | null): Promise<OrderConversation> {
    const response = await apiClient.patch<DashboardResponse<{ conversation: OrderConversation }>>(
      `/conversations/${conversationId}/pin`,
      { message_id: messageId },
    )

    return response.data.data.conversation
  },

  async claimBoosterOrder(orderId: number): Promise<ServiceOrder> {
    const response = await apiClient.post<DashboardResponse<{ order: ServiceOrder }>>(`/orders/${orderId}/claim`)

    return response.data.data.order
  },

  async completeBoosterOrder(orderId: number): Promise<ServiceOrder> {
    const response = await apiClient.post<DashboardResponse<{ order: ServiceOrder }>>(`/orders/${orderId}/complete`)

    return response.data.data.order
  },

  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    const response = await apiClient.get<DashboardResponse<{ withdrawals: { data: WithdrawalRequest[] } }>>(
      '/withdrawals',
    )

    return response.data.data.withdrawals.data
  },

  async requestWithdrawal(payload: {
    amount?: number
    service_order_id?: number
    method: 'pix' | 'card'
    pix_key?: string
    bonus_amount?: number
    notes?: string
    metadata?: Record<string, unknown>
  }): Promise<WithdrawalRequest> {
    const response = await apiClient.post<DashboardResponse<{ withdrawal: WithdrawalRequest }>>('/withdrawals', payload)

    return response.data.data.withdrawal
  },

  async reviewWithdrawal(id: number, status: 'approved' | 'rejected' | 'paid'): Promise<WithdrawalRequest> {
    const response = await apiClient.patch<DashboardResponse<{ withdrawal: WithdrawalRequest }>>(
      `/withdrawals/${id}/review`,
      { status },
    )

    return response.data.data.withdrawal
  },

  async requestProfileChange(payload: {
    name?: string
    profile_photo_path?: string
    booster_profile?: Pick<BoosterProfile, 'discord_username' | 'discord_user_id'>
    password?: string
    password_confirmation?: string
  }): Promise<{ purpose: string; security: { token_sent: boolean; dev_token?: string } }> {
    const response = await apiClient.post<
      DashboardResponse<{ purpose: string; security: { token_sent: boolean; dev_token?: string } }>
    >('/profile/change-requests', payload)

    return response.data.data
  },

  async confirmProfileChange(payload: { purpose: string; token: string }): Promise<AuthUser> {
    const response = await apiClient.post<DashboardResponse<{ user: AuthUser }>>(
      '/profile/change-requests/confirm',
      payload,
    )

    return response.data.data.user
  },

  async requestEmailVerification(): Promise<{ security: { token_sent: boolean; dev_token?: string } }> {
    const response = await apiClient.post<DashboardResponse<{ security: { token_sent: boolean; dev_token?: string } }>>(
      '/security/email-verification/request',
    )

    return response.data.data
  },

  async confirmEmailVerification(token: string): Promise<AuthUser> {
    const response = await apiClient.post<DashboardResponse<{ user: AuthUser }>>(
      '/security/email-verification/confirm',
      { token },
    )

    return response.data.data.user
  },

  async requestTwoFactor(): Promise<{ security: { token_sent: boolean; dev_token?: string } }> {
    const response = await apiClient.post<DashboardResponse<{ security: { token_sent: boolean; dev_token?: string } }>>(
      '/security/two-factor/request',
    )

    return response.data.data
  },

  async confirmTwoFactor(token: string): Promise<AuthUser> {
    const response = await apiClient.post<DashboardResponse<{ user: AuthUser }>>('/security/two-factor/confirm', {
      token,
    })

    return response.data.data.user
  },
}
