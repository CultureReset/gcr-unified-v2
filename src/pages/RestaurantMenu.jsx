import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import './RestaurantMenu.css';

export default function RestaurantMenu() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null);
  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMenu(null);
    setActiveTab('menu');
    const fetchMenu = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/menu?slug=${slug}`);
        if (!res.ok) throw new Error('Menu not found');
        const data = await res.json();
        setMenu(data);
      } catch (err) {
        console.error('Error loading menu:', err);
        setMenu(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();

    // Check if phone is stored in session
    const stored = sessionStorage.getItem(`menu_phone_${slug}`);
    if (stored) setUserPhone(stored);
  }, [slug]);

  if (loading) return <div className="menu-loading">Loading menu...</div>;
  if (!menu) return <div className="menu-error">Menu not found</div>;

  return (
    <div className="restaurant-menu">
      {/* Header */}
      <div className="menu-header">
        {menu.logo_url && <img src={menu.logo_url} alt={menu.business_name} className="menu-logo" />}
        <h1>{menu.business_name}</h1>
        {menu.tagline && <p className="menu-tagline">{menu.tagline}</p>}
      </div>

      {/* Tabs */}
      <div className="menu-tabs">
        <button
          className={`tab ${activeTab === 'menu' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu')}
        >
          🍽️ Menu
        </button>
        {menu.sections?.drink?.length > 0 && (
          <button
            className={`tab ${activeTab === 'drinks' ? 'active' : ''}`}
            onClick={() => setActiveTab('drinks')}
          >
            🍹 Drinks
          </button>
        )}
        {menu.sections?.happy_hour?.length > 0 && (
          <button
            className={`tab ${activeTab === 'happy-hour' ? 'active' : ''}`}
            onClick={() => setActiveTab('happy-hour')}
          >
            🕐 Happy Hour
          </button>
        )}
        {menu.live_artist && (
          <button
            className={`tab ${activeTab === 'live-music' ? 'active' : ''}`}
            onClick={() => setActiveTab('live-music')}
          >
            🎵 Live Music
          </button>
        )}
        {menu.events && menu.events.length > 0 && (
          <button
            className={`tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            📅 Events
          </button>
        )}
        {menu.specials && menu.specials.length > 0 && (
          <button
            className={`tab ${activeTab === 'specials' ? 'active' : ''}`}
            onClick={() => setActiveTab('specials')}
          >
            ⭐ Specials
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="menu-content">
        {activeTab === 'menu' && (
          <div className="menu-items">
            {menu.menu && menu.menu.length > 0 ? (
              menu.menu.map((section, idx) => (
                <div key={idx} className="menu-section">
                  <h2>{section.category}</h2>
                  <div className="items-grid">
                    {section.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="menu-item">
                        {item.image_url && <img src={item.image_url} alt={item.name} />}
                        <h3>{item.name}</h3>
                        {item.description && <p className="item-desc">{item.description}</p>}
                        {Array.isArray(item.tags) && item.tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0' }}>
                            {item.tags.slice(0, 5).map((t, i) => (
                              <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(13,125,116,.12)', color: '#0d7d74' }}>{typeof t === 'string' ? t : t.tag_name}</span>
                            ))}
                          </div>
                        )}
                        {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                          <div style={{ fontSize: 12, margin: '4px 0 2px', opacity: .85 }}>
                            {item.modifiers.slice(0, 6).map((m, i) => (
                              <div key={i}>
                                <span style={{ opacity: .65 }}>{m.group ? m.group + ': ' : ''}</span>
                                {m.name}
                                {m.price_delta > 0 && <span style={{ fontWeight: 700 }}> +${Number(m.price_delta).toFixed(2)}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="item-footer">
                          {item.price > 0 && <span className="price">${item.price.toFixed(2)}</span>}
                          <button className="add-btn">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>No menu items available</p>
            )}
          </div>
        )}

        {activeTab === 'drinks' && (
          <div className="menu-items">
            {menu.sections.drink.map((section, idx) => (
              <div key={idx} className="menu-section">
                <h2>{section.name}</h2>
                <div className="items-grid">
                  {section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="menu-item">
                      {item.image_url && <img src={item.image_url} alt={item.name} />}
                      <h3>{item.name}</h3>
                      {item.description && <p className="item-desc">{item.description}</p>}
                      <div className="item-footer">
                        <span className="price">${item.price.toFixed(2)}</span>
                        <button className="add-btn">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'happy-hour' && (
          <div className="menu-items">
            {menu.sections.happy_hour.map((section, idx) => (
              <div key={idx} className="menu-section">
                <h2>{section.name}</h2>
                <div className="items-grid">
                  {section.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="menu-item">
                      {item.image_url && <img src={item.image_url} alt={item.name} />}
                      <h3>{item.name}</h3>
                      {item.description && <p className="item-desc">{item.description}</p>}
                      <div className="item-footer">
                        <span className="price">${item.price.toFixed(2)}</span>
                        <button className="add-btn">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'live-music' && menu.live_artist && (
          <div className="live-music-tab">
            <div
              className="artist-card artist-card-preview"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/artist/${menu.live_artist.slug}/live`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/artist/${menu.live_artist.slug}/live`) }}
            >
              {menu.live_artist.photo_url && (
                <img src={menu.live_artist.photo_url} alt={menu.live_artist.artist_name} className="artist-photo" />
              )}
              <h2>{menu.live_artist.artist_name}</h2>
              <span className="artist-link-cta">Tap to view artist page →</span>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="events-list">
            {menu.events && menu.events.length > 0 ? (
              menu.events.map((event, idx) => (
                <div key={idx} className="event-card">
                  <h3>{event.event_name}</h3>
                  {event.description && <p>{event.description}</p>}
                  {event.event_date && <p className="event-date">📅 {event.event_date}</p>}
                </div>
              ))
            ) : (
              <p>No upcoming events</p>
            )}
          </div>
        )}

        {activeTab === 'specials' && (
          <div className="specials-list">
            {menu.specials && menu.specials.length > 0 ? (
              menu.specials.map((special, idx) => (
                <div key={idx} className="special-card">
                  <h3>{special.special_name || special.name}</h3>
                  {special.description && <p>{special.description}</p>}
                  {special.discount_text
                    ? <span className="price">{special.discount_text}</span>
                    : special.discount_value != null
                      ? <span className="price">{special.discount_value}{special.discount_type === 'percent' ? '% off' : special.discount_type === 'fixed' ? ' off' : ''}</span>
                      : special.price ? <span className="price">${special.price}</span> : null}
                  {(special.days || special.day_of_week) && <p className="special-days">{special.days || special.day_of_week}</p>}
                </div>
              ))
            ) : (
              <p>No specials available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
