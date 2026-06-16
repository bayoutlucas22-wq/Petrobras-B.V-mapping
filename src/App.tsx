import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type ReactFlowInstance,
  type NodeProps,
} from 'reactflow'
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, FileSearch, Landmark, Search, CircleDollarSign, X, Compass } from 'lucide-react'
import Globe from 'react-globe.gl'
import { sourceLinks, studyTimeline } from './data'
import contractsCsv from '../Consulta (17).csv?raw'
import './styles.css'

type ViewFilter = 'all' | 'supplier' | 'active' | 'completed' | 'cancelled' | `year-${string}`
type ContractStatus = 'Ativo' | 'Concluído' | 'Cancelado' | 'Outros'
type NodeKind = 'hub' | 'cluster' | 'contract'
type GraphMode = 'structure' | 'suppliers' | 'services'

type ContractRecord = {
  supplier: string
  contractNumber: string
  object: string
  legalBasis: string
  start: string
  end: string
  value: string
  status: string
  currency: string
  procurement: string
}

type EntityGroup = {
  canonical: string
  category: string
  aliases: string[]
  records: ContractRecord[]
  amount: number
  upstream: boolean
  adjacent: boolean
  aliasRisk: 'low' | 'medium' | 'high'
  procurementSensitive: number
  score: number
  reasons: string[]
}

type GraphNodeData = {
  kind: NodeKind
  title: string
  summary: string
  amount: number
  count: number
  status: ContractStatus
  meta: string[]
  expanded?: boolean
  contractNumber?: string
  parentId?: string
}

type GlobeArc = {
  entity: string
  category: string
  route: 'contracting-source' | 'offshore-deployment'
  value: number
  score: number
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  color: string
}

type GlobePoint = {
  label: string
  lat: number
  lng: number
  size: number
  color: string
}

const filters: Array<{ key: ViewFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'active', label: 'Ativo' },
  { key: 'completed', label: 'Concluído' },
  { key: 'cancelled', label: 'Cancelado' },
]

function formatMoney(value: number) {
  return `Nominal ${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)}`
}

function parseMoney(raw: string) {
  const value = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        cell += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ';' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell || row.length) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows
}

function parseContracts(csv: string): ContractRecord[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''))
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])) as Record<string, string>
    return {
      supplier: record['Fornecedor'] || '',
      contractNumber: record['Número do contrato'] || '',
      object: record['Objeto da contratação'] || '',
      legalBasis: record['Fundamento legal'] || '',
      start: record['Início da vigência'] || '',
      end: record['Fim da vigência'] || '',
      value: record['Valor do contrato'] || '',
      status: record['Situação'] || '',
      currency: record['Valor do contrato'].replace(/[^\w]/g, '').match(/^[A-Z]+/)?.[0] || 'USD',
      procurement: record['Enquadramento do Processo'] || 'Não informado',
    }
  }).filter(row => /B\.?\s*V\.?/i.test(row.supplier))
}

function statusFor(record: ContractRecord): ContractStatus {
  if (record.status === 'Ativo') return 'Ativo'
  if (record.status === 'Concluído') return 'Concluído'
  if (record.status === 'Cancelado') return 'Cancelado'
  return 'Outros'
}

function yearFor(record: ContractRecord) {
  return record.start.slice(-4) || 'unknown'
}

const graphCenter = { x: 650, y: 390 }

function radialPosition(index: number, total: number, radiusX = 600, radiusY = 340) {
  const angle = -Math.PI / 2 + (index / Math.max(1, total)) * Math.PI * 2
  return {
    x: graphCenter.x + Math.cos(angle) * radiusX,
    y: graphCenter.y + Math.sin(angle) * radiusY,
  }
}

function serviceFor(record: ContractRecord) {
  const text = `${record.object} ${record.supplier}`.toUpperCase()
  if (/REEMBOLSO|RESSARCIMENTO|INDENIZA|HOSPEDAGEM|VISTO|ANUIDADE/.test(text)) return 'Reimbursements'
  if (/AFRETAMENTO|ALUGUEL|CHARTER|FPSO|PLATAFORMA|SONDA|DRILLING/.test(text)) return 'Charter & drilling'
  if (/UMBILICAL|RISER|FLOWLINE|FLEXIV|MANIFOLD|SUBMARIN|PLET|THRUSTER/.test(text)) return 'Subsea systems'
  if (/SOFTWARE|LICENCA|LICENSE|DATA|AVA SERVICES|CHEFEM/.test(text)) return 'Software & data'
  if (/TREINAMENTO|TRAINING|CURSO|DOUTORADO|PUBLICA|ARTICLE/.test(text)) return 'Training & research'
  if (/ENGENHARIA|ENGINEER|ANALYSIS|ANALISE|INSPECAO|CERTIFICA/.test(text)) return 'Engineering & assurance'
  if (/TURBINA|COMPRESS|EQUIPAMENTO|SOBRESSALENTE|PARTES|MATERIAL/.test(text)) return 'Equipment & parts'
  if (/PETROLEO|GAS|OIL|COMBUSTIVEL|TRADING/.test(text)) return 'Energy & trading'
  return 'Other services'
}

function canonicalEntityName(name: string) {
  return name
    .replace(/\s*-\s*PNBV$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\(PNBV\)$/i, '')
    .trim()
}

function isUpstreamEntity(name: string) {
  return /(FPSO|DRILLING|OPPORTUNITY|GAS OPPORTUNITY|TARTARUGA|MERO|SEPIA|MARLIM|BUZIOS|TAMANDARE|LIBRA|TUPI|RONCADOR|GUARA|LAPA OIL & GAS|PAPA TERRA|PETROBRAS NETHERLANDS B\.V\.|PETROBRAS GLOBAL TRADING B\.V\.)/i.test(name)
}

function categoryForEntity(name: string, records: ContractRecord[]) {
  const text = `${name} ${records.map(record => record.object).join(' ')}`.toUpperCase()
  const entity = name.toUpperCase()
  if (/PETROBRAS NETHERLANDS|PETROBRAS GLOBAL TRADING/.test(entity)) return 'Hub / trading wrapper'
  if (/TUPI|RONCADOR|GUARA|LAPA|PAPA TERRA|SAPINHO/.test(entity)) return 'Field-linked wrapper'
  if (/DRILLING|SONDA|PERFURA/.test(text)) return 'Drilling vehicle'
  if (/FPSO|MV ?\d+|TAMANDARE|MERO|SEPIA|MARLIM|BUZIOS|LIBRA|TARTARUGA|OPPORTUNITY/.test(text)) return 'FPSO / production SPV'
  if (/SOFTWARE|LICENCA|DATA|GEOQUEST|AIMMS|PETROTECHNICAL/.test(text)) return 'Software / data vendor'
  if (/TRAINING|TREINAMENTO|CURSO|PUBLICA|CONFERENCE|EVENT/.test(text)) return 'Training / research vendor'
  if (/ENGINEER|ENGENHARIA|CERTIFICA|INSPECAO|ASSURANCE/.test(text)) return 'Engineering / assurance vendor'
  return 'Adjacent vendor'
}

function isSensitiveProcurement(record: ContractRecord) {
  return /INEXIGIBIL|DISPENSA|CONVITE|TQUITACAO|TEP/i.test(`${record.procurement} ${record.legalBasis}`)
}

