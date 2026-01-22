import { PublicClientApplication } from '@azure/msal-browser'

const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID}`,
        redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || window.location.origin + '/auth/callback',
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
    },
}

export const msalInstance = new PublicClientApplication(msalConfig)

export const loginRequest = {
    scopes: ['User.Read', 'Mail.Read', 'Mail.ReadWrite'],
}

// Initialize MSAL
export const initializeMsal = async () => {
    await msalInstance.initialize()

    // Handle redirect promise
    try {
        const response = await msalInstance.handleRedirectPromise()
        if (response) {
            return response
        }
    } catch (error) {
        console.error('MSAL redirect error:', error)
        throw error
    }

    return null
}
