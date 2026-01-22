import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export const AuthCallback = () => {
    const navigate = useNavigate()

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Get the session from the URL hash
                const { data, error } = await supabase.auth.getSession()

                if (error) {
                    console.error('Auth callback error:', error)
                    navigate('/login', { replace: true })
                    return
                }

                if (data.session) {
                    navigate('/dashboard', { replace: true })
                } else {
                    navigate('/login', { replace: true })
                }
            } catch (err) {
                console.error('Callback handling error:', err)
                navigate('/login', { replace: true })
            }
        }

        handleCallback()
    }, [navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Completing sign in...</p>
            </div>
        </div>
    )
}
