import * as msal from "@azure/msal-browser";

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron;

const getMsalConfig = (clientId: string, authority: string): msal.Configuration => {
    // Sanitize authority: allow full URL or short name/tenant id
    const trimmed = (authority || 'common').trim();
    const isFullUrl = /^https?:\/\//i.test(trimmed);
    const authorityUrl = isFullUrl ? trimmed : `https://login.microsoftonline.com/${trimmed}`;

    // Use the current directory as redirect URI so it works under subpaths (e.g., GitHub Pages /<repo>/)
    // Example results:
    //  - http://localhost:3000/
    //  - https://user.github.io/repo/
    const redirectBase = new URL('.', window.location.href);
    const redirectUri = `${window.location.origin}${redirectBase.pathname}`;

    // Helpful debug log in dev
    if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.debug('[MSAL] Initializing', { authority: authorityUrl, redirectUri });
    }

    return {
        auth: {
            clientId: clientId,
            authority: authorityUrl,
            redirectUri,
        },
        cache: {
            cacheLocation: "localStorage",
            storeAuthStateInCookie: false,
        }
    };
};

const loginRequest = {
    scopes: ["User.Read", "Files.ReadWrite.All"]
};

export class OneDriveService {
    private msalInstance: msal.PublicClientApplication | null = null;
    private account: msal.AccountInfo | null = null;
    private initPromise: Promise<void> | null = null;
    private isInitialized: boolean = false;

    constructor(clientId?: string) {
        // Don't auto-initialize in constructor
        // Caller must explicitly call initialize()
    }

    public async initialize(clientId: string, authority: string = 'common'): Promise<void> {
        if (this.isInitialized) {
            return; // Already initialized
        }
        
        if (!clientId) {
            console.error("MSAL Client ID is required for initialization.");
            return;
        }
        
    const config = getMsalConfig(clientId, authority);
        this.msalInstance = new msal.PublicClientApplication(config);
        
        // IMPORTANT: Must await initialize() before using any MSAL methods
        await this.msalInstance.initialize();
        
        // Now we can safely call handleRedirectPromise
        await this.msalInstance.handleRedirectPromise().catch(console.error);
        
        const currentAccounts = this.msalInstance.getAllAccounts();
        if (currentAccounts.length > 0) {
            this.account = currentAccounts[0];
        }
        
        this.isInitialized = true;
    }
    
    public async login(): Promise<msal.AccountInfo | null> {
        if (!this.isInitialized || !this.msalInstance) {
            throw new Error("OneDriveService not initialized. Call initialize() first.");
        }
        try {
            const response = await this.msalInstance.loginPopup(loginRequest);
            this.account = response.account;
            return this.account;
        } catch (error) {
            const err = error as any;
            let msg = err?.message || 'Login failed';
            if (typeof msg === 'string') {
                if (msg.includes('AADSTS900971')) {
                    msg = 'Azure error: No reply address provided. Ensure your Azure App registration has a SPA redirect URI matching this app\'s URL (e.g., http://localhost:3000).';
                } else if (msg.includes('AADSTS50194')) {
                    msg = 'Azure error: App is not configured as multi-tenant. Either switch Azure Authority in settings (common/organizations/consumers) or update your Azure app audience.';
                }
            }
            console.error("Login failed:", error);
            throw new Error(msg);
        }
    }

    public async logout(): Promise<void> {
        if (!this.isInitialized || !this.msalInstance) {
            throw new Error("OneDriveService not initialized.");
        }
        if (this.account) {
            await this.msalInstance.logoutPopup({ account: this.account });
            this.account = null;
        }
    }

    public getAccount(): msal.AccountInfo | null {
        return this.account;
    }

    private async acquireToken(): Promise<string> {
        if (!this.isInitialized || !this.msalInstance) {
            throw new Error("OneDriveService not initialized.");
        }
        if (!this.account) throw new Error("User not logged in.");

        const request = { ...loginRequest, account: this.account };
        try {
            const response = await this.msalInstance.acquireTokenSilent(request);
            return response.accessToken;
        } catch (error) {
            if (error instanceof msal.InteractionRequiredAuthError) {
                const response = await this.msalInstance.acquireTokenPopup(request);
                return response.accessToken;
            }
            throw error;
        }
    }

    public async uploadFile(file: File, path: string): Promise<void> {
        if (!this.isInitialized || !this.account) {
            throw new Error("Cannot upload file: OneDrive not initialized or user not logged in.");
        }
        
        const accessToken = await this.acquireToken();
        
        // Sanitize and encode the path. Ensure it doesn't start with a slash.
        const sanitizedPath = path.startsWith('/') ? path.substring(1) : path;
        const encodedPath = encodeURIComponent(sanitizedPath).replace(/%2F/g, '/');

        const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': file.type,
            },
            body: file,
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || `HTTP error! status: ${response.status}`;
            throw new Error(`Failed to upload file to OneDrive: ${errorMessage}`);
        }
    }
}