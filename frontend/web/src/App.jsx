import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Onboarding, { action as onboardingAction } from './pages/Onboarding';
import Dashboard, { loader as dashboardLoader } from './pages/Dashboard';
import SendMoney from './pages/SendMoney';
import CashOut from './pages/CashOut';
import CashIn from './pages/CashIn';
import PayBill from './pages/PayBill';
import BuyGoods from './pages/BuyGoods';
import TransactionHistory from './pages/TransactionHistory';
import Notifications from './pages/Notifications';
import FacialVerification from './pages/FacialVerification';
import Profile from './pages/Profile';
import MobileSimulator from './pages/MobileSimulator';

import swipePayRedLogo from './assets/swipe-pay-red-logo.png';

import { Provider } from 'react-redux';
import store from '../redux_store/stores';

function ProtectedRoute({ children, hideNav = false }) {
  const { isAuthenticated, isLoading, facialVerified } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="animate-pulse-soft flex flex-col items-center gap-3">
          <img
            src={swipePayRedLogo}
            alt="Swipe Pay"
            className="w-14 h-14 object-contain"
          />
          <p className="text-xs font-bold text-neutral-500">
            Loading your secure wallet...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!facialVerified) {
    const bioType =
      sessionStorage.getItem('pending_biometric_type') || 'facial';
    return <Navigate to={`/verify/facial?type=${bioType}`} replace />;
  }

  return <AppLayout hideNav={hideNav}>{children}</AppLayout>;
}

function BiometricRoute({ children }) {
  const { isAuthenticated, isLoading, facialVerified } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="animate-pulse-soft flex flex-col items-center gap-3">
          <img
            src={swipePayRedLogo}
            alt="Swipe Pay"
            className="w-14 h-14 object-contain"
          />
          <p className="text-xs font-bold text-neutral-500">
            Loading your secure wallet...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (facialVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }) {
  const { isAuthenticated, facialVerified } = useAuth();

  // Only redirect away from login/onboarding if user is fully authenticated AND biometric verified
  if (isAuthenticated && facialVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RootLayout() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <Outlet />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // Default landing page is Sign In (Login)
      {
        index: true,
        element: <Login />,
      },
      {
        path: 'onboarding',
        element: <Onboarding />,
        action: onboardingAction,
      },

      // Public routes
      {
        path: 'login',
        element: <Login />,
      },

      // Protected routes
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        ),
        loader: dashboardLoader,
      },
      {
        path: 'verify/facial',
        element: (
          <BiometricRoute>
            <FacialVerification />
          </BiometricRoute>
        ),
      },
      {
        path: 'send',
        element: (
          <ProtectedRoute>
            <SendMoney />
          </ProtectedRoute>
        ),
      },
      {
        path: 'cash-out',
        element: (
          <ProtectedRoute>
            <CashOut />
          </ProtectedRoute>
        ),
      },
      {
        path: 'cash-in',
        element: (
          <ProtectedRoute>
            <CashIn />
          </ProtectedRoute>
        ),
      },
      {
        path: 'pay-bill',
        element: (
          <ProtectedRoute>
            <PayBill />
          </ProtectedRoute>
        ),
      },
      {
        path: 'buy-goods',
        element: (
          <ProtectedRoute>
            <BuyGoods />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute>
            <TransactionHistory />
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: 'mobile',
        element: (
          <ProtectedRoute hideNav={true}>
            <MobileSimulator />
          </ProtectedRoute>
        ),
      },

      // Fallback
      // {
      //   path: '*',
      //   element: <Navigate to="/" replace />,
      // },
    ],
  },
]);

export default function App() {
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  );
}
