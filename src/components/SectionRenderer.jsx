import './SectionRenderer.css'

// entity_sections.layout -> render style. Falls back to 'grid' for unset/unknown
// values so nothing breaks if a section was created before layout existed.
// item shape (from entity_section_items): item_name, description, duration,
// price_from, price_to, price_label, icon, sort_order, metadata: { image_url,
// includes: [], features: [], value?, requires?, deposit?, ages?, note? }

function priceText(item) {
  if (item.price_from != null) {
    return item.price_to != null && item.price_to !== item.price_from
      ? `$${item.price_from}\u2013$${item.price_to}`
      : `$${item.price_from}`
  }
  return item.price_label || null
}

function TierList({ tiers }) {
  if (!tiers?.length) return null
  return (
    <div className="sr-tiers">
      {tiers.map(t => (
        <div key={t.id} className="sr-tier-row">
          <span className="sr-tier-label">{t.unit_label || t.audience || 'Price'}</span>
          <span className="sr-tier-price">{t.is_free ? 'Free' : `$${t.price}`}</span>
        </div>
      ))}
    </div>
  )
}

function GridLayout({ items }) {
  return (
    <div className="sr-grid">
      {items.map(item => {
        const m = item.metadata || {}
        return (
          <div key={item.id} className="sr-card">
            {m.image_url && <img className="sr-card-img" src={m.image_url} alt={item.item_name} />}
            <div className="sr-card-head">
              <span className="sr-card-icon">{item.icon || '\u2022'}</span>
              <span className="sr-card-name">{item.item_name}</span>
              {!item.tiers?.length && priceText(item) && <span className="sr-card-price">{priceText(item)}</span>}
            </div>
            {item.duration && <div className="sr-card-duration">\u23F1 {item.duration}</div>}
            {item.description && <p className="sr-card-desc">{item.description}</p>}
            <TierList tiers={item.tiers} />
            {(m.includes || []).length > 0 && (
              <div className="sr-chip-row">{m.includes.map((x, i) => <span key={i} className="sr-chip">\u2713 {x}</span>)}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ListLayout({ items }) {
  return (
    <div className="sr-list">
      {items.map(item => (
        <div key={item.id} className="sr-list-row">
          <div className="sr-list-main">
            <div className="sr-list-name">{item.item_name}</div>
            {item.description && <div className="sr-list-desc">{item.description}</div>}
          </div>
          {priceText(item) && <div className="sr-list-price">{priceText(item)}</div>}
        </div>
      ))}
    </div>
  )
}

function TableLayout({ items }) {
  return (
    <table className="sr-table">
      <tbody>
        {items.map(item => (
          <tr key={item.id}>
            <td className="sr-table-name">{item.item_name}</td>
            <td className="sr-table-desc">{item.description}</td>
            {items.some(i => i.duration) && <td className="sr-table-duration">{item.duration}</td>}
            <td className="sr-table-price">{priceText(item) || '\u2014'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChipsLayout({ items }) {
  return (
    <div className="sr-chip-row sr-chip-row-standalone">
      {items.map(item => <span key={item.id} className="sr-chip sr-chip-lg">{item.icon ? `${item.icon} ` : ''}{item.item_name}</span>)}
    </div>
  )
}

function AccordionLayout({ items }) {
  return (
    <div className="sr-accordion">
      {items.map(item => (
        <details key={item.id} className="sr-accordion-item">
          <summary>{item.item_name}{priceText(item) && <span className="sr-accordion-price">{priceText(item)}</span>}</summary>
          {item.description && <p>{item.description}</p>}
        </details>
      ))}
    </div>
  )
}

function GalleryLayout({ items }) {
  return (
    <div className="sr-gallery">
      {items.map(item => {
        const m = item.metadata || {}
        return (
          <div key={item.id} className="sr-gallery-item">
            {m.image_url
              ? <img src={m.image_url} alt={item.item_name} />
              : <div className="sr-gallery-fallback">{item.icon || '\ud83d\udcf7'}</div>}
            <div className="sr-gallery-caption">{item.item_name}{priceText(item) && ` \u2014 ${priceText(item)}`}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatsLayout({ items }) {
  return (
    <div className="sr-stats">
      {items.map(item => (
        <div key={item.id} className="sr-stat">
          <div className="sr-stat-value">{item.metadata?.value || priceText(item) || item.duration || '\u2014'}</div>
          <div className="sr-stat-label">{item.item_name}</div>
        </div>
      ))}
    </div>
  )
}

const LAYOUTS = {
  grid: GridLayout,
  list: ListLayout,
  table: TableLayout,
  chips: ChipsLayout,
  accordion: AccordionLayout,
  gallery: GalleryLayout,
  stats: StatsLayout,
}

export default function SectionRenderer({ section }) {
  if (!section || !(section.items || []).length) return null
  const Layout = LAYOUTS[section.layout] || GridLayout
  return (
    <div className="sr-section">
      {section.section_name && <h3 className="sr-section-title">{section.section_name}</h3>}
      {section.subtitle && <p className="sr-section-subtitle">{section.subtitle}</p>}
      <Layout items={section.items} />
    </div>
  )
}
