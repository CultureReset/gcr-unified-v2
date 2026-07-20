import { useState, useEffect } from 'react'
import { API_BASE } from '../config'

const POLICY_LABELS = {
  cancellation: 'Cancellation Policy',
  refund: 'Refund Policy',
  house_rules: 'House Rules',
  accessibility: 'Accessibility Information',
  pet_policy: 'Pet Policy',
}

export default function PoliciesSection({ slug, policies: entityPolicies }) {
  const [faqPolicies, setFaqPolicies] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setFaqPolicies([])
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/faqs/${encodeURIComponent(slug)}`)
        if (!res.ok) return
        const data = await res.json()
        // FAQs with a category that matches known policy types are shown as policies
        const policyCategories = new Set(Object.keys(POLICY_LABELS))
        const policyFaqs = (data.faqs || []).filter(f => policyCategories.has(f.category))
        setFaqPolicies(policyFaqs)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [slug])

  // entity_policies rows (policy_type/title/body) — the platform's real
  // policies table, kept separate from the faqs-as-policies fallback above
  // so both sources show even if only one has data for a given entity.
  const dbPolicies = (entityPolicies || []).map(p => ({
    id: p.id,
    label: p.title || POLICY_LABELS[p.policy_type] || p.policy_type || p.type,
    content: p.body || p.content,
  }))

  if (loading) return <div className="loading">Loading policies...</div>

  const hasAny = dbPolicies.length > 0 || faqPolicies.length > 0
  if (!hasAny) return <p className="no-data">No policies available</p>

  return (
    <section className="content-section policies-section">
      <h2>📋 Policies & Information</h2>
      <div className="policies-accordion">
        {dbPolicies.map((policy, i) => (
          <details key={`db-${policy.id || i}`} className="policy-item">
            <summary>{policy.label}</summary>
            <div className="policy-content">{policy.content}</div>
          </details>
        ))}
        {faqPolicies.map((policy, i) => (
          <details key={`faq-${policy.id || i}`} className="policy-item">
            <summary>{POLICY_LABELS[policy.category] || policy.question}</summary>
            <div className="policy-content">{policy.answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
