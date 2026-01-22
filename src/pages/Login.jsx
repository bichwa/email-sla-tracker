import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Shield } from 'lucide-react'

export const Login = () => {
    const { signInWithMicrosoft, isAuthenticated, loading } = useAuth()
    const [error, setError] = useState(null)
    const [isSigningIn, setIsSigningIn] = useState(false)
    const navigate = useNavigate()
    const location = useLocation()

    const from = location.state?.from?.pathname || '/dashboard'

    useEffect(() => {
        if (isAuthenticated && !loading) {
            navigate(from, { replace: true })
        }
    }, [isAuthenticated, loading, navigate, from])

    const handleSignIn = async () => {
        try {
            setIsSigningIn(true)
            setError(null)
            await signInWithMicrosoft()
        } catch (err) {
            console.error('Login error:', err)
            setError('Failed to sign in. Please try again or contact support.')
        } finally {
            setIsSigningIn(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
                    <p className="mt-4">Loading...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 px-4">
            <div className="max-w-md w-full">
                {/* Logo and Title */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
                        <Mail className="w-10 h-10 text-primary-600" />
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Email SLA Tracker
                    </h1>
                    <p className="text-primary-100 text-lg">
                        Monitor. Track. Deliver.
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 animate-slide-in">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                            Welcome Back
                        </h2>
                        <p className="text-gray-600">
                            Sign in with your Solvit account to continue
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSignIn}
                        disabled={isSigningIn}
                        className="w-full btn-primary py-3 text-lg font-medium flex items-center justify-center gap-3 hover:scale-105 transform transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isSigningIn ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Signing in...
                            </>
                        ) : (
                            <>
                                <Shield className="w-5 h-5" />
                                Sign in with Microsoft
                            </>
                        )}
                    </button>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Shield className="w-4 h-4 text-gray-400" />
                            <span>
                                Secured by Microsoft Entra ID
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-8 text-primary-100 text-sm">
                    <p>© 2026 Solvit Limited. All rights reserved.</p>
                    <p className="mt-2">Email SLA Tracker v2.0</p>
                </div>
            </div>
        </div>
    )
}
