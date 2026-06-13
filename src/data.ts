export type EvidenceStatus = 'confirmed' | 'partial' | 'unresolved'
export type NodeKind = 'hub' | 'project' | 'field' | 'supplier'

export interface StudyNode {
  id: string
  label: string
  kind: NodeKind
  status: EvidenceStatus
  summary: string
  detail: string
  value?: string
  tags: string[]
}

export interface StudyEdge {
  id: string
  source: string
  target: string
  label: string
  confidence: EvidenceStatus
}

export interface TimelineItem {
  year: string
  title: string
  detail: string
}

export const studyMetrics = [
  { label: 'Curated study value', value: 'US$171.16B', caption: '38 entities / 2,776 source records' },
  { label: 'Expanded B.V. scan', value: '3,238', caption: 'Deduplicated contract records' },
  { label: 'Distinct labels', value: '76', caption: '73 after punctuation normalization' },
  { label: 'Confirmed mappings', value: '7', caption: 'Major FPSO / subsidiary links confirmed' },
]

export const studyNodes: StudyNode[] = [
  {
    id: 'pnbv',
    label: 'Petrobras Netherlands B.V.',
    kind: 'hub',
    status: 'confirmed',
    summary: 'Central group hub in the Netherlands.',
    detail: 'Petrobras identifies PNBV as one of its Netherlands offices and an indirect subsidiary used across offshore asset, equipment and trading structures.',
    value: 'US$38.55B',
    tags: ['Petrobras group', 'hub', 'confirmed'],
  },
  {
    id: 'tamandare',
    label: 'Tamandare B.V.',
    kind: 'project',
    status: 'confirmed',
    summary: 'FPSO Almirante Tamandare / Buzios.',
    detail: 'Ownership disclosed by SBM Offshore as a project SPV with Mitsubishi and NYK participation.',
    value: 'US$12.81B',
    tags: ['FPSO', 'confirmed', 'Buzios'],
  },
  {
    id: 'mero2',
    label: 'Mero 2 B.V.',
    kind: 'project',
    status: 'confirmed',
    summary: 'FPSO Sepetiba / Mero.',
    detail: 'SBM Offshore-led project company for FPSO Sepetiba with multiple industrial partners.',
    value: 'US$10.75B',
    tags: ['FPSO', 'confirmed', 'Mero'],
  },
  {
    id: 'libra',
    label: 'Libra MV31 B.V.',
    kind: 'project',
    status: 'confirmed',
    summary: 'FPSO Guanabara MV31 / Mero.',
    detail: 'MODEC-led Dutch project company with disclosed partner shareholding.',
    value: 'US$10.24B',
    tags: ['FPSO', 'confirmed', 'Mero'],
  },
  {
    id: 'buzios5',
    label: 'Buzios5 MV32 B.V.',
    kind: 'project',
    status: 'confirmed',
    summary: 'FPSO Almirante Barroso MV32 / Buzios.',
    detail: 'MODEC project vehicle for the fifth FPSO deployed in Buzios.',
    value: 'US$11.71B',
    tags: ['FPSO', 'confirmed', 'Buzios'],
  },
  {
    id: 'sepia',
    label: 'Sepia MV30 B.V.',
    kind: 'project',
    status: 'partial',
    summary: 'FPSO Carioca MV30 / Sepia.',
    detail: 'Project and asset relationship confirmed, while the complete current shareholder table remains pending in the public review.',
    value: 'US$11.61B',
    tags: ['FPSO', 'partial', 'Sepia'],
  },
  {
    id: 'marlim1',
    label: 'Marlim1 MV33 B.V.',
    kind: 'project',
    status: 'confirmed',
    summary: 'FPSO Anita Garibaldi MV33 / Marlim.',
    detail: 'MODEC, Mitsui, MOL and Marubeni partner structure for the Marlim project.',
    value: 'US$8.31B',
    tags: ['FPSO', 'confirmed', 'Marlim'],
  },
  {
    id: 'yinson',
    label: 'Yinson Boronia Production B.V.',
    kind: 'project',
    status: 'confirmed',
    summary: 'FPSO Anna Nery / Marlim.',
    detail: 'Asset-owning and finance-issuing SPV with disclosed project investors.',
    value: 'US$9.96B',
    tags: ['FPSO', 'finance', 'confirmed'],
  },
  {
    id: 'roncador',
    label: 'Roncador B.V.',
    kind: 'field',
    status: 'partial',
    summary: 'Field-related contracting vehicle.',
    detail: 'The field partnership is confirmed, but the Dutch entity’s complete ownership chain is not established in public sources.',
    value: 'US$9.98B',
    tags: ['field', 'partial', 'Roncador'],
  },
  {
    id: 'tupi',
    label: 'Tupi B.V.',
    kind: 'field',
    status: 'unresolved',
    summary: 'Tupi / Lula field-related vehicle.',
    detail: 'The contract record points to a field relationship, but the Dutch ownership chain is unresolved.',
    value: 'US$12.51B',
    tags: ['field', 'unresolved', 'Tupi'],
  },
]

