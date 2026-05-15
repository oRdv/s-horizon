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
        const response = await axios.post(`${apiBaseUrl}/auth/login`, {
            email: payload.email,
            password: payload.password,
        }, {
            headers: JSON_HEADERS,
            httpsAgent,
        });
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
        const message = typeof error.response?.data?.message === 'string'
            ? error.response.data.message
            : error.message;
        return new Error(message);
    }
    return error instanceof Error ? error : new Error('Falha de comunicacao com o backend.');
}
//# sourceMappingURL=backendReporter.js.map