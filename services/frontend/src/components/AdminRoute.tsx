import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
  if (!user || (user.role !== 'QUIZMASTER' && user.role !== 'QUIZADMIN'))
    return <Navigate to="/" replace />
  return <>{children}</>
}
