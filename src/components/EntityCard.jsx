import { useNavigate } from 'react-router-dom'
import '../styles/EntityCard.css'

export default function EntityCard({ entity, category }) {
  const navigate = useNavigate()
  const imageUrl = entity.hero_image_url || entity.photos?.[0]?.image_url || entity.photos?.[0]?.url || null

  const handleClick = () => navigate(`/business/${entity.slug}`)

  return (
    <div className="entity-card" onClick={handleClick}>
      {/* Image */}
      <div className="card-image" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : { display: 'grid', placeItems: 'center', fontSize: 42, background: 'linear-gradient(135deg,#eef6fb,#fdf3ea)' }}>
        {!imageUrl && <span>{entity.icon || '📍'}</span>}
        {entity.is_active === false && <div className="card-badge closed">Closed</div>}
      </div>

      {/* Content */}
      <div className="card-content">
        <h3>{entity.name}</h3>

        {entity.subtitle && <p className="subtitle">{entity.subtitle}</p>}

        {entity.city && (
          <p className="meta-text">📍 {entity.city}{entity.state ? `, ${entity.state}` : ''}</p>
        )}

        {/* Rental/unit details — beds, baths, sleeps, nightly price */}
        {(entity.building || entity.unit_number || entity.view_type) && (
          <p className="meta-text">
            {[entity.building, entity.unit_number && `Unit ${entity.unit_number}`, entity.view_type && String(entity.view_type).replace(/_/g, ' ')].filter(Boolean).join(' · ')}
          </p>
        )}
        {entity.rental && (
          <>
            {(entity.rental.bedrooms != null || entity.rental.bathrooms != null || entity.rental.capacity != null || entity.rental.sqft != null) && (
              <p className="rental-specs">
                {[
                  entity.rental.bedrooms != null && `🛏 ${entity.rental.bedrooms} BR`,
                  entity.rental.bathrooms != null && `🛁 ${entity.rental.bathrooms} BA`,
                  entity.rental.capacity != null && `👥 Sleeps ${entity.rental.capacity}`,
                  entity.rental.sqft != null && `📐 ${entity.rental.sqft} sqft`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
            {entity.rental.nightly_price != null && (
              <p className="rental-price">
                From ${Number(entity.rental.nightly_price).toLocaleString()}/night
                {entity.rental.min_nights ? ` · ${entity.rental.min_nights}-night min` : ''}
              </p>
            )}
          </>
        )}

        {entity.rating && (
          <p className="rating">
            ⭐ {parseFloat(entity.rating).toFixed(1)} ({entity.review_count || 0})
          </p>
        )}

        {/* Food, Shopping, Nightlife — categories mapCategory() actually produces
            (see services/gcrApi.js); the previous list here ('restaurants',
            'coffee', 'services', 'public-spots', 'happy-hours') never matched
            anything real, so restaurant/bar children of a hub silently lost
            their description and happy-hour badge. */}
        {['food', 'shopping', 'nightlife'].includes(category) && (
          <>
            {entity.description && (
              <p className="description">{entity.description.slice(0, 100)}...</p>
            )}
            {entity.hh_days && (
              <p className="hh-badge">🍺 {entity.hh_days}</p>
            )}
          </>
        )}

        {/* Activities */}
        {category === 'activities' && (
          <>
            {entity.price_range && <p className="price-badge">💰 From {entity.price_range}</p>}
            {entity.duration && <p className="meta-text">⏱ {entity.duration}</p>}
            {entity.group_size && <p className="meta-text">👥 Up to {entity.group_size}</p>}
            {entity.booking_url && <p className="confirm-badge">✅ Instant Confirmation</p>}
          </>
        )}

        {/* Stay */}
        {category === 'stay' && (
          <>
            {entity.unit_count && (
              <p className="units-badge">{entity.unit_count} Unit Types</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
