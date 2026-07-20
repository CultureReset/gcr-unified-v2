import './SkeletonLoader.css'

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-image" />
      <div className="skeleton-content">
        <div className="skeleton skeleton-text skeleton-title" />
        <div className="skeleton skeleton-text" />
        <div className="skeleton skeleton-text short" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 4 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonBusinessSection() {
  return (
    <div className="skeleton-business">
      <div className="skeleton-business-header">
        <div className="skeleton skeleton-image skeleton-business-img" />
        <div className="skeleton-business-info">
          <div className="skeleton skeleton-text skeleton-title" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text short" />
        </div>
      </div>
      <SkeletonGrid count={3} />
    </div>
  )
}
