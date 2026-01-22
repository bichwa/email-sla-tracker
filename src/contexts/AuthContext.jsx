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
    const [msalAccount, setMsalAccount] = useState(null)

    useEffect(() => {
        // Initialize MSAL and check session
        const initAuth = async () => {
            try {
                await initializeMsal()

                // Check for existing Supabase session
                const { data: { session } } = await supabase.auth.getSession()

                if (session) {
                    setUser(session.user)
                    await fetchEmployeeData(session.user.email)
                }

                // Check for MSAL account
                const accounts = msalInstance.getAllAccounts()
                if (accounts.length > 0) {
                    setMsalAccount(accounts[0])
                }

                // Listen for auth changes
                const { data: { subscription } } = supabase.auth.onAuthStateChange(
                    async (_event, session) => {
                        setUser(session?.user ?? null)
                        if (session?.user) {
                            await fetchEmployeeData(session.user.email)
                        } else {
                            setEmployee(null)
                        }
                    }
                )

                setLoading(false)

                return () => {
                    subscription.unsubscribe()
                }
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

            // Sign in with MSAL
            const msalResponse = await msalInstance.loginPopup(loginRequest)
            setMsalAccount(msalResponse.account)

            // Get access token
            const tokenResponse = await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: msalResponse.account,
            })

            // Sign in to Supabase with Microsoft OAuth
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                    scopes: 'email profile openid',
                },
            })

            if (error) throw error

            return data
        } catch (error) {
            console.error('Sign in error:', error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        try {
            setLoading(true)

            // Sign out from Supabase
            await supabase.auth.signOut()

            // Sign out from MSAL
            if (msalAccount) {
                await msalInstance.logoutPopup({
                    account: msalAccount,
                })
            }

            setUser(null)
            setEmployee(null)
            setMsalAccount(null)
        } catch (error) {
            console.error('Sign out error:', error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const getAccessToken = async () => {
        try {
            if (!msalAccount) {
                const accounts = msalInstance.getAllAccounts()
                if (accounts.length === 0) {
                    throw new Error('No active account')
                }
                setMsalAccount(accounts[0])
            }

            const response = await msalInstance.acquireTokenSilent({
                ...loginRequest,
                account: msalAccount || msalInstance.getAllAccounts()[0],
            })

            return response.accessToken
        } catch (error) {
            console.error('Error getting access token:', error)

            // Try interactive token acquisition
            try {
                const response = await msalInstance.acquireTokenPopup(loginRequest)
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
        msalAccount,
        signInWithMicrosoft,
        signOut,
        getAccessToken,
        isAdmin: employee?.is_admin || false,
        isAuthenticated: !!user,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
