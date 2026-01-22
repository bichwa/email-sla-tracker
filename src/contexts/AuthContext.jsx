import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { msalInstance, loginRequest, initializeMsal } from '../lib/msal'

const AuthContext = createContext({})

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [employee, setEmployee] = useState(null)
    const [loading, setLoading] = useState(true)
    const [accessToken, setAccessToken] = useState(null)

    useEffect(() => {
        // Initialize authentication
        const initAuth = async () => {
            try {
                await initializeMsal()

                // Check for stored session
                const storedUser = localStorage.getItem('msalUser')
                if (storedUser) {
                    const userData = JSON.parse(storedUser)
                    setUser(userData)
                    await fetchEmployeeData(userData.email)
                }

                // Check for MSAL account
                const accounts = msalInstance.getAllAccounts()
                if (accounts.length > 0 && !storedUser) {
                    // User has MSAL session but no stored user - fetch user info
                    const account = accounts[0]
                    const userInfo = {
                        email: account.username,
                        name: account.name,
                        id: account.localAccountId,
                    }
                    setUser(userInfo)
                    localStorage.setItem('msalUser', JSON.stringify(userInfo))
                    await fetchEmployeeData(account.username)
                }

                setLoading(false)
            } catch (error) {
                console.error('Auth initialization error:', error)
                setLoading(false)
            }
        }

        initAuth()
    }, [])

    const fetchEmployeeData = async (email) => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('email', email)
                .single()

            if (error) {
                console.error('Error fetching employee data:', error)
                return
            }

            setEmployee(data)
        } catch (error) {
            console.error('Error fetching employee:', error)
        }
    }

    const signInWithMicrosoft = async () => {
        try {
            setLoading(true)

            // Sign in with MSAL popup
            const msalResponse = await msalInstance.loginPopup(loginRequest)

            // Get user info from account
            const userInfo = {
                email: msalResponse.account.username,
                name: msalResponse.account.name,
                id: msalResponse.account.localAccountId,
            }

            // Store user info
            setUser(userInfo)
            localStorage.setItem('msalUser', JSON.stringify(userInfo))

            // Get access token
            const tokenResponse = await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: msalResponse.account,
            })

            setAccessToken(tokenResponse.accessToken)

            // Fetch employee data from Supabase
            await fetchEmployeeData(userInfo.email)

            return userInfo
        } catch (error) {
            console.error('Sign in error:', error)
            setLoading(false)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        try {
            setLoading(true)

            // Get current account
            const accounts = msalInstance.getAllAccounts()

            // Sign out from MSAL
            if (accounts.length > 0) {
                await msalInstance.logoutPopup({
                    account: accounts[0],
                })
            }

            // Clear local storage
            localStorage.removeItem('msalUser')

            // Clear state
            setUser(null)
            setEmployee(null)
            setAccessToken(null)
        } catch (error) {
            console.error('Sign out error:', error)
        } finally {
            setLoading(false)
        }
    }

    const getAccessToken = async () => {
        try {
            const accounts = msalInstance.getAllAccounts()
            if (accounts.length === 0) {
                throw new Error('No active account. Please sign in.')
            }

            const response = await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: accounts[0],
            })

            setAccessToken(response.accessToken)
            return response.accessToken
        } catch (error) {
            console.error('Error getting access token:', error)

            // Try interactive token acquisition
            try {
                const response = await msalInstance.acquireTokenPopup(loginRequest)
                setAccessToken(response.accessToken)
                return response.accessToken
            } catch (popupError) {
                console.error('Popup token acquisition failed:', popupError)
                throw popupError
            }
        }
    }

    const value = {
        user,
        employee,
        loading,
        accessToken,
        signInWithMicrosoft,
        signOut,
        getAccessToken,
        isAdmin: employee?.is_admin || false,
        isAuthenticated: !!user,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
