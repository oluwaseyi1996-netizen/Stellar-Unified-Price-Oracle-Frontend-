import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { usePrices } from '../hooks/usePrices'
import { useWebSocket } from '../hooks/useWebSocket'
import { useColumnCount } from '../hooks/useColumnCount'
import { PriceCard } from '../components/PriceCard'
import { PriceCardSkeleton } from '../components/PriceCardSkeleton'
import { ConnectionBadge } from '../components/ConnectionBadge'
import { NetworkStatusBanner } from '../components/NetworkStatusBanner'

const ROW_HEIGHT = 200
const SKELETON_COUNT = 8

function mergePrices(
  restPrices: { assetPair: string; price: number; timestamp: number; confidence: number; sources: string[] }[],
  livePrices: Map<string, { assetPair: string; price: number; timestamp: number; confidence: number; sources: string[] }>,
) {
  return restPrices.map((p) => {
    const live = livePrices.get(p.assetPair)
    if (live && live.timestamp >= p.timestamp) {
      return { ...p, ...live }
    }
    return p
  })
}

export function Dashboard() {
  const { prices, loading, error } = usePrices()
  const { livePrices, status } = useWebSocket(prices.map((p) => p.assetPair))
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const columns = useColumnCount(containerRef)

  const merged = mergePrices(prices, livePrices)
  const rowCount = Math.ceil(merged.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => document.documentElement, []),
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: 5,
  })

  const handleCardClick = useCallback(
    (pair: string) => navigate(`/price/${encodeURIComponent(pair)}`),
    [navigate],
  )

  return (
    <div>
      <NetworkStatusBanner />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Oracle Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aggregated from Chainlink, Redstone, Band &amp; Reflector
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400" role="alert">
          {error}
        </div>
      )}

      {loading && prices.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" aria-label="Loading price cards">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <PriceCardSkeleton key={i} />
          ))}
        </div>
      ) : merged.length > 0 ? (
        <div
          ref={containerRef}
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          aria-label="Price feeds"
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const startIdx = virtualRow.index * columns
            const rowItems = merged.slice(startIdx, startIdx + columns)
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: '1rem',
                  }}
                  role="list"
                >
                  {rowItems.map((p) => (
                    <PriceCard
                      key={p.assetPair}
                      price={p}
                      isLive={livePrices.has(p.assetPair)}
                      onClick={() => handleCardClick(p.assetPair)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-32 text-gray-500">
          <p className="text-lg mb-2">No price feeds available</p>
          <p className="text-sm">Connect to the aggregator API to see price data.</p>
        </div>
      )}
    </div>
  )
}
