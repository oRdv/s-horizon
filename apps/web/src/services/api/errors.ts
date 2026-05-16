import axios from 'axios'

interface ValidationResponse {
  message?: string
  errors?: Record<string, string[]>
}

const friendlyFieldLabels: Record<string, string> = {
  name: 'nome',
  email: 'e-mail',
  password: 'senha',
  password_confirmation: 'confirmacao de senha',
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessages(error, fallback)[0] ?? fallback
}

export function getApiErrorMessages(error: unknown, fallback: string): string[] {
  if (!axios.isAxiosError(error)) {
    return [fallback]
  }

  const data = error.response?.data as ValidationResponse | undefined

  if (data?.errors) {
    const messages = Object.entries(data.errors)
      .flatMap(([field, values]) => values.map((value) => translateValidationMessage(field, value)))
      .filter((message) => message.length > 0)

    if (messages.length > 0) {
      return messages
    }
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return [translateGenericMessage(data.message)]
  }

  if (error.response?.status === 422) {
    return ['Revise os dados do formulario e tente novamente.']
  }

  if (error.response?.status === 401) {
    return ['E-mail ou senha invalidos. Confira os dados e tente novamente.']
  }

  if (error.response?.status === 503) {
    return ['Servico temporariamente indisponivel. Tente novamente em instantes ou fale com o suporte.']
  }

  if (typeof error.response?.status === 'number' && error.response.status >= 500) {
    return ['O servidor encontrou um erro. Tente novamente em instantes ou fale com o suporte.']
  }

  if (!error.response) {
    return ['Nao foi possivel conectar ao servidor. Verifique se a API esta rodando.']
  }

  return [fallback]
}

function translateValidationMessage(field: string, message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('already been taken') ||
    normalized.includes('ja esta cadastrado') ||
    normalized.includes('já está cadastrado')
  ) {
    return 'Este e-mail ja esta cadastrado. Tente entrar ou use outro e-mail.'
  }

  if (normalized.includes('at least 8') || normalized.includes('pelo menos 8')) {
    return 'A senha precisa ter pelo menos 8 caracteres.'
  }

  if (normalized.includes('confirmation') || normalized.includes('confirmacao') || normalized.includes('confirmação')) {
    return 'A confirmacao da senha nao confere.'
  }

  if (normalized.includes('valid email') || normalized.includes('email valido')) {
    return 'Digite um e-mail valido.'
  }

  if (
    normalized.includes('required') ||
    normalized.includes('obrigatorio') ||
    normalized.includes('obrigatório') ||
    normalized.includes('informe')
  ) {
    const label = friendlyFieldLabels[field] ?? field

    return `Informe o campo ${label}.`
  }

  return translateGenericMessage(message)
}

function translateGenericMessage(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('smtp') ||
    normalized.includes('mailer') ||
    normalized.includes('badcredentials') ||
    normalized.includes('username and password not accepted')
  ) {
    return 'Nao conseguimos enviar o e-mail agora. Verifique a configuracao SMTP da Horizon Boost.'
  }

  if (
    normalized.includes('banco de dados') ||
    normalized.includes('db_host') ||
    normalized.includes('db_database') ||
    normalized.includes('db_username') ||
    normalized.includes('db_password') ||
    normalized.includes('database')
  ) {
    return 'Nao foi possivel conectar ao banco de dados da Horizon Boost. Verifique a configuracao do servidor.'
  }

  if (normalized.includes('the given data was invalid')) {
    return 'Revise os dados do formulario e tente novamente.'
  }

  if (normalized.includes('credentials') || normalized.includes('credenciais')) {
    return 'E-mail ou senha invalidos. Confira os dados e tente novamente.'
  }

  return message
}