function aliasRiskFor(aliases: string[]) {
  if (aliases.length === 1) return 'low' as const
  if (aliases.length === 2) return 'medium' as const
  return 'high' as const
}

function scoreEntity(amount: number, count: number, upstream: boolean, aliasRisk: 'low' | 'medium' | 'high', procurementHits: number) {
  const valueScore = Math.min(40, amount >= 1e10 ? 40 : amount >= 5e9 ? 34 : amount >= 1e9 ? 26 : amount >= 2e8 ? 18 : 10)
  const recurrenceScore = Math.min(20, count >= 200 ? 20 : count >= 50 ? 16 : count >= 10 ? 10 : count >= 3 ? 6 : 3)
  const structuralScore = upstream ? 15 : 7
  const aliasScore = aliasRisk === 'high' ? 15 : aliasRisk === 'medium' ? 9 : 3
  const complianceScore = Math.min(10, procurementHits >= 10 ? 10 : procurementHits >= 3 ? 7 : procurementHits >= 1 ? 4 : 1)
  return valueScore + recurrenceScore + structuralScore + aliasScore + complianceScore
}

function categoryColor(category: string) {
  if (category.includes('Hub')) return '#10b981'
  if (category.includes('FPSO')) return '#f59e0b'
  if (category.includes('Drilling')) return '#38bdf8'
  if (category.includes('Field')) return '#ef4444'
  if (category.includes('Software')) return '#a78bfa'
  if (category.includes('Engineering')) return '#f472b6'
  return '#cbd5e1'
}

const brazilSource = { lat: -22.91, lng: -43.17, label: 'Petrobras contracting source / Brazil' }
const netherlandsHub = { lat: 52.37, lng: 4.9, label: 'Netherlands B.V. wrapper layer' }

function destinationForEntity(entity: EntityGroup, index: number) {
  const text = `${entity.canonical} ${entity.records.map(record => record.object).join(' ')}`.toUpperCase()
  if (/BUZIOS|TAMANDARE/.test(text)) return { lat: -22.6, lng: -41.9, label: 'Buzios basin' }
  if (/MERO|LIBRA/.test(text)) return { lat: -24.6, lng: -42.8, label: 'Mero / Libra' }
  if (/MARLIM|RONCADOR|PAPA TERRA|TARTARUGA/.test(text)) return { lat: -22.3, lng: -40.2, label: 'Campos basin' }
  if (/TUPI|GUARA|LAPA|SEPIA|SAPINHO/.test(text)) return { lat: -25.4, lng: -43.1, label: 'Santos basin' }
  if (/DRILLING|SONDA|PERFURA/.test(text)) return { lat: -21.8 + index * 0.18, lng: -39.5 - index * 0.16, label: 'Offshore drilling arc' }
  if (/PETROBRAS GLOBAL TRADING/.test(text)) return { lat: 1.35, lng: 103.82, label: 'Trading / logistics' }
  return { lat: -23.0 + index * 0.12, lng: -43.2 + index * 0.08, label: 'Brazil / adjacent spend' }
}

const flowNodeTypes = {
  mappedNode: ({ data }: NodeProps<GraphNodeData>) => (
    <div className={`flow-card ${data.kind} ${data.status.toLowerCase()}`}>
      <div className="flow-card-top">
        <span>{data.kind === 'hub' ? 'B.V. hub' : data.kind === 'cluster' ? 'Cluster' : 'Contract'}</span>
        {data.kind === 'cluster' && <i>{data.expanded ? '−' : '+'}</i>}
      </div>
      <h4>{data.title}</h4>
      <p>{data.summary}</p>
      <strong className="flow-value">{data.amount ? formatMoney(data.amount) : `${data.count} items`}</strong>
      <div className="flow-tags">
        {data.meta.map(tag => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  ),
}

export default function App() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ViewFilter>('all')
  const [graphMode, setGraphMode] = useState<GraphMode>('structure')
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [expanded, setExpanded] = useState(false)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string>('')
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [leftPanelTab, setLeftPanelTab] = useState<'controls' | 'details'>('controls')
  const [tourStep, setTourStep] = useState<number>(0)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const globeRef = useRef<HTMLDivElement | null>(null)
  const [globeWidth, setGlobeWidth] = useState(520)

  const tourStepsData = useMemo(() => [
    {
      eyebrow: 'Study Tour · Step 1 of 4',
      title: 'The Concentration of Value',
      body: 'The offshore network is highly centralized. Almost all massive contract values — over US$ 121 billion — funnel into a handful of Dutch B.V. entities. While legally sound for tax routing and liability ring-fencing, this architecture creates a structural "Complexity Tax" on public legibility.',
      insight: { label: 'Compliance Observation', text: 'Concentration is not misconduct. But when a large share of a state-owned enterprise\'s offshore value touches just 5–7 foreign legal wrappers, traditional audit tools lose resolution.' },
      setup: () => { setGraphMode('structure'); setLeftPanelTab('controls'); setExpandedClusters(new Set()); if (flowInstance) flowInstance.fitView({ duration: 800 }) }
    },
    {
      eyebrow: 'Study Tour · Step 2 of 4',
      title: "The 'Soft Services' Dimension",
      body: 'When we switch the map to the Services view, a different picture emerges. Alongside capital-intensive physical assets (FPSOs, rigs, subsea systems), we find significant clusters of intangible services — software, training, and consulting — routed through the same offshore B.V. wrappers.',
      insight: { label: 'Why This Matters', text: 'Physical assets are verifiable. A drillship or FPSO is trackable in global shipping databases. An intangible service — like "remote technical support" — is not.' },
      setup: () => { setGraphMode('services'); setExpandedClusters(new Set()); if (flowInstance) flowInstance.fitView({ duration: 800 }) }
    },
    {
      eyebrow: 'Study Tour · Step 3 of 4',
      title: 'The Supplier Opacity',
      body: 'Analyzing the supplier dimension reveals entities like GEOQUEST SYSTEMS B.V. — a Schlumberger software subsidiary — with significant, highly concentrated contracts. Every contract was awarded via Inexigibilidade (Sole Source), invoking the "proprietary technology" exemption to bypass competitive bidding entirely.',
      insight: { label: 'The Statutory Limit', text: 'The sole-source exemption is the correct legal mechanism for monopoly software. But when it is applied to multi-million dollar contracts routed offshore, the standard control (bidding) is eliminated, creating an audit blind spot.' },
      setup: () => { setGraphMode('suppliers'); setExpandedClusters(new Set(['supplier-GEOQUEST SYSTEMS B.V.'])); if (flowInstance) setTimeout(() => flowInstance.fitView({ duration: 800 }), 100) }
    },
    {
      eyebrow: 'Study Tour · Step 4 of 4',
      title: 'The $60M Blind Spot',
      body: 'Contract 4600568576: US$ 60,711,176.66 awarded to GEOQUEST SYSTEMS B.V. for "Technological Update and Remote Technical Support." Procurement route: INEXIGIBILIDADE. No competitive bids. No public price benchmark. The entire $60M rests on the assumption that a proprietary software vendor delivered fair market value.',
      insight: { label: 'The Core Thesis', text: 'This is not an allegation. It is a demonstration of the governance gap. When legal compliance and public legibility diverge — as they do here — data-driven mapping tools become essential for independent oversight.' },
      setup: () => { setGraphMode('suppliers'); setExpandedClusters(new Set(['supplier-GEOQUEST SYSTEMS B.V.'])); setLeftPanelTab('details'); if (flowInstance) setTimeout(() => flowInstance.fitView({ duration: 800 }), 100) }
    }
  ], [flowInstance])

  useEffect(() => {
    if (tourStep > 0 && tourStep <= tourStepsData.length) {
      tourStepsData[tourStep - 1].setup()
    }
  }, [tourStep, tourStepsData])

  useEffect(() => {
    const parsed = parseContracts(contractsCsv)
    setContracts(parsed)
    setSelectedId(parsed[0]?.contractNumber || '')
  }, [])

  useEffect(() => {
    if (!globeRef.current) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setGlobeWidth(Math.max(320, Math.floor(width)))
    })
    observer.observe(globeRef.current)
    return () => observer.disconnect()
  }, [])

  const grouped = useMemo(() => {
    const byYear = new Map<string, ContractRecord[]>()
    const byStatus = new Map<ContractStatus, ContractRecord[]>()
    const bySupplier = new Map<string, ContractRecord[]>()
    const byService = new Map<string, ContractRecord[]>()
    for (const record of contracts) {
      const year = yearFor(record)
      const status = statusFor(record)
      byYear.set(year, [...(byYear.get(year) ?? []), record])
      byStatus.set(status, [...(byStatus.get(status) ?? []), record])
      bySupplier.set(record.supplier, [...(bySupplier.get(record.supplier) ?? []), record])
      const service = serviceFor(record)
      byService.set(service, [...(byService.get(service) ?? []), record])
    }
    return { byYear, byStatus, bySupplier, byService }
  }, [contracts])

  const entityGroups = useMemo<EntityGroup[]>(() => {
    const byCanonical = new Map<string, ContractRecord[]>()
    for (const record of contracts) {
      const canonical = canonicalEntityName(record.supplier)
      byCanonical.set(canonical, [...(byCanonical.get(canonical) ?? []), record])
    }
    return [...byCanonical.entries()].map(([canonical, records]) => {
      const aliases = [...new Set(records.map(item => item.supplier))].sort()
      const amount = records.reduce((sum, item) => sum + parseMoney(item.value), 0)
      const category = categoryForEntity(canonical, records)
      const upstream = isUpstreamEntity(canonical)
      const adjacent = !upstream
      const aliasRisk = aliasRiskFor(aliases)
      const procurementSensitive = records.filter(isSensitiveProcurement).length
      const score = scoreEntity(amount, records.length, upstream, aliasRisk, procurementSensitive)
      const reasons = [
        `${records.length} rows`,
        `${aliases.length} label variant${aliases.length === 1 ? '' : 's'}`,
        category,
        aliasRisk === 'high' ? 'alias review needed' : aliasRisk === 'medium' ? 'alias merge candidate' : 'stable label set',
        `${procurementSensitive} sensitive routes`,
      ]
      return { canonical, category, aliases, records, amount, upstream, adjacent, aliasRisk, procurementSensitive, score, reasons }
    }).sort((a, b) => b.score - a.score || b.amount - a.amount)
  }, [contracts])

  const supplierCount = useMemo(() => new Set(contracts.map(item => item.supplier)).size, [contracts])
  const canonicalCount = useMemo(() => entityGroups.length, [entityGroups])
  const availableYears = useMemo(() => {
    return [...new Set(contracts.map(yearFor).filter(year => /^(19|20)\d{2}$/.test(year)))]
      .sort((a, b) => Number(a) - Number(b))
  }, [contracts])
  const supplierName = 'Petrobras B.V. Contract Network'
  const totalValue = useMemo(() => contracts.reduce((sum, item) => sum + parseMoney(item.value), 0), [contracts])
  const upstreamValue = useMemo(() => entityGroups.filter(group => group.upstream).reduce((sum, group) => sum + group.amount, 0), [entityGroups])
  const adjacentValue = useMemo(() => entityGroups.filter(group => group.adjacent).reduce((sum, group) => sum + group.amount, 0), [entityGroups])
  const topRiskEntities = useMemo(() => entityGroups.slice(0, 8), [entityGroups])
  const topValueEntities = useMemo(() => [...entityGroups].sort((a, b) => b.amount - a.amount).slice(0, 10), [entityGroups])
  const aliasReviewEntities = useMemo(() => entityGroups.filter(group => group.aliasRisk !== 'low' || group.aliases.length > 1), [entityGroups])
  const procurementSensitiveRows = useMemo(() => contracts.filter(isSensitiveProcurement).length, [contracts])
  const topEntityShare = totalValue ? ((topValueEntities[0]?.amount ?? 0) / totalValue) * 100 : 0
  const taxonomy = useMemo(() => {
    const byCategory = new Map<string, EntityGroup[]>()
    for (const group of entityGroups) {
      byCategory.set(group.category, [...(byCategory.get(group.category) ?? []), group])
    }
    return [...byCategory.entries()].map(([category, groups]) => ({
      category,
      count: groups.length,
      amount: groups.reduce((sum, group) => sum + group.amount, 0),
      score: Math.round(groups.reduce((sum, group) => sum + group.score, 0) / groups.length),
    })).sort((a, b) => b.amount - a.amount)
  }, [entityGroups])
  const categoryOptions = useMemo(() => ['all', ...taxonomy.map(item => item.category)], [taxonomy])
  const rankedEntities = useMemo(() => {
    const source = categoryFilter === 'all'
      ? entityGroups
      : entityGroups.filter(group => group.category === categoryFilter)
    return [...source].sort((a, b) => b.amount - a.amount).slice(0, 12)
  }, [categoryFilter, entityGroups])
  const globeEntities = useMemo(() => topValueEntities.slice(0, 18), [topValueEntities])
  const globeArcs = useMemo<GlobeArc[]>(() => {
    const sourceToNetherlands = globeEntities.slice(0, 10).map((entity, index) => ({
      entity: entity.canonical,
      category: entity.category,
      route: 'contracting-source' as const,
      value: entity.amount,
      score: entity.score,
      startLat: brazilSource.lat,
      startLng: brazilSource.lng,
      endLat: netherlandsHub.lat + index * 0.03,
      endLng: netherlandsHub.lng + index * 0.03,
      color: '#10b981',
    }))
    const netherlandsToOffshore = globeEntities.map((entity, index) => {
      const destination = destinationForEntity(entity, index)
      return {
        entity: entity.canonical,
        category: entity.category,
        route: 'offshore-deployment' as const,
        value: entity.amount,
        score: entity.score,
        startLat: netherlandsHub.lat,
        startLng: netherlandsHub.lng,
        endLat: destination.lat,
        endLng: destination.lng,
        color: categoryColor(entity.category),
      }
    })
    return [...sourceToNetherlands, ...netherlandsToOffshore]
  }, [globeEntities])
  const globePoints = useMemo<GlobePoint[]>(() => {
    return [
      { label: brazilSource.label, lat: brazilSource.lat, lng: brazilSource.lng, size: 0.95, color: '#f8fafc' },
      { label: netherlandsHub.label, lat: netherlandsHub.lat, lng: netherlandsHub.lng, size: 0.9, color: '#10b981' },
      ...globeEntities.map((entity, index) => {
        const destination = destinationForEntity(entity, index)
        return {
          label: destination.label,
          lat: destination.lat,
          lng: destination.lng,
          size: Math.max(0.25, Math.min(0.9, entity.amount / Math.max(1, totalValue) * 8)),
          color: categoryColor(entity.category),
        }
      }),
    ]
  }, [globeEntities, totalValue])

  const metrics = [
    { label: 'B.V. contracts', value: String(contracts.length), caption: 'Rows matched in the CSV' },
    { label: 'B.V. suppliers', value: String(supplierCount), caption: 'Distinct supplier labels' },
    { label: 'Canonical entities', value: String(canonicalCount), caption: 'Alias-normalized groups' },
    { label: 'Nominal source value', value: formatMoney(totalValue).replace('Nominal ', ''), caption: 'Mixed currencies; no FX conversion' },
    { label: 'Sensitive routes', value: String(procurementSensitiveRows), caption: 'Direct award, exemption or settlement logic' },
    { label: 'Years covered', value: String(new Set(contracts.map(yearFor)).size), caption: 'Visible in the CSV' },
  ]

  const q = search.trim().toLowerCase()
  const filteredContracts = contracts.filter(record => {
    const status = statusFor(record)
    const year = yearFor(record)
    if (filter === 'supplier') return true
    if (filter === 'active' && status !== 'Ativo') return false
    if (filter === 'completed' && status !== 'Concluído') return false
    if (filter === 'cancelled' && status !== 'Cancelado') return false
    if (filter.startsWith('year-') && year !== filter.slice('year-'.length)) return false
    if (!q) return true
    return [record.supplier, record.contractNumber, record.object, record.legalBasis, record.value, record.status, record.start, record.end]
      .some(value => value.toLowerCase().includes(q))
  })

  const hub: GraphNodeData = {
    kind: 'hub',
    title: supplierName,
    summary: `${contracts.length} matched contract rows across ${supplierCount} distinct B.V. supplier labels.`,
    amount: totalValue,
    count: contracts.length,
    status: 'Ativo',
    meta: ['central hub', 'CSV-driven', expanded ? 'expanded' : 'collapsed'],
  }

  const structureGroups: Array<{ id: string; node: GraphNodeData }> = [
    {
      id: 'status-Ativo',
      node: {
        kind: 'cluster',
        title: 'Ativo',
        summary: `${grouped.byStatus.get('Ativo')?.length || 0} active contracts`,
        amount: grouped.byStatus.get('Ativo')?.reduce((sum, item) => sum + parseMoney(item.value), 0) || 0,
        count: grouped.byStatus.get('Ativo')?.length || 0,
        status: 'Ativo',
        meta: ['status cluster', '2024/2023'],
        expanded: expandedClusters.has('status-Ativo'),
      },
    },
    {
      id: 'status-Concluído',
      node: {
        kind: 'cluster',
        title: 'Concluído',
        summary: `${grouped.byStatus.get('Concluído')?.length || 0} closed contracts`,
        amount: grouped.byStatus.get('Concluído')?.reduce((sum, item) => sum + parseMoney(item.value), 0) || 0,
        count: grouped.byStatus.get('Concluído')?.length || 0,
        status: 'Concluído',
        meta: ['status cluster', 'closed'],
        expanded: expandedClusters.has('status-Concluído'),
      },
    },
    {
      id: 'status-Cancelado',
      node: {
        kind: 'cluster',
        title: 'Cancelado',
        summary: `${grouped.byStatus.get('Cancelado')?.length || 0} cancelled contracts`,
        amount: grouped.byStatus.get('Cancelado')?.reduce((sum, item) => sum + parseMoney(item.value), 0) || 0,
        count: grouped.byStatus.get('Cancelado')?.length || 0,
        status: 'Cancelado',
        meta: ['status cluster', 'archived'],
        expanded: expandedClusters.has('status-Cancelado'),
      },
    },
    ...availableYears.map(year => ({
      id: `year-${year}`,
      node: {
        kind: 'cluster' as const,
        title: year,
        summary: `${grouped.byYear.get(year)?.length || 0} contracts starting in ${year}`,
        amount: grouped.byYear.get(year)?.reduce((sum, item) => sum + parseMoney(item.value), 0) || 0,
        count: grouped.byYear.get(year)?.length || 0,
        status: grouped.byYear.get(year)?.some(item => statusFor(item) === 'Ativo')
          ? 'Ativo' as ContractStatus
          : grouped.byYear.get(year)?.some(item => statusFor(item) === 'Cancelado')
            ? 'Cancelado' as ContractStatus
            : 'Concluído' as ContractStatus,
        meta: ['year cluster'],
        expanded: expandedClusters.has(`year-${year}`),
      },
    })),
  ]

  const statusNodes = structureGroups.slice(0, 3).map((item, index) => ({
    ...item,
    ...radialPosition(index, structureGroups.length),
  }))

  const yearNodes = structureGroups.slice(3).map((item, index) => ({
    ...item,
    ...radialPosition(index + 3, structureGroups.length),
  }))

  const supplierGroups = useMemo(() => {
    const groups = [...grouped.bySupplier.entries()].map(([supplier, records]) => ({
      supplier,
      records,
      amount: records.reduce((sum, item) => sum + parseMoney(item.value), 0),
    }))
    const matching = q
      ? groups.filter(group => group.supplier.toLowerCase().includes(q))
      : groups
    return matching
      .sort((a, b) => b.amount - a.amount || b.records.length - a.records.length)
      .slice(0, 12)
  }, [grouped.bySupplier, q])

  const supplierNodes = supplierGroups.map((group, index) => {
    const id = `supplier-${encodeURIComponent(group.supplier)}`
    return {
      id,
      type: 'mappedNode' as const,
      position: radialPosition(index, supplierGroups.length, 680, 390),
      data: {
        kind: 'cluster' as const,
        title: group.supplier,
        summary: `${group.records.length} contract records`,
        amount: group.amount,
        count: group.records.length,
        status: group.records.some(item => statusFor(item) === 'Ativo') ? 'Ativo' as ContractStatus : 'Concluído' as ContractStatus,
        meta: ['supplier cluster', `${group.records.length} contracts`],
        expanded: expandedClusters.has(id),
      },
    }
  })

  const serviceGroups = useMemo(() => {
    return [...grouped.byService.entries()]
      .map(([service, records]) => ({
        service,
        records,
        amount: records.reduce((sum, item) => sum + parseMoney(item.value), 0),
      }))
      .filter(group => !q || group.service.toLowerCase().includes(q) || group.records.some(record => record.object.toLowerCase().includes(q)))
      .sort((a, b) => b.amount - a.amount || b.records.length - a.records.length)
  }, [grouped.byService, q])

  const serviceNodes = serviceGroups.map((group, index) => {
    const id = `service-${encodeURIComponent(group.service)}`
    return {
      id,
      type: 'mappedNode' as const,
      position: radialPosition(index, serviceGroups.length, 660, 380),
      data: {
        kind: 'cluster' as const,
        title: group.service,
        summary: `${group.records.length} contracts across ${new Set(group.records.map(item => item.supplier)).size} B.V. suppliers`,
        amount: group.amount,
        count: group.records.length,
        status: group.records.some(item => statusFor(item) === 'Ativo') ? 'Ativo' as ContractStatus : 'Concluído' as ContractStatus,
        meta: ['service cluster', `${group.records.length} contracts`],
        expanded: expandedClusters.has(id),
      },
    }
  })

  const clusterPositionById = new Map<string, { x: number; y: number }>([
    ...statusNodes.map(node => [node.id, { x: node.x, y: node.y }] as const),
    ...yearNodes.map(node => [node.id, { x: node.x, y: node.y }] as const),
    ...supplierNodes.map(node => [node.id, node.position] as const),
    ...serviceNodes.map(node => [node.id, node.position] as const),
  ])

  function recordsForCluster(clusterId: string) {
    return filteredContracts.filter(record => {
      if (clusterId.startsWith('supplier-')) {
        return record.supplier === decodeURIComponent(clusterId.slice('supplier-'.length))
      }
      if (clusterId.startsWith('service-')) {
        return serviceFor(record) === decodeURIComponent(clusterId.slice('service-'.length))
      }
      return clusterId === `status-${statusFor(record)}` || clusterId === `year-${yearFor(record)}`
    }).sort((a, b) => parseMoney(b.value) - parseMoney(a.value)).slice(0, 12)
  }

  const contractNodes = [...expandedClusters].flatMap(clusterId => {
    const records = recordsForCluster(clusterId)
    const clusterPosition = clusterPositionById.get(clusterId) ?? graphCenter
    const clusterAngle = Math.atan2(clusterPosition.y - graphCenter.y, clusterPosition.x - graphCenter.x)
    return records.map((record, index) => {
      const status = statusFor(record)
      const year = yearFor(record)
      const itemsPerRing = 6
      const ring = Math.floor(index / itemsPerRing)
      const indexInRing = index % itemsPerRing
      const ringCount = Math.min(itemsPerRing, records.length - ring * itemsPerRing)
      const spread = Math.PI * 0.52
      const contractAngle = clusterAngle - spread / 2 + (indexInRing / Math.max(1, ringCount - 1)) * spread
      const radius = 980 + ring * 330
      const instanceId = `${clusterId}::${record.contractNumber || index}`
      return {
        id: instanceId,
        type: 'mappedNode' as const,
        position: {
          x: graphCenter.x + Math.cos(contractAngle) * radius,
          y: graphCenter.y + Math.sin(contractAngle) * radius,
        },
        data: {
          kind: 'contract' as const,
          title: record.contractNumber || 'Sem número',
          summary: record.object.slice(0, 128),
          amount: parseMoney(record.value),
          count: 1,
          status,
          meta: [record.currency, year, record.status],
          contractNumber: record.contractNumber,
          parentId: clusterId,
        },
      }
    })
  })

  const nodes = useMemo(() => {
    const list: Array<{ id: string; type: 'mappedNode'; position: { x: number; y: number }; data: GraphNodeData }> = [
      {
        id: 'hub',
        type: 'mappedNode',
        position: { x: graphCenter.x - 160, y: graphCenter.y - 90 },
        data: hub,
      },
    ]
    if (graphMode === 'suppliers') {
      list.push(...supplierNodes)
    } else if (graphMode === 'services') {
      list.push(...serviceNodes)
    } else {
      for (const item of statusNodes) {
        list.push({
          id: item.id,
          type: 'mappedNode',
          position: { x: item.x, y: item.y },
          data: item.node,
        })
      }
      for (const item of yearNodes) {
        list.push({
          id: item.id,
          type: 'mappedNode',
          position: { x: item.x, y: item.y },
          data: item.node,
        })
      }
    }
    list.push(...contractNodes)
    return list
  }, [hub, statusNodes, yearNodes, supplierNodes, serviceNodes, contractNodes, graphMode])

  const edges = useMemo(() => {
    const dimensionNodes = graphMode === 'suppliers' ? supplierNodes : serviceNodes
    const list = graphMode !== 'structure'
      ? dimensionNodes.map(node => ({
          id: `e-hub-${node.id}`,
          source: 'hub',
          target: node.id,
          label: '',
          color: '#0c6b4e',
        }))
      : [
          { id: 'e-hub-ativo', source: 'hub', target: 'status-Ativo', label: 'active', color: '#0c6b4e' },
          { id: 'e-hub-concluido', source: 'hub', target: 'status-Concluído', label: 'closed', color: '#a77b26' },
          { id: 'e-hub-cancelado', source: 'hub', target: 'status-Cancelado', label: 'cancelled', color: '#a54d2e' },
          ...yearNodes.map(node => ({
            id: `e-hub-${node.id}`,
            source: 'hub',
            target: node.id,
            label: node.node.title,
            color: '#66716b',
          })),
        ]
    if (contractNodes.length) {
      for (const contract of contractNodes) {
        list.push({
          id: `e-contract-${contract.id}`,
          source: contract.data.parentId || 'hub',
          target: contract.id,
          label: '',
          color: contract.data.status === 'Ativo' ? '#0c6b4e' : contract.data.status === 'Concluído' ? '#a77b26' : '#a54d2e',
        })
      }
    }
    return list.map(edge => ({
      ...edge,
      type: 'smoothstep' as const,
      animated: edge.label !== 'active',
      style: { stroke: edge.color, strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: edge.color },
    }))
  }, [contractNodes, graphMode, supplierNodes, serviceNodes])

  const selected = contracts.find(contract => contract.contractNumber === selectedId) ?? filteredContracts[0]
  const selectedEntity = selected ? entityGroups.find(group => group.aliases.includes(selected.supplier) || group.canonical === canonicalEntityName(selected.supplier)) : undefined
  const legendItems = [
    { label: 'Hub', color: '#0c6b4e', description: 'Central B.V. supplier node' },
    { label: graphMode === 'suppliers' ? 'Supplier cluster' : graphMode === 'services' ? 'Service cluster' : 'Status cluster', color: '#a77b26', description: graphMode === 'suppliers' ? 'Groups records by B.V. supplier' : graphMode === 'services' ? 'Groups contracts by inferred service purpose' : 'Groups contracts by lifecycle status' },
    { label: 'Year cluster', color: '#66716b', description: 'Groups contracts by start year' },
    { label: 'Contract', color: '#a54d2e', description: 'Individual CSV record' },
  ]

  function toggleCluster(id: string) {
    setExpandedClusters(current => {
      const next = new Set(current)
      if (current.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      setExpanded(next.size > 0)
      return next
    })
  }

  function changeGraphMode(mode: GraphMode) {
    setGraphMode(mode)
    setFilter('all')
    setExpanded(false)
    setExpandedClusters(new Set())
    setSelectedId('')
  }

  const filteredNodes = useMemo(() => {
    const visibleIds = new Set(nodes.map(node => node.id))
    return nodes.filter(node => {
      if (filter === 'supplier') return node.id === 'hub' || node.id.startsWith('status-') || node.id.startsWith('year-') || expanded
      if (filter !== 'all') {
        if (filter === 'active' || filter === 'completed' || filter === 'cancelled') {
          return node.data.status.toLowerCase() === filter || node.id === 'hub' || node.id.startsWith('status-')
        }
        if (filter.startsWith('year-')) return node.id === 'hub' || node.id === filter || node.id.startsWith('status-') || node.id.startsWith('year-')
      }
      if (!q) return true
      return visibleIds.has(node.id)
    })
  }, [nodes, filter, expanded, q])

  const filteredEdges = useMemo(() => edges.filter(edge => filteredNodes.some(node => node.id === edge.source) && filteredNodes.some(node => node.id === edge.target)), [edges, filteredNodes])
  const clusterTitleById = new Map<string, string>(nodes.filter(node => node.data.kind === 'cluster').map(node => [node.id, node.data.title]))

  useEffect(() => {
    if (!flowInstance) return
    const frame = window.requestAnimationFrame(() => {
      flowInstance.fitView({ padding: 0.06, minZoom: 0.2, maxZoom: 1.05, duration: 500 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [expandedClusters, flowInstance, graphMode, filteredNodes.length])

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-inner">
          <div className="eyebrow">Petrobras offshore B.V. study case</div>
          <h1>Petrobras B.V. money-flow governance dashboard.</h1>
          <p className="lead">
            A correlation surface for understanding why so many Dutch B.V.s appear in the Petrobras upstream chain, where the value concentrates, and which aliases need resolution.
          </p>
          <div style={{ display:'flex', gap:'12px', marginTop:'24px' }}>
              <a href="#graph" className="button primary-action">
                Open the map <ArrowRight size={18} />
              </a>
              <button className="button outline" onClick={() => {
                document.getElementById('graph')?.scrollIntoView({ behavior: 'smooth' })
                setTimeout(() => setTourStep(1), 500)
              }}>
                <Compass size={18} /> Take Guided Tour
              </button>
            </div>
        </div>
        <div className="hero-aside">
          <div className="hero-aside-card">
            <span>Core thesis</span>
            <strong>The map is precise, but the insight lives in correlation.</strong>
            <p>Each B.V. is treated as a node in a money-flow system with category, score, aliases, procurement sensitivity, and evidence trail.</p>
          </div>
        </div>
      </header>

      <main>
        <section className="metrics">
          {metrics.map(metric => (
            <article key={metric.label} className="metric-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.caption}</p>
            </article>
          ))}
        </section>

        <section className="governance-cockpit" id="dashboard">
          <article className="cockpit-lead">
            <div className="eyebrow">Governance convergence</div>
            <h2>The B.V. count is not noise. It is the operating architecture.</h2>
            <p>
              The dashboard now treats the network as a compliance management problem: normalize the names, classify the economic role, rank the flow concentration, and preserve enough evidence to defend every resolution decision.
            </p>
            <div className="lead-findings">
              <div><span>Top concentration</span><strong>{topValueEntities[0]?.canonical ?? 'n/a'}</strong><small>{topEntityShare.toFixed(1)}% of nominal B.V. value</small></div>
              <div><span>Alias review</span><strong>{aliasReviewEntities.length}</strong><small>canonical groups requiring merge attention</small></div>
              <div><span>ISO 37301 lens</span><strong>Traceable CMS</strong><small>resolution, monitoring, escalation, improvement</small></div>
            </div>
          </article>

          <article className="cockpit-panel">
            <div className="panel-title">
              <span>Entity taxonomy</span>
              <strong>What kind of B.V. is receiving value?</strong>
            </div>
            <div className="taxonomy-grid">
              {taxonomy.slice(0, 6).map(item => (
                <div key={item.category} className="taxonomy-item">
                  <span>{item.category}</span>
                  <strong>{formatMoney(item.amount)}</strong>
                  <p>{item.count} entities · avg score {item.score}/100</p>
                </div>
              ))}
            </div>
          </article>

          <article className="cockpit-panel flow-table-panel">
            <div className="panel-title">
              <span>Money-flow ranking</span>
              <strong>{categoryFilter === 'all' ? 'Highest-value canonical B.V. groups' : categoryFilter}</strong>
            </div>
            <div className="category-tabs" aria-label="Filter money-flow ranking by entity category">
              {categoryOptions.map(category => (
                <button
                  key={category}
                  type="button"
                  className={categoryFilter === category ? 'active' : ''}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category === 'all' ? 'All categories' : category}
                </button>
              ))}
            </div>
            <div className="entity-table">
              <div className="entity-table-head">
                <span>Entity</span>
                <span>Category</span>
                <span>Rows</span>
                <span>Score</span>
                <span>Value</span>
              </div>
              {rankedEntities.map(entity => (
                <button key={entity.canonical} type="button" className="entity-table-row" onClick={() => {
                  const pick = entity.records[0]
                  if (pick) {
                    setSelectedId(pick.contractNumber || pick.supplier)
                    setLeftPanelTab('details')
                    setControlsOpen(true)
                    document.getElementById('graph')?.scrollIntoView({ behavior: 'smooth' })
                  }
                }}>
                  <strong>{entity.canonical}</strong>
                  <span>{entity.category}</span>
                  <span>{entity.records.length}</span>
                  <span>{entity.score}/100</span>
                  <span>{formatMoney(entity.amount)}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="cockpit-panel">
            <div className="panel-title">
              <span>Control interpretation</span>
              <strong>How to understand “this many B.V.s”</strong>
            </div>
            <div className="control-interpretation">
              <div>
                <strong>Structure</strong>
                <p>Large upstream assets naturally create SPVs, but each wrapper reduces public legibility unless the economic role is normalized.</p>
              </div>
              <div>
                <strong>Signal</strong>
                <p>Concentration, recurrence, alias variation, and sensitive procurement routes are the four strongest review signals.</p>
              </div>
              <div>
                <strong>Resolution</strong>
                <p>ISO 37301 discipline means every merge, classification, and escalation must remain traceable to source rows.</p>
              </div>
            </div>
          </article>

          <article className="cockpit-panel globe-panel">
            <div className="panel-title">
              <span>Globe routing</span>
              <strong>Brazil source to Dutch wrapper to offshore value field</strong>
            </div>
            <div ref={globeRef} className="globe-shell">
              <Globe
                width={globeWidth}
                height={430}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                arcsData={globeArcs}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor={(arc: object) => {
                  const flow = arc as GlobeArc
                  return flow.route === 'contracting-source' ? ['#f8fafc', '#10b981'] : [flow.color, `${flow.color}66`]
                }}
                arcAltitude={(arc: object) => {
                  const flow = arc as GlobeArc
                  return flow.route === 'contracting-source' ? 0.42 : Math.min(0.55, 0.18 + flow.score / 240)
                }}
                arcStroke={(arc: object) => Math.max(0.35, Math.min(1.8, (arc as GlobeArc).value / Math.max(1, totalValue) * 14))}
                arcDashLength={0.45}
                arcDashGap={1.2}
                arcDashAnimateTime={3200}
                pointsData={globePoints}
                pointLat="lat"
                pointLng="lng"
                pointAltitude={0.015}
                pointRadius="size"
                pointColor="color"
                pointLabel="label"
                arcsTransitionDuration={700}
              />
            </div>
            <div className="flow-route-note">
              <strong>Route model</strong>
              <span>{'Brazil contracting source -> Netherlands B.V. wrapper -> inferred offshore basin, field, asset, or adjacent spend destination.'}</span>
            </div>
            <div className="globe-legend">
              <span><i style={{ background: '#f8fafc' }} />Brazil contracting source</span>
              <span><i style={{ background: '#10b981' }} />Dutch wrapper route</span>
              {['Hub / trading wrapper', 'FPSO / production SPV', 'Drilling vehicle', 'Field-linked wrapper', 'Software / data vendor'].map(category => (
                <span key={category}><i style={{ background: categoryColor(category) }} />{category}</span>
              ))}
            </div>
          </article>
        </section>

        <section className="thesis-grid">
          <article className="thesis-card">
            <h3>1. The Complexity Tax</h3>
            <p>
              When operations are routed through dense offshore networks, it levies a structural "complexity tax" on public legibility. 
              The system is legally sound, but practically impossible for independent stakeholders to audit effectively without relational mapping tools.
            </p>
          </article>
          <article className="thesis-card">
            <h3>2. Limits of Compliance</h3>
            <p>
              A contract can be fully compliant while carrying high risk. High-value, intangible services (like software) awarded via sole-source exemptions to foreign entities bypass traditional bidding controls, shifting the burden of proof to utilization logs.
            </p>
          </article>
          <article className="thesis-card">
            <h3>3. Data-Driven Legibility</h3>
            <p>
              Offshore structures are necessary, but the data must be legible. This mapping tool demonstrates that complex corporate structures and massive contract volumes can be visually untangled, enabling true operational intelligence.
            </p>
          </article>
        </section>

        <section className="section" id="graph">
          <div className="section-head">
            <div>
              <div className="eyebrow">Interactive graph</div>
              <h2>React Flow map of the B.V. structure</h2>
            </div>
          </div>
          <div className="legend">
            {legendItems.map(item => (
              <div key={item.label} className="legend-item">
                <span style={{ background: item.color }} />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="compliance-ribbon">
            <div className="ribbon-copy">
              <span>Money-flow lens</span>
              <strong>{topRiskEntities[0]?.canonical ?? 'Entity correlation'} leads the current score stack</strong>
              <p>
                Canonical grouping collapses aliases, separates upstream from adjacent spend, and ranks entities by value concentration, recurrence, structure, alias risk, and procurement sensitivity.
              </p>
            </div>
            <div className="ribbon-metrics">
              <div><span>Upstream</span><strong>{formatMoney(upstreamValue)}</strong></div>
              <div><span>Adjacent</span><strong>{formatMoney(adjacentValue)}</strong></div>
              <div><span>Top score</span><strong>{topRiskEntities[0]?.score ?? 0}/100</strong></div>
              <div><span>Alias delta</span><strong>{supplierCount - canonicalCount}</strong></div>
            </div>
          </div>
          <div className="graph-summary">
            <strong>{supplierName}</strong>
            <span>
              {graphMode === 'suppliers'
                ? `${supplierGroups.length} supplier nodes shown · ${filteredContracts.length} matching contracts`
                : graphMode === 'services'
                  ? `${serviceGroups.length} service categories · inferred from contract descriptions`
                : `${availableYears[0] ?? 'n/a'}–${availableYears.at(-1) ?? 'n/a'} · ${availableYears.length} years · ${filteredContracts.length} matching rows`}
            </span>
          </div>
          <div className={`graph-workspace ${controlsOpen ? '' : 'controls-collapsed'}`}>
            <aside className={`graph-controls ${controlsOpen ? 'open' : 'closed'}`}>
              <button className="controls-toggle" type="button" onClick={() => setControlsOpen(value => !value)} aria-label={controlsOpen ? 'Hide graph controls' : 'Show graph controls'}>
                {controlsOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
              {controlsOpen && (
                <div className="controls-content">
                  <div className="controls-heading">
                    <div className="panel-tabs">
                      <button className={leftPanelTab === 'controls' ? 'active' : ''} onClick={() => setLeftPanelTab('controls')}>Controls</button>
                      <button className={leftPanelTab === 'details' ? 'active' : ''} onClick={() => setLeftPanelTab('details')}>Details {selectedId && <span className="tab-indicator" />}</button>
                    </div>
                    <button type="button" onClick={() => setControlsOpen(false)}><X size={15} /></button>
                  </div>
                  
                  {leftPanelTab === 'controls' ? (
                    <div className="panel-tab-content">
                      <div className="control-group">
                    <label>Dimension</label>
                    <div className="control-stack">
                      <button className={graphMode === 'structure' ? 'active' : ''} onClick={() => changeGraphMode('structure')}>Status + years</button>
                      <button className={graphMode === 'suppliers' ? 'active' : ''} onClick={() => changeGraphMode('suppliers')}>B.V. suppliers</button>
                      <button className={graphMode === 'services' ? 'active' : ''} onClick={() => changeGraphMode('services')}>Services + purpose</button>
                    </div>
                  </div>
                  <div className="control-group">
                    <label>Search</label>
                    <div className="control-search">
                      <Search size={15} />
                      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Contract, supplier, service..." />
                    </div>
                  </div>
                  <div className="control-group">
                    <label>Filter</label>
                    <div className="control-pills">
                      {filters.map(item => (
                        <button key={item.key} className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>
                      ))}
                    </div>
                    <select value={filter.startsWith('year-') ? filter : ''} onChange={event => setFilter((event.target.value || 'all') as ViewFilter)}>
                      <option value="">All years</option>
                      {availableYears.map(year => <option key={year} value={`year-${year}`}>{year}</option>)}
                    </select>
                  </div>
                  <div className="control-group">
                    <label>Open branches ({expandedClusters.size})</label>
                    <div className="open-branches">
                      {[...expandedClusters].map(id => (
                        <button key={id} type="button" onClick={() => toggleCluster(id)}>
                          <span>{clusterTitleById.get(id) ?? id}</span>
                          <X size={13} />
                        </button>
                      ))}
                      {!expandedClusters.size && <p>Click any cluster card to add a branch.</p>}
                    </div>
                  </div>
                      <div className="control-actions">
                        <button type="button" onClick={() => flowInstance?.fitView({ padding: 0.06, duration: 500 })}>Fit map</button>
                        <button type="button" onClick={() => { setExpanded(false); setExpandedClusters(new Set()) }}>Close all</button>
                      </div>
                    </div>
                  ) : (
                    <div className="panel-tab-content details-tab">
                      {selected ? (
                        <>
                          <div className={`badge ${selected.status === 'Ativo' ? 'confirmed' : selected.status === 'Concluído' ? 'partial' : 'unresolved'}`}>
                            {selected.status}
                          </div>
                          <h3>{selected.contractNumber || 'No ID'}</h3>
                          <p className="node-summary">{selected.supplier}</p>
                          <p className="node-detail">{selected.object}</p>
                          <div className="chip-row">
                            {[selected.currency, selected.start, selected.end].filter(Boolean).map(tag => (
                              <span key={tag} className="chip">{tag}</span>
                            ))}
                          </div>
                          <div className="detail-list">
                            <div className="detail-item"><span>Service</span><strong>{serviceFor(selected)}</strong></div>
                            <div className="detail-item"><span>Value</span><strong>{selected.value}</strong></div>
                            <div className="detail-item"><span>Procurement route</span><strong>{selected.procurement}</strong></div>
                            <div className="detail-item"><span>Why / legal basis</span><strong>{selected.legalBasis}</strong></div>
                          </div>
                          {selectedEntity && (
                            <div className="entity-card">
                              <div className="entity-card-head">
                                <div>
                                  <span>Canonical entity</span>
                                  <strong>{selectedEntity.canonical}</strong>
                                </div>
                                <div className={`risk-pill ${selectedEntity.aliasRisk}`}>
                                  Risk {selectedEntity.score}/100
                                </div>
                              </div>
                              <div className="entity-stats">
                                <div><span>Total value</span><strong>{formatMoney(selectedEntity.amount)}</strong></div>
                                <div><span>Rows</span><strong>{selectedEntity.records.length}</strong></div>
                                <div><span>Aliases</span><strong>{selectedEntity.aliases.length}</strong></div>
                                <div><span>Type</span><strong>{selectedEntity.upstream ? 'Upstream' : 'Adjacent'}</strong></div>
                              </div>
                              <div className="entity-reasons">
                                {selectedEntity.reasons.map(reason => <span key={reason}>{reason}</span>)}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="empty-state">
                          <p>Click on any contract node to view details here.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </aside>
            <div className="graph-shell">
              <ReactFlowProvider>
                <ReactFlow
                nodes={filteredNodes}
                edges={filteredEdges}
                nodeTypes={flowNodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag
                zoomOnScroll
                minZoom={0.24}
                maxZoom={1.35}
                fitView
                fitViewOptions={{ padding: 0.08, minZoom: 0.28, maxZoom: 1.1 }}
                proOptions={{ hideAttribution: true }}
                onInit={setFlowInstance}
                onNodeClick={(_, node) => {
                  setSelectedId(node.data.contractNumber || node.id)
                  if (node.id === 'hub') {
                    setFilter('all')
                    setExpanded(false)
                    setExpandedClusters(new Set())
                    return
                  }
                  if (node.id.startsWith('status-')) {
                    setFilter('all')
                    toggleCluster(node.id)
                    return
                  }
                  if (node.id.startsWith('year-')) {
                    setFilter('all')
                    toggleCluster(node.id)
                    return
                  }
                  if (node.id.startsWith('supplier-')) {
                    setFilter('all')
                    toggleCluster(node.id)
                    return
                  }
                  if (node.id.startsWith('service-')) {
                    setFilter('all')
                    toggleCluster(node.id)
                    return
                  }
                  setFilter('supplier')
                  setLeftPanelTab('details')
                  setControlsOpen(true)
                }}
                >
                  <Background gap={20} size={1} color="#d8d5ca" />
                  <MiniMap pannable zoomable nodeColor={n => {
                  if (n.data.kind === 'hub') return '#0c6b4e'
                  if (n.data.kind === 'cluster' && n.data.status === 'Ativo') return '#0c6b4e'
                  if (n.data.kind === 'cluster' && n.data.status === 'Concluído') return '#a77b26'
                  if (n.data.kind === 'cluster') return '#a54d2e'
                  return n.data.status === 'Ativo' ? '#0c6b4e' : n.data.status === 'Concluído' ? '#a77b26' : '#a54d2e'
                  }} />
                  <Controls />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </div>
        </section>

        <section className="section split">
          <article className="panel">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">Timeline</div>
                <h2>How the structure evolved</h2>
              </div>
              <Landmark size={18} />
            </div>
            <div className="timeline">
              {studyTimeline.map(item => (
                <div key={item.year + item.title} className="timeline-item">
                  <span>{item.year}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="section split">
          <article className="panel">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">Correlation</div>
                <h2>Money flow concentration</h2>
              </div>
              <CircleDollarSign size={18} />
            </div>
            <div className="flow-summary">
              <div className="flow-summary-item"><span>Upstream value</span><strong>{formatMoney(upstreamValue)}</strong></div>
              <div className="flow-summary-item"><span>Adjacent value</span><strong>{formatMoney(adjacentValue)}</strong></div>
              <div className="flow-summary-item"><span>Canonical entities</span><strong>{canonicalCount}</strong></div>
              <div className="flow-summary-item"><span>Alias variants</span><strong>{supplierCount - canonicalCount}</strong></div>
            </div>
            <div className="risk-list">
              {topRiskEntities.map(entity => (
                <button key={entity.canonical} type="button" className="risk-row" onClick={() => {
                  const pick = entity.records[0]
                  if (pick) {
                    setSelectedId(pick.contractNumber || pick.supplier)
                    setLeftPanelTab('details')
                    setControlsOpen(true)
                  }
                }}>
                  <div>
                    <strong>{entity.canonical}</strong>
                    <p>{entity.aliases.join(' · ')}</p>
                  </div>
                  <div className="risk-row-meta">
                    <span>{entity.score}/100</span>
                    <small>{formatMoney(entity.amount)}</small>
                  </div>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">Resolution</div>
                <h2>Compliance decision tree</h2>
              </div>
              <Landmark size={18} />
            </div>
            <ol className="decision-tree">
              <li><strong>Normalize</strong><span>Trim punctuation, casing, and suffix noise like `- PNBV`.</span></li>
              <li><strong>Group</strong><span>Merge only when the economic entity, project, and wrapper are consistent.</span></li>
              <li><strong>Score</strong><span>Rank by value concentration, recurrence, structure, alias risk, and procurement sensitivity.</span></li>
              <li><strong>Escalate</strong><span>Keep ambiguous aliases unresolved until evidence changes the interpretation.</span></li>
            </ol>
          </article>
        </section>

        <section className="section split">
          <article className="panel">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">Method</div>
                <h2>Why this is a study case, not a claim</h2>
              </div>
              <FileSearch size={18} />
            </div>
            <ul className="bullets">
              <li>We split the dataset into hubs, status clusters, year clusters, and contract-level nodes.</li>
              <li>Cluster expansion is interactive, so the graph remains visually readable.</li>
              <li>Search and filtering actively update both the node clusters and their connecting edges.</li>
              <li>Contract values serve as structural study anchors, not proof of individual cash transfers.</li>
            </ul>
          </article>

          <article className="panel">
            <div className="section-head compact">
              <div>
                <div className="eyebrow">Sources</div>
                <h2>Primary references</h2>
              </div>
              <CircleDollarSign size={18} />
            </div>
            <div className="source-list">
              {sourceLinks.map(source => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  <span>{source.label}</span>
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </article>
        </section>
      </main>

      {tourStep > 0 && (() => {
        const step = tourStepsData[tourStep - 1]
        return (
          <div className="tour-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setTourStep(0) }}>
            <div className="tour-modal">
              <div className="tour-modal-header">
                <div style={{ flex: 1 }}>
                  <div className="tour-modal-eyebrow">
                    <Compass size={14} />
                    {step.eyebrow}
                  </div>
                  <h2 className="tour-modal-title">{step.title}</h2>
                </div>
                <button className="tour-modal-close" onClick={() => setTourStep(0)}>
                  <X size={20} />
                </button>
              </div>
              <div className="tour-modal-body">
                <p>{step.body}</p>
                <div className="tour-modal-insight">
                  <strong>{step.insight.label}</strong>
                  {step.insight.text}
                </div>
              </div>
              <div className="tour-modal-footer">
                <div className="tour-progress">
                  {tourStepsData.map((_, i) => (
                    <div
                      key={i}
                      className={`tour-progress-dot${i === tourStep - 1 ? ' active' : ''}`}
                      onClick={() => setTourStep(i + 1)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </div>
                <div className="tour-footer-actions">
                  <button
                    className="tour-btn"
                    disabled={tourStep === 1}
                    onClick={() => setTourStep(s => s - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="tour-btn primary"
                    onClick={() => tourStep === tourStepsData.length ? setTourStep(0) : setTourStep(s => s + 1)}
                  >
                    {tourStep === tourStepsData.length ? 'Finish Tour' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
