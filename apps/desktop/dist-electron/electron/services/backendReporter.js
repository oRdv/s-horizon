import axios from 'axios';
import https from 'node:https';
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});
const JSON_HEADERS = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
};
export class BackendReporter {
    onSessionUpdate;
    session = null;
    constructor(onSessionUpdate) {
        this.onSessionUpdate = onSessionUpdate;
    }
    setSession(session) {
        this.session = session;
    }
    getSessionPreview() {
        if (!this.session) {
            return null;
        }
        return {
            apiBaseUrl: this.session.apiBaseUrl,
            user: this.session.user,
        };
    }
    isAuthenticated() {
        return Boolean(this.session?.accessToken);
    }
    async login(payload) {
        const apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl);
        let response;
        try {
            response = await axios.post(`${apiBaseUrl}/auth/login`, {
                email: payload.email,
                password: payload.password,
                two_factor_code: payload.twoFactorCode || undefined,
            }, {
                headers: JSON_HEADERS,
                httpsAgent,
            });
        }
        catch (error) {
            throw toLoginError(error);
        }
        if (response.data.requires_two_factor) {
            const devToken = response.data.data?.security?.dev_token;
            throw new Error(devToken
                ? `Codigo de 2FA enviado. Ambiente local: use ${devToken}.`
                : response.data.message ?? 'Informe o codigo de 2FA enviado para seu email.');
        }
        if (!response.data.access_token || !response.data.data.user) {
            throw new Error('Resposta de login incompleta. Tente entrar novamente.');
        }
        const session = {
            apiBaseUrl,
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            user: response.data.data.user,
        };
        this.session = session;
        await this.onSessionUpdate(session);
        return session;
    }
    async clear() {
        this.session = null;
        await this.onSessionUpdate(null);
    }
    async getOrders() {
        const response = await this.authorizedRequest((token) => axios.get(`${this.requireSession().apiBaseUrl}/orders`, {
            headers: this.headers(token),
            httpsAgent,
        }));
        return response.data.data.orders;
    }
    async sendHeartbeat(payload) {
        await this.authorizedRequest((token) => axios.post(`${this.requireSession().apiBaseUrl}/booster-tracker/heartbeat`, payload, {
            headers: this.headers(token),
            httpsAgent,
        }));
    }
    async sendMatchFinished(payload) {
        await this.authorizedRequest((token) => axios.post(`${this.requireSession().apiBaseUrl}/booster-tracker/match-finished`, payload, {
            headers: this.headers(token),
            httpsAgent,
        }));
    }
    async authorizedRequest(request) {
        const session = this.requireSession();
        try {
            return await request(session.accessToken);
        }
        catch (error) {
            if (!shouldAttemptRefresh(error) || !session.refreshToken) {
                throw toUserError(error);
            }
            const refreshedToken = await this.refreshAccessToken();
            return request(refreshedToken);
        }
    }
    async refreshAccessToken() {
        const session = this.requireSession();
        if (!session.refreshToken) {
            throw new Error('Sessao expirada.');
        }
        const response = await axios.post(`${session.apiBaseUrl}/auth/refresh`, { refresh_token: session.refreshToken }, {
            headers: JSON_HEADERS,
            httpsAgent,
        });
        if (!response.data.access_token || !response.data.data.user) {
            throw new Error('Sessao nao renovada pelo backend.');
        }
        this.session = {
            apiBaseUrl: session.apiBaseUrl,
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            user: response.data.data.user,
        };
        await this.onSessionUpdate(this.session);
        return this.session.accessToken;
    }
    requireSession() {
        if (!this.session) {
            throw new Error('Faca login no app desktop.');
        }
        return this.session;
    }
    headers(token) {
        return {
            ...JSON_HEADERS,
            Authorization: `Bearer ${token}`,
        };
    }
}
function normalizeApiBaseUrl(value) {
    const trimmed = value.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}
function shouldAttemptRefresh(error) {
    return axios.isAxiosError(error) && error.response?.status === 401;
}
function toUserError(error) {
    if (axios.isAxiosError(error)) {
        if (!error.response) {
            return new Error('Erro de conexao com o servidor.');
        }
        const message = safeApiMessage(error.response.data?.message, 'Nao foi possivel completar a acao.');
        return new Error(message);
    }
    return error instanceof Error ? error : new Error('Falha de comunicacao com o backend.');
}
function toLoginError(error) {
    if (!axios.isAxiosError(error)) {
        return error instanceof Error ? error : new Error('Erro de conexao com o servidor.');
    }
    if (!error.response) {
        return new Error('Erro de conexao com o servidor.');
    }
    const status = error.response.status;
    const apiMessage = safeApiMessage(error.response.data?.message, '');
    const normalizedMessage = normalizeText(apiMessage);
    const responseErrors = error.response.data?.errors;
    const hasTwoFactorError = normalizedMessage.includes('2fa') ||
        normalizedMessage.includes('codigo') ||
        normalizedMessage.includes('two factor') ||
        normalizedMessage.includes('two_factor') ||
        hasFieldError(responseErrors, 'two_factor_code');
    if (hasTwoFactorError) {
        return new Error('Codigo 2FA invalido.');
    }
    if (status === 401 || status === 403) {
        return new Error('Credenciais invalidas.');
    }
    if (status === 422) {
        return new Error('Credenciais invalidas.');
    }
    if (status >= 500) {
        return new Error('Erro de conexao com o servidor.');
    }
    return new Error(apiMessage || 'Nao foi possivel entrar agora. Tente novamente.');
}
function safeApiMessage(value, fallback) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}
function hasFieldError(value, field) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    return Object.prototype.hasOwnProperty.call(value, field);
}
function normalizeText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
//# sourceMappingURL=backendReporter.js.map