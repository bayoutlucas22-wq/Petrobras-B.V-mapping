import { useEffect, useMemo, useState } from 'react'
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
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, FileSearch, Landmark, Search, CircleDollarSign, X } from 'lucide-react'
import { sourceLinks, studyTimeline } from './data'
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

  useEffect(() => {
    fetch('/Consulta%20(15).csv')
      .then(response => response.text())
      .then(text => {
        const parsed = parseContracts(text)
        setContracts(parsed)
        setSelectedId(parsed[0]?.contractNumber || '')
      })
      .catch(() => setContracts([]))
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

  const supplierCount = useMemo(() => new Set(contracts.map(item => item.supplier)).size, [contracts])
  const availableYears = useMemo(() => {
    return [...new Set(contracts.map(yearFor).filter(year => /^(19|20)\d{2}$/.test(year)))]
      .sort((a, b) => Number(a) - Number(b))
  }, [contracts])
  const supplierName = 'Petrobras B.V. Contract Network'
  const totalValue = useMemo(() => contracts.reduce((sum, item) => sum + parseMoney(item.value), 0), [contracts])

  const metrics = [
    { label: 'B.V. contracts', value: String(contracts.length), caption: 'Rows matched in the CSV' },
    { label: 'B.V. suppliers', value: String(supplierCount), caption: 'Distinct supplier labels' },
    { label: 'Nominal source value', value: formatMoney(totalValue).replace('Nominal ', ''), caption: 'Mixed currencies; no FX conversion' },
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

  function toggleAllContracts() {
    if (expanded) {
      setExpanded(false)
      setExpandedClusters(new Set())
      return
    }
    const defaultCluster = graphMode === 'suppliers'
      ? supplierNodes[0]?.id
      : graphMode === 'services'
        ? serviceNodes[0]?.id
        : 'status-Ativo'
    if (!defaultCluster) return
    setExpanded(true)
    setExpandedClusters(new Set([defaultCluster]))
    setFilter(graphMode === 'suppliers' ? 'all' : 'active')
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
          <h1>A reactive case study map for Dutch B.V. structures in the Petrobras chain.</h1>
          <p className="lead">
            This version is data-driven: search, filter, expand clusters, and inspect contract records without flattening the structure into a static poster.
          </p>
          <div className="hero-actions">
            <a href="#graph" className="primary-action">Open the map <ArrowRight size={16} /></a>
            <button className="secondary-action" type="button" onClick={toggleAllContracts}>
              {expanded ? 'Collapse contracts' : 'Expand contracts'}
            </button>
          </div>
        </div>
        <div className="hero-aside">
          <div className="hero-aside-card">
            <span>Core thesis</span>
            <strong>The corporate layer is real, but it is not one thing.</strong>
            <p>It contains a hub, status clusters, year clusters, and many contract-level records.</p>
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
    </div>
  )
}
