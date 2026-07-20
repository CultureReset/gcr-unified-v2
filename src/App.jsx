import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import ErrorBoundary from './ErrorBoundary'
import { DEFAULT_MODE, API_BASE } from './config'
import { hydrateTaxonomy } from './categoryMap'
import Landing from './pages/Landing'
import LinksPage from './pages/LinksPage'
import CategoryListings from './pages/CategoryListings'
import NotFound from './pages/NotFound'
import CategoryPage from './pages/CategoryPage'
import Events from './pages/Events'
import Search from './pages/Search'
import Auth from './pages/Auth'
import Reset from './pages/Reset'
import Invite from './pages/Invite'
import Setup from './pages/Setup'
import Home from './pages/Home'
import LiveFeed from './pages/LiveFeed'
import ArtistLive from './pages/ArtistLive'
import Swipe from './pages/Swipe'
import BusinessDetail from './pages/BusinessDetail'
import MyList from './pages/MyList'
import Building from './pages/Building'
import Itinerary from './pages/Itinerary'
import Profile from './pages/Profile'
import Saves from './pages/Saves'
import Groups from './pages/Groups'
import Group from './pages/Group'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import ReviewUpload from './pages/ReviewUpload'
import RestaurantMenu from './pages/RestaurantMenu'
import ArtistListings from './pages/ArtistListings'
import ArtistProfile from './pages/ArtistProfile'
import RentalListings from './pages/RentalListings'
import RentalDetail from './pages/RentalDetail'
import BookRental from './pages/BookRental'
import ServiceListings from './pages/ServiceListings'
import ServiceDetail from './pages/ServiceDetail'
import BookService from './pages/BookService'
import Reserve from './pages/Reserve'
import TransportationRequest from './pages/TransportationRequest'
import Confirmation from './pages/Confirmation'
import Deals from './pages/Deals'
import ArHunts from './pages/ArHunts'
import BottomNav from './components/BottomNav'
import InstallBanner from './components/InstallBanner'
import GCRHeader from './components/GCRHeader'
import AiChat from './components/AiChat'

function RequireAuth({ children }) {
  const { userId } = useApp()
  const location = useLocation()
  const hasToken = !!localStorage.getItem('gcr_access_token')
  if (!hasToken && !userId) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useApp()
  // Swipe.jsx builds its own full-screen header (close button, title, view
  // toggle) with safe-top/safe-bottom insets — same chrome-less pattern as
  // /rental, /service. It was missing from this list, so the
  // global header + fixed bottom nav were stacking on top of it, squeezing
  // the swipe deck's own action-button row down until it overlapped the
  // fixed bottom nav and became partly unclickable.
  //
  // /business/* used to be in this list too, but BusinessDetail never
  // actually built its own replacement chrome (unlike Swipe) — it only has
  // a bare back/share bar, and its own CSS (scroll-margin-top) still
  // references --gcr-header-h as if the header were present. Every real GCR
  // profile needs the normal header/nav for navigation.
  const hideNav = ['/', '/auth'].some(p => location.pathname === p) ||
    location.pathname.startsWith('/setup') ||
    location.pathname.startsWith('/artist/') ||
    location.pathname.startsWith('/menu/') ||
    location.pathname.startsWith('/rental/') ||
    location.pathname.startsWith('/service/') ||
    location.pathname.startsWith('/links/') ||
    location.pathname.startsWith('/swipe/')
  const hideHeader = ['/', '/auth'].some(p => location.pathname === p) ||
    location.pathname.startsWith('/setup') ||
    location.pathname.startsWith('/artist/') ||
    location.pathname.startsWith('/menu/') ||
    location.pathname.startsWith('/rental/') ||
    location.pathname.startsWith('/service/') ||
    location.pathname.startsWith('/links/') ||
    location.pathname.startsWith('/swipe/')

  useEffect(() => {
    function onUnauth() {
      logout()
      const publicPaths = ['/', '/auth', '/reset', '/join', '/privacy', '/terms']
      const publicPrefixes = ['/business/', '/category/', '/restaurants', '/coffee', '/happy-hours', '/things-to-do', '/services', '/public-spots', '/feed', '/shopping', '/staying', '/events', '/swipe/', '/search', '/nightlife', '/wellness', '/artist/']
      const isPublic = publicPaths.includes(location.pathname) || publicPrefixes.some(p => location.pathname.startsWith(p))
      if (!isPublic) {
        navigate('/auth', { replace: true, state: { from: location.pathname + location.search } })
      }
    }
    window.addEventListener('gcr:unauthorized', onUnauth)
    return () => window.removeEventListener('gcr:unauthorized', onUnauth)
  }, [location.pathname, location.search, logout, navigate])

  // Track route changes — fires on every page navigation
  useEffect(() => {
    const API = import.meta.env.VITE_API_BASE || 'https://gcr-api-clean.vercel.app'
    let sess = sessionStorage.getItem('ts_sess_id')
    if (!sess) { sess = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('ts_sess_id', sess) }
    const qs = new URLSearchParams(location.search)
    const utm = {}
    ;['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k => {
      const v = qs.get(k) || sessionStorage.getItem('ts_' + k)
      if (v) { utm[k] = v; sessionStorage.setItem('ts_' + k, v) }
    })
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    fetch(API + '/api/gcr/track', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_path: location.pathname, referrer: document.referrer || null, session_id: sess, device_type: device, source: 'tripswipe', ...utm })
    }).catch(() => {})
  }, [location.pathname])

  return (
    <div className={`app-shell${hideHeader ? ' no-header' : ''}`}>
      {!hideHeader && <GCRHeader />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/browse" element={<Navigate to="/" replace />} />
        <Route path="/search" element={<Search />} />
        <Route path="/category/:category" element={<CategoryListings />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/join" element={<Invite />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/review/:slug" element={<ReviewUpload />} />
        <Route path="/menu/:slug" element={<RestaurantMenu />} />
        <Route path="/artists" element={<ArtistListings />} />
        <Route path="/artist/:slug" element={<ArtistProfile />} />
        <Route path="/staying" element={<RentalListings />} />
        <Route path="/stays" element={<Navigate to="/staying" replace />} />
        <Route path="/rental/:slug" element={<RentalDetail />} />
        <Route path="/book-rental/:slug" element={<BookRental />} />
        <Route path="/confirmation/:type/:id" element={<Confirmation />} />
        <Route path="/services" element={<ServiceListings />} />
        <Route path="/service/:slug" element={<ServiceDetail />} />
        <Route path="/book-service/:slug" element={<BookService />} />
        <Route path="/reserve/:slug" element={<Reserve />} />
        <Route path="/transportation/:slug" element={<TransportationRequest />} />
        <Route path="/setup/*" element={<RequireAuth><Setup /></RequireAuth>} />
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/swipe/:category" element={<Swipe />} />
        <Route path="/artist/:slug/live" element={<ArtistLive />} />
        <Route path="/business/:slug" element={<BusinessDetail />} />
        <Route path="/links/:slug" element={<LinksPage />} />
        <Route path="/list" element={<RequireAuth><MyList /></RequireAuth>} />
        <Route path="/building" element={<RequireAuth><Building /></RequireAuth>} />
        <Route path="/itinerary" element={<RequireAuth><Itinerary /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/saves" element={<RequireAuth><Saves /></RequireAuth>} />
        <Route path="/groups" element={<RequireAuth><Groups /></RequireAuth>} />
        <Route path="/group/:slug" element={<RequireAuth><Group /></RequireAuth>} />

        {/* GCR Category Pages */}
        <Route path="/restaurants" element={<CategoryPage />} />
        <Route path="/coffee" element={<CategoryPage />} />
        <Route path="/happy-hours" element={<CategoryPage />} />
        <Route path="/events" element={<Events />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/things-to-do" element={<CategoryPage />} />
        <Route path="/ar-hunts" element={<ArHunts />} />
        <Route path="/public-spots" element={<CategoryPage />} />
        <Route path="/feed" element={<LiveFeed />} />
        <Route path="/shopping" element={<CategoryPage />} />
        <Route path="/nightlife" element={<CategoryPage />} />
        <Route path="/wellness" element={<CategoryPage />} />
        <Route path="/marinas" element={<CategoryPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideNav && <BottomNav />}
      {!hideNav && <InstallBanner />}
      {!hideNav && <AiChat />}
    </div>
  )
}

export default function App() {
  useEffect(() => { hydrateTaxonomy(API_BASE) }, [])
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