export const studyEdges: StudyEdge[] = [
  { id: 'e1', source: 'pnbv', target: 'tamandare', label: 'group / charter chain', confidence: 'confirmed' },
  { id: 'e2', source: 'pnbv', target: 'mero2', label: 'group / charter chain', confidence: 'confirmed' },
  { id: 'e3', source: 'pnbv', target: 'libra', label: 'group / charter chain', confidence: 'confirmed' },
  { id: 'e4', source: 'pnbv', target: 'buzios5', label: 'group / charter chain', confidence: 'confirmed' },
  { id: 'e5', source: 'pnbv', target: 'sepia', label: 'group / charter chain', confidence: 'partial' },
  { id: 'e6', source: 'pnbv', target: 'marlim1', label: 'group / charter chain', confidence: 'confirmed' },
  { id: 'e7', source: 'pnbv', target: 'yinson', label: 'finance issuer / project chain', confidence: 'confirmed' },
  { id: 'e8', source: 'pnbv', target: 'roncador', label: 'field related', confidence: 'partial' },
  { id: 'e9', source: 'pnbv', target: 'tupi', label: 'field related', confidence: 'unresolved' },
]

export const studyTimeline: TimelineItem[] = [
  { year: '2017', title: 'Sepia and Libra charters signed', detail: 'Carioca MV30 and Guanabara MV31 enter long-duration contract cycles.' },
  { year: '2019', title: 'Buzios, Mero and Marlim projects progress', detail: 'Buzios5 MV32, Mero 2 and Marlim1 MV33 become material project vehicles.' },
  { year: '2021', title: 'Carioca MV30 first oil', detail: 'Sepia MV30 enters operation under a 21-year charter.' },
  { year: '2022', title: 'Guanabara MV31 and Sepetiba milestones', detail: 'Mero pilot and Mero 2 structures move into operation or financing phases.' },
  { year: '2023', title: 'Barroso and Anna Nery first oil', detail: 'Buzios 5 and Yinson’s Anna Nery project become operational.' },
  { year: '2024', title: 'Sepetiba on hire', detail: 'Mero 2 reaches final acceptance and ownership interests evolve.' },
  { year: '2025', title: 'Almirante Tamandare on hire', detail: 'The Buzios charter formally enters full operation.' },
]

export const sourceLinks = [
  { label: 'Petrobras Netherlands offices', url: 'https://petrobras.com.br/en/quem-somos/nossos-escritorios' },
  { label: 'SBM Offshore: Sepetiba', url: 'https://www.sbmoffshore.com/newsroom/fpso-sepetiba-producing-and-hire/' },
  { label: 'SBM Offshore: Tamandare', url: 'https://www.sbmoffshore.com/newsroom/fpso-almirante-tamandare-producing-and-on-hire/' },
  { label: 'MODEC: Libra MV31', url: 'https://www.modec.com/news/2018/20180511.html' },
  { label: 'MODEC: Buzios5 MV32', url: 'https://www.modec.com/news/2019/20191112.html' },
  { label: 'MODEC: Marlim1 MV33', url: 'https://www.modec.com/news/2020/20200130_pr_marlim1.html' },
  { label: 'Yinson: Anna Nery financing', url: 'https://www.yinson.com/news/yinson-production-successfully-placed-usd-1-035-billion-senior-secured-notes-to-refinance-fpso-anna-nery/' },
  { label: 'Equinor: Roncador acquisition', url: 'https://www.equinor.com/news/archive/15jun2018-completes-acquisition-roncador' },
]
