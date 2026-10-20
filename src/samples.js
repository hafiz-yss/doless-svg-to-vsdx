export const SVG_SAMPLES = {
  architecture: {
    title: 'Cloud Architecture Flowchart',
    filename: 'cloud-architecture.vsdx',
    description: 'Nested <g> service groups, rounded rects, dashed lines, 1D arrow connectors, and labels.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 540" width="920" height="540">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/>
    </marker>
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"/>
    </marker>
    <linearGradient id="gatewayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>

  <!-- Background Frame -->
  <rect id="Canvas-Bg" x="16" y="16" width="888" height="508" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <text id="Diagram-Title" x="44" y="54" font-family="Segoe UI" font-size="20" font-weight="bold" fill="#0f172a">Event-Driven Cloud Architecture (SVG → Visio .vsdx)</text>
  <text id="Diagram-Subtitle" x="44" y="76" font-family="Segoe UI" font-size="12" fill="#64748b">Every group, rounded box, Bezier curve, text node, and 1D arrow connector remains editable in Visio</text>

  <!-- Group 1: Client Tier -->
  <g id="Group-Client-Tier">
    <rect id="Client-Zone" x="44" y="110" width="170" height="370" rx="12" fill="#eff6ff" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text id="Client-Zone-Title" x="129" y="138" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#1d4ed8">CLIENT TIER</text>

    <g id="Web-App-Node" transform="translate(64, 165)">
      <rect id="Web-Box" x="0" y="0" width="130" height="72" rx="10" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
      <circle id="Web-Dot" cx="24" cy="36" r="10" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>
      <text id="Web-Label" x="78" y="34" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#1e293b">Web SPA</text>
      <text id="Web-Sub" x="78" y="52" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#64748b">HTTPS / GraphQL</text>
    </g>

    <g id="Mobile-App-Node" transform="translate(64, 285)">
      <rect id="Mobile-Box" x="0" y="0" width="130" height="72" rx="10" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
      <circle id="Mobile-Dot" cx="24" cy="36" r="10" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>
      <text id="Mobile-Label" x="78" y="34" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#1e293b">Mobile iOS</text>
      <text id="Mobile-Sub" x="78" y="52" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#64748b">gRPC / TLS 1.3</text>
    </g>
  </g>

  <!-- Group 2: Edge & API Gateway -->
  <g id="Group-API-Gateway" transform="translate(275, 200)">
    <rect id="Gateway-Card" x="0" y="0" width="150" height="120" rx="14" fill="url(#gatewayGrad)" stroke="#312e81" stroke-width="2"/>
    <polygon id="Gateway-Hex" points="75,20 95,32 95,54 75,66 55,54 55,32" fill="#818cf8" stroke="#ffffff" stroke-width="1.5"/>
    <text id="Gateway-Title" x="75" y="90" text-anchor="middle" font-family="Segoe UI" font-size="14" font-weight="bold" fill="#ffffff">API Gateway</text>
    <text id="Gateway-Meta" x="75" y="108" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#e0e7ff">Auth • Rate Limit</text>
  </g>

  <!-- Group 3: Core Microservices -->
  <g id="Group-Microservices">
    <rect id="Services-Zone" x="485" y="110" width="190" height="370" rx="12" fill="#f0fdf4" stroke="#86efac" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text id="Services-Zone-Title" x="580" y="138" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#15803d">CORE SERVICES</text>

    <g id="Order-Service" transform="translate(508, 160)">
      <rect x="0" y="0" width="144" height="68" rx="8" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>
      <text x="72" y="30" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#14532d">Order Service</text>
      <text x="72" y="48" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#16a34a">Node.js • Worker</text>
    </g>

    <g id="Billing-Service" transform="translate(508, 256)">
      <rect x="0" y="0" width="144" height="68" rx="8" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>
      <text x="72" y="30" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#14532d">Billing Engine</text>
      <text x="72" y="48" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#16a34a">Rust • Stripe Webhook</text>
    </g>

    <g id="Notify-Service" transform="translate(508, 352)">
      <rect x="0" y="0" width="144" height="68" rx="8" fill="#ffffff" stroke="#16a34a" stroke-width="2"/>
      <text x="72" y="30" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#14532d">Notification Bus</text>
      <text x="72" y="48" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#16a34a">Kafka • PubSub</text>
    </g>
  </g>

  <!-- Group 4: Data & Storage Layer -->
  <g id="Group-Data-Storage">
    <g id="Postgres-Primary" transform="translate(735, 165)">
      <rect x="0" y="0" width="140" height="90" rx="12" fill="#fffbeb" stroke="#d97706" stroke-width="2"/>
      <ellipse cx="70" cy="24" rx="42" ry="10" fill="#fde68a" stroke="#d97706" stroke-width="1.5"/>
      <text x="70" y="56" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#78350f">PostgreSQL</text>
      <text x="70" y="74" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#b45309">Primary Cluster</text>
    </g>

    <g id="Redis-Cache" transform="translate(735, 315)">
      <rect x="0" y="0" width="140" height="90" rx="12" fill="#fef2f2" stroke="#dc2626" stroke-width="2"/>
      <polygon points="70,14 92,26 70,38 48,26" fill="#fecaca" stroke="#dc2626" stroke-width="1.5"/>
      <text x="70" y="60" text-anchor="middle" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#7f1d1d">Redis Streams</text>
      <text x="70" y="78" text-anchor="middle" font-family="Segoe UI" font-size="10" fill="#b91c1c">Sub-ms Cache</text>
    </g>
  </g>

  <!-- Group 5: 1D Connectors & Arrows -->
  <g id="Group-Connectors">
    <line id="Conn-Web-Gateway" x1="194" y1="201" x2="275" y2="245" stroke="#2563eb" stroke-width="2.2" marker-end="url(#arrow-blue)"/>
    <line id="Conn-Mobile-Gateway" x1="194" y1="321" x2="275" y2="275" stroke="#2563eb" stroke-width="2.2" marker-end="url(#arrow-blue)"/>
    <line id="Conn-GW-Order" x1="425" y1="240" x2="508" y2="194" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
    <line id="Conn-GW-Billing" x1="425" y1="260" x2="508" y2="290" stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
    <line id="Conn-GW-Notify" x1="425" y1="280" x2="508" y2="386" stroke="#475569" stroke-width="2" stroke-dasharray="5,4" marker-end="url(#arrow)"/>
    <line id="Conn-Order-DB" x1="652" y1="194" x2="735" y2="210" stroke="#d97706" stroke-width="2" marker-end="url(#arrow)"/>
    <line id="Conn-Billing-DB" x1="652" y1="290" x2="735" y2="225" stroke="#d97706" stroke-width="2" marker-end="url(#arrow)"/>
    <line id="Conn-Notify-Redis" x1="652" y1="386" x2="735" y2="360" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,4" marker-end="url(#arrow)"/>
  </g>
</svg>`
  },

  illustration: {
    title: 'Vector Rocket & Orbit Illustration',
    filename: 'vector-rocket-illustration.vsdx',
    description: 'Complex cubic Bezier <path> curves, elliptical arcs, transforms, and layered vector groups.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="800" height="520">
  <defs>
    <linearGradient id="spaceBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="planetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#db2777"/>
    </linearGradient>
  </defs>

  <!-- Space Backdrop -->
  <rect id="Space-Canvas" x="20" y="20" width="760" height="480" rx="24" fill="url(#spaceBg)" stroke="#334155" stroke-width="2"/>

  <!-- Orbit Rings Group -->
  <g id="Group-Orbit-Paths">
    <ellipse id="Outer-Orbit" cx="400" cy="270" rx="290" ry="145" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="8,6" stroke-opacity="0.45"/>
    <ellipse id="Inner-Orbit" cx="400" cy="270" rx="195" ry="96" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="4,6" stroke-opacity="0.55"/>
  </g>

  <!-- Ringed Planet Group -->
  <g id="Group-Ringed-Planet" transform="translate(190, 175)">
    <circle id="Planet-Body" cx="0" cy="0" r="54" fill="url(#planetGrad)" stroke="#fbcfe8" stroke-width="2"/>
    <path id="Planet-Ring" d="M -82 14 C -45 42, 45 42, 82 14 C 95 4, 80 -8, 56 -12" fill="none" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
    <circle id="Planet-Moon" cx="78" cy="-48" r="12" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1.5"/>
  </g>

  <!-- Central Rocket Group (with rotation & nested sub-parts) -->
  <g id="Group-Spacecraft" transform="translate(455, 255) rotate(-22)">
    <!-- Exhaust Flame (Cubic Beziers) -->
    <path id="Rocket-Flame-Outer" d="M -22 72 C -30 112, 0 135, 0 154 C 0 135, 30 112, 22 72 Z" fill="#f97316" stroke="#fbbf24" stroke-width="2"/>
    <path id="Rocket-Flame-Core" d="M -11 72 C -15 98, 0 115, 0 128 C 0 115, 15 98, 11 72 Z" fill="#fef08a"/>

    <!-- Side Fins -->
    <path id="Fin-Left" d="M -34 26 L -68 68 L -28 68 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
    <path id="Fin-Right" d="M 34 26 L 68 68 L 28 68 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>

    <!-- Fuselage Curve (SVG Arc & Cubic Bezier) -->
    <path id="Rocket-Hull" d="M 0 -95 C 34 -48, 42 15, 32 72 L -32 72 C -42 15, -34 -48, 0 -95 Z" fill="#f8fafc" stroke="#475569" stroke-width="2.5"/>
    <path id="Rocket-Nose-Cone" d="M 0 -95 C 15 -72, 23 -48, 26 -30 L -26 -30 C -23 -48, -15 -72, 0 -95 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>

    <!-- Porthole Window -->
    <circle id="Window-Frame" cx="0" cy="4" r="18" fill="#0284c7" stroke="#cbd5e1" stroke-width="4"/>
    <circle id="Window-Glint" cx="-5" cy="-2" r="5" fill="#e0f2fe"/>
  </g>

  <!-- Starfield & Telemetry Badge Group -->
  <g id="Group-Telemetry-HUD" transform="translate(520, 60)">
    <rect id="HUD-Panel" x="0" y="0" width="225" height="92" rx="12" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
    <circle id="Status-LED" cx="24" cy="28" r="6" fill="#22c55e"/>
    <text id="HUD-Title" x="40" y="33" font-family="Segoe UI" font-size="13" font-weight="bold" fill="#f8fafc">TELEMETRY ACTIVE</text>
    <text id="HUD-Coords" x="24" y="58" font-family="Segoe UI" font-size="11" fill="#94a3b8">Velocity: 27,600 km/h</text>
    <text id="HUD-Orbit" x="24" y="76" font-family="Segoe UI" font-size="11" fill="#38bdf8">Trajectory: Nominal (Visio Ready)</text>
  </g>
</svg>`
  },

  wireframe: {
    title: 'Analytics Dashboard UI Wireframe',
    filename: 'analytics-wireframe.vsdx',
    description: 'Product UI component tree with sidebar navigation, KPI cards, bar/line charts, and badges.',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 520" width="880" height="520">
  <!-- App Window Shell -->
  <g id="Group-Window-Shell">
    <rect id="App-Frame" x="20" y="20" width="840" height="480" rx="14" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
    <rect id="Sidebar-Bg" x="20" y="20" width="185" height="480" rx="14" fill="#0f172a"/>
    <circle id="Traffic-Red" cx="44" cy="44" r="6" fill="#ef4444"/>
    <circle id="Traffic-Yellow" cx="64" cy="44" r="6" fill="#f59e0b"/>
    <circle id="Traffic-Green" cx="84" cy="44" r="6" fill="#10b981"/>
    <text id="Brand-Name" x="40" y="92" font-family="Segoe UI" font-size="16" font-weight="bold" fill="#ffffff">PulseMetrics</text>

    <!-- Nav Items -->
    <rect id="Nav-Active" x="34" y="116" width="157" height="36" rx="8" fill="#2563eb"/>
    <text id="Nav-Item-1" x="52" y="139" font-family="Segoe UI" font-size="12" font-weight="bold" fill="#ffffff">Overview Dashboard</text>
    <text id="Nav-Item-2" x="52" y="182" font-family="Segoe UI" font-size="12" fill="#94a3b8">Realtime Funnels</text>
    <text id="Nav-Item-3" x="52" y="218" font-family="Segoe UI" font-size="12" fill="#94a3b8">Cohort Retention</text>
    <text id="Nav-Item-4" x="52" y="254" font-family="Segoe UI" font-size="12" fill="#94a3b8">Billing &amp; Quotas</text>
  </g>

  <!-- KPI Row Group -->
  <g id="Group-KPI-Cards" transform="translate(230, 42)">
    <g id="KPI-Card-MRR" transform="translate(0, 0)">
      <rect x="0" y="0" width="190" height="96" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="18" y="28" font-family="Segoe UI" font-size="11" fill="#64748b">MONTHLY REVENUE</text>
      <text x="18" y="60" font-family="Segoe UI" font-size="22" font-weight="bold" fill="#0f172a">$148,920</text>
      <text x="18" y="82" font-family="Segoe UI" font-size="11" font-weight="bold" fill="#16a34a">+18.4% vs last mo</text>
    </g>

    <g id="KPI-Card-Users" transform="translate(208, 0)">
      <rect x="0" y="0" width="190" height="96" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="18" y="28" font-family="Segoe UI" font-size="11" fill="#64748b">ACTIVE WORKSPACES</text>
      <text x="18" y="60" font-family="Segoe UI" font-size="22" font-weight="bold" fill="#0f172a">12,480</text>
      <text x="18" y="82" font-family="Segoe UI" font-size="11" font-weight="bold" fill="#2563eb">+6.2% organic</text>
    </g>

    <g id="KPI-Card-Latency" transform="translate(416, 0)">
      <rect x="0" y="0" width="190" height="96" rx="10" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
      <text x="18" y="28" font-family="Segoe UI" font-size="11" fill="#64748b">P99 API LATENCY</text>
      <text x="18" y="60" font-family="Segoe UI" font-size="22" font-weight="bold" fill="#0f172a">42 ms</text>
      <text x="18" y="82" font-family="Segoe UI" font-size="11" font-weight="bold" fill="#059669">99.99% SLA Healthy</text>
    </g>
  </g>

  <!-- Chart Panel Group -->
  <g id="Group-Revenue-Chart" transform="translate(230, 162)">
    <rect id="Chart-Card" x="0" y="0" width="606" height="314" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
    <text id="Chart-Heading" x="24" y="36" font-family="Segoe UI" font-size="15" font-weight="bold" fill="#0f172a">Weekly Conversion Velocity &amp; Trendline</text>

    <!-- Grid Lines -->
    <line x1="36" y1="80" x2="570" y2="80" stroke="#f1f5f9" stroke-width="1.5"/>
    <line x1="36" y1="145" x2="570" y2="145" stroke="#f1f5f9" stroke-width="1.5"/>
    <line x1="36" y1="210" x2="570" y2="210" stroke="#f1f5f9" stroke-width="1.5"/>
    <line x1="36" y1="270" x2="570" y2="270" stroke="#cbd5e1" stroke-width="1.5"/>

    <!-- Bars Sub-Group -->
    <g id="Group-Chart-Bars">
      <rect x="64" y="170" width="42" height="100" rx="6" fill="#93c5fd"/>
      <rect x="144" y="135" width="42" height="135" rx="6" fill="#60a5fa"/>
      <rect x="224" y="152" width="42" height="118" rx="6" fill="#60a5fa"/>
      <rect x="304" y="105" width="42" height="165" rx="6" fill="#3b82f6"/>
      <rect x="384" y="88" width="42" height="182" rx="6" fill="#2563eb"/>
      <rect x="464" y="64" width="42" height="206" rx="6" fill="#1d4ed8"/>
    </g>

    <!-- Smooth Trend Curve -->
    <path id="Trend-Spline" d="M 85 162 C 130 120, 190 148, 245 140 C 300 132, 360 82, 485 56" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
  </g>
</svg>`
  }
};
