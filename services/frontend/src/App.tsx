import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RoomCreatePage from './pages/RoomCreatePage'
import RoomPage from './pages/RoomPage'
import TrainPage from './pages/TrainPage'
import AdminLayout from './components/AdminLayout'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminQuestionsPage from './pages/AdminQuestionsPage'
import AdminQuestionCreatePage from './pages/AdminQuestionCreatePage'
import AdminQuestionEditPage from './pages/AdminQuestionEditPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import ProfilePage from './pages/ProfilePage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/room/create" element={<RoomCreatePage />} />
        <Route path="/room/:id" element={<RoomPage />} />
        <Route path="/train" element={<ProtectedRoute><TrainPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="questions" element={<AdminQuestionsPage />} />
          <Route path="questions/new" element={<AdminQuestionCreatePage />} />
          <Route path="questions/:id/edit" element={<AdminQuestionEditPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  )
}
