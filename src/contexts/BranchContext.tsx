import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useBusiness } from './BusinessContext'
import { branchesApi } from '../api/branches.api'
import { isNetworkError } from '../api/errors'
import { useToast } from '../components/ui/Toast'
import type { Branch } from '../types/api'

/** Special value for "no branch filter". */
export const ALL_BRANCHES = 'all'

interface BranchContextValue {
  /** Active branches of the current business. */
  branches: Branch[]
  /** 'all' or a branch id. */
  activeBranchId: string
  /** Convenience: undefined when 'all', otherwise the id. */
  activeBranchFilter: string | undefined
  loading: boolean
  setActiveBranchId: (id: string) => void
  refresh: () => Promise<void>
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function BranchProvider({ children }: { children: ReactNode }) {
  const { activeBusinessId } = useBusiness()
  const toast = useToast()

  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranchId, setActiveBranchIdState] = useState<string>(ALL_BRANCHES)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!activeBusinessId) {
      setBranches([])
      setActiveBranchIdState(ALL_BRANCHES)
      return
    }
    setLoading(true)
    try {
      const res = await branchesApi.list(activeBusinessId)
      const list: Branch[] = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : []
      const active = list.filter(b => b && b.isActive)
      setBranches(active)
      // Reset the selection if it no longer exists.
      setActiveBranchIdState(prev => {
        if (prev === ALL_BRANCHES) return prev
        return active.some(b => b.id === prev) ? prev : (active[0]?.id ?? ALL_BRANCHES)
      })
    } catch (err) {
      console.error('[branch] failed to load branches', err)
      if (isNetworkError(err)) toast.error('Network Error')
      setBranches([])
      setActiveBranchIdState(ALL_BRANCHES)
    } finally {
      setLoading(false)
    }
  }, [activeBusinessId])

  // Fetch whenever the business changes.
  useEffect(() => {
    void refresh()
  }, [refresh])

  const setActiveBranchId = useCallback((id: string) => {
    setActiveBranchIdState(id)
  }, [])

  const value = useMemo<BranchContextValue>(() => ({
    branches,
    activeBranchId,
    activeBranchFilter: activeBranchId === ALL_BRANCHES ? undefined : activeBranchId,
    loading,
    setActiveBranchId,
    refresh,
  }), [branches, activeBranchId, loading, setActiveBranchId, refresh])

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch() must be used inside a <BranchProvider>')
  return ctx
}