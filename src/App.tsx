import { useState, useEffect, useCallback, useRef, useMemo, type DragEvent } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Plus,
  GripVertical,
  Clock,
  StickyNote,
  Settings,
  X,
  CalendarClock,
  Timer,
  Info,
} from 'lucide-react'

// --- Constants ---

const TASK_SWITCH_BUFFER_MIN = 15

const STORAGE_KEYS = {
  MEMOS: 'timetable-memos-v2',
  ENTRIES: 'timetable-entries-v2',
  ACTIVE_TIME: 'timetable-active-time',
  DEFAULT_TASK_DURATION: 'timetable-default-task-duration',
}

const MEMO_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-green-100 border-green-300 text-green-800',
  'bg-yellow-100 border-yellow-300 text-yellow-800',
  'bg-pink-100 border-pink-300 text-pink-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-orange-100 border-orange-300 text-orange-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-red-100 border-red-300 text-red-800',
]

const DURATION_OPTIONS = [
  { value: 15, label: '15\u5206' },
  { value: 30, label: '30\u5206' },
  { value: 45, label: '45\u5206' },
  { value: 60, label: '1\u6642\u9593' },
  { value: 90, label: '1.5\u6642\u9593' },
  { value: 120, label: '2\u6642\u9593' },
]

// --- Types ---

interface MemoItem {
  id: string
  text: string
  color: string
  durationMin: number
}

interface ActiveTime {
  start: string
  end: string
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
}

interface TimetableEntry {
  slotId: string
  memos: MemoItem[]
}

const DEFAULT_ACTIVE_TIME: ActiveTime = {
  start: '09:00',
  end: '21:00',
}

// --- Helpers ---

function generateId(): string {
  return crypto.randomUUID()
}

function getRandomColor(): string {
  return MEMO_COLORS[Math.floor(Math.random() * MEMO_COLORS.length)]
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored) return JSON.parse(stored) as T
  } catch {
    // ignore
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function generateSlots(activeTime: ActiveTime): TimeSlot[] {
  const startMin = timeToMinutes(activeTime.start)
  const endMin = timeToMinutes(activeTime.end)
  if (endMin <= startMin) return []
  const slots: TimeSlot[] = []
  for (let t = startMin; t < endMin; t += 60) {
    const slotEnd = Math.min(t + 60, endMin)
    const startStr = minutesToTime(t)
    const endStr = minutesToTime(slotEnd)
    slots.push({
      id: `slot-${startStr}`,
      startTime: startStr,
      endTime: endStr,
    })
  }
  return slots
}

function getSlotDurationMin(slot: TimeSlot): number {
  return timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)
}

function getUsedTimeInSlot(slotMemos: MemoItem[]): number {
  if (slotMemos.length === 0) return 0
  return slotMemos.reduce(
    (sum, m) => sum + m.durationMin + TASK_SWITCH_BUFFER_MIN,
    0
  )
}

function getRemainingTimeInSlot(slot: TimeSlot, slotMemos: MemoItem[]): number {
  return Math.max(0, getSlotDurationMin(slot) - getUsedTimeInSlot(slotMemos))
}

function getTaskCapacity(remainingMin: number, taskDuration: number): number {
  const perTask = taskDuration + TASK_SWITCH_BUFFER_MIN
  if (perTask <= 0) return 0
  return Math.floor(remainingMin / perTask)
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}\u6642\u9593${m}\u5206` : `${h}\u6642\u9593`
  }
  return `${minutes}\u5206`
}

// --- Components ---

function MemoCard({
  memo,
  onRemove,
  isDraggable,
  sourceSlotId,
}: {
  memo: MemoItem
  onRemove?: () => void
  isDraggable: boolean
  sourceSlotId?: string
}) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('memo', JSON.stringify(memo))
    if (sourceSlotId) {
      e.dataTransfer.setData('sourceSlotId', sourceSlotId)
    }
    e.dataTransfer.setData('source', sourceSlotId ? 'timetable' : 'memolist')
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${memo.color}`}
    >
      {isDraggable && <GripVertical className="h-3.5 w-3.5 opacity-50 shrink-0" />}
      <span className="flex-1 truncate">{memo.text}</span>
      <Badge variant="secondary" className="text-xs shrink-0">
        {formatDuration(memo.durationMin)}
      </Badge>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="shrink-0 rounded-full p-0.5 hover:bg-black/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function TimeSlotRow({
  slot,
  entries,
  onDrop,
  onRemoveMemo,
  defaultTaskDuration,
}: {
  slot: TimeSlot
  entries: MemoItem[]
  onDrop: (slotId: string, memo: MemoItem, source: string, sourceSlotId?: string) => void
  onRemoveMemo: (slotId: string, memoId: string) => void
  defaultTaskDuration: number
}) {
  const [isDragOver, setIsDragOver] = useState(false)

  const slotDuration = getSlotDurationMin(slot)
  const usedTime = getUsedTimeInSlot(entries)
  const remaining = getRemainingTimeInSlot(slot, entries)
  const capacity = getTaskCapacity(remaining, defaultTaskDuration)
  const usagePercent = slotDuration > 0 ? Math.min(100, (usedTime / slotDuration) * 100) : 0

  const barColor = usagePercent >= 90 ? 'bg-red-400' : usagePercent >= 60 ? 'bg-yellow-400' : 'bg-emerald-400'

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const memoData = e.dataTransfer.getData('memo')
      const source = e.dataTransfer.getData('source')
      const sourceSlotId = e.dataTransfer.getData('sourceSlotId')
      if (memoData) {
        const memo = JSON.parse(memoData) as MemoItem
        onDrop(slot.id, memo, source, sourceSlotId || undefined)
      }
    } catch {
      // ignore
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-b border-zinc-100 transition-colors ${isDragOver ? 'bg-indigo-50' : ''}`}
    >
      <div className="flex items-stretch">
        <div className="w-24 shrink-0 border-r border-zinc-100 p-3 flex flex-col justify-center">
          <div className="text-sm font-semibold text-zinc-700">
            {slot.startTime}
          </div>
          <div className="text-xs text-zinc-400">
            {slot.endTime}
          </div>
        </div>

        <div className="flex-1 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs">
              {remaining > 0 ? (
                <>
                  <span className="text-zinc-500">
                    {'\u6B8B\u308A'} {formatDuration(remaining)}
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    +{capacity}{'\u4EF6\u53EF'}
                  </Badge>
                </>
              ) : (
                <Badge variant="secondary" className="text-xs text-red-600 bg-red-50">
                  {'\u6E80\u676F'}
                </Badge>
              )}
            </div>
          </div>

          {entries.length > 0 ? (
            <div className="space-y-1.5">
              {entries.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  isDraggable
                  sourceSlotId={slot.id}
                  onRemove={() => onRemoveMemo(slot.id, memo.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-300 py-2 text-center">
              {'\u30C9\u30E9\u30C3\u30B0\uFF06\u30C9\u30ED\u30C3\u30D7\u3067\u30E1\u30E2\u3092\u914D\u7F6E'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Main App ---

function App() {
  const [memos, setMemos] = useState<MemoItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.MEMOS, [])
  )
  const [entries, setEntries] = useState<TimetableEntry[]>(() =>
    loadFromStorage(STORAGE_KEYS.ENTRIES, [])
  )
  const [activeTime, setActiveTime] = useState<ActiveTime>(() =>
    loadFromStorage(STORAGE_KEYS.ACTIVE_TIME, DEFAULT_ACTIVE_TIME)
  )
  const [defaultTaskDuration, setDefaultTaskDuration] = useState<number>(() =>
    loadFromStorage(STORAGE_KEYS.DEFAULT_TASK_DURATION, 30)
  )
  const [newMemoText, setNewMemoText] = useState('')
  const [newMemoDuration, setNewMemoDuration] = useState(30)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editActiveTime, setEditActiveTime] = useState<ActiveTime>(activeTime)
  const [editDefaultDuration, setEditDefaultDuration] = useState(defaultTaskDuration)
  const inputRef = useRef<HTMLInputElement>(null)

  const slots = useMemo(() => generateSlots(activeTime), [activeTime])

  const summary = useMemo(() => {
    let totalRemaining = 0
    let totalCapacity = 0
    for (const slot of slots) {
      const slotMemos = entries.find((e) => e.slotId === slot.id)?.memos ?? []
      const rem = getRemainingTimeInSlot(slot, slotMemos)
      totalRemaining += rem
      totalCapacity += getTaskCapacity(rem, defaultTaskDuration)
    }
    return { totalRemaining, totalCapacity }
  }, [slots, entries, defaultTaskDuration])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEMOS, memos)
  }, [memos])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ENTRIES, entries)
  }, [entries])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACTIVE_TIME, activeTime)
  }, [activeTime])

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.DEFAULT_TASK_DURATION, defaultTaskDuration)
  }, [defaultTaskDuration])

  const getEntriesForSlot = useCallback(
    (slotId: string): MemoItem[] => {
      return entries.find((e) => e.slotId === slotId)?.memos ?? []
    },
    [entries]
  )

  const addMemo = useCallback(() => {
    const text = newMemoText.trim()
    if (!text) return
    const memo: MemoItem = {
      id: generateId(),
      text,
      color: getRandomColor(),
      durationMin: newMemoDuration,
    }
    setMemos((prev) => [...prev, memo])
    setNewMemoText('')
    inputRef.current?.focus()
  }, [newMemoText, newMemoDuration])

  const removeMemo = useCallback((id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const handleDrop = useCallback(
    (slotId: string, memo: MemoItem, source: string, sourceSlotId?: string) => {
      if (source === 'memolist') {
        setMemos((prev) => prev.filter((m) => m.id !== memo.id))
      } else if (source === 'timetable' && sourceSlotId) {
        setEntries((prev) =>
          prev.map((e) =>
            e.slotId === sourceSlotId
              ? { ...e, memos: e.memos.filter((m) => m.id !== memo.id) }
              : e
          )
        )
      }

      setEntries((prev) => {
        const existing = prev.find((e) => e.slotId === slotId)
        if (existing) {
          if (existing.memos.some((m) => m.id === memo.id)) return prev
          return prev.map((e) =>
            e.slotId === slotId ? { ...e, memos: [...e.memos, memo] } : e
          )
        }
        return [...prev, { slotId, memos: [memo] }]
      })
    },
    []
  )

  const removeMemoFromSlot = useCallback((slotId: string, memoId: string) => {
    let removedMemo: MemoItem | undefined
    setEntries((prev) =>
      prev.map((e) => {
        if (e.slotId === slotId) {
          removedMemo = e.memos.find((m) => m.id === memoId)
          return { ...e, memos: e.memos.filter((m) => m.id !== memoId) }
        }
        return e
      })
    )
    if (removedMemo) {
      const memoToReturn = removedMemo
      setMemos((prev) => [...prev, memoToReturn])
    }
  }, [])

  const handleMemoListDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      try {
        const memoData = e.dataTransfer.getData('memo')
        const source = e.dataTransfer.getData('source')
        const sourceSlotId = e.dataTransfer.getData('sourceSlotId')
        if (memoData && source === 'timetable' && sourceSlotId) {
          const memo = JSON.parse(memoData) as MemoItem
          setEntries((prev) =>
            prev.map((ent) =>
              ent.slotId === sourceSlotId
                ? { ...ent, memos: ent.memos.filter((m) => m.id !== memo.id) }
                : ent
            )
          )
          setMemos((prev) => [...prev, memo])
        }
      } catch {
        // ignore
      }
    },
    []
  )

  const openSettings = () => {
    setEditActiveTime(activeTime)
    setEditDefaultDuration(defaultTaskDuration)
    setSettingsOpen(true)
  }

  const saveSettings = () => {
    setActiveTime(editActiveTime)
    setDefaultTaskDuration(editDefaultDuration)
    setSettingsOpen(false)
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      <div
        className="w-80 border-r border-zinc-200 bg-white flex flex-col shrink-0"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={handleMemoListDrop}
      >
        <div className="p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="h-5 w-5 text-amber-500" />
            <h2 className="font-bold text-zinc-800">{'\u30E1\u30E2\u30EA\u30B9\u30C8'}</h2>
            <Badge variant="secondary" className="ml-auto text-xs">
              {memos.length}{'\u4EF6'}
            </Badge>
          </div>

          <div className="flex gap-2 mb-2">
            <Input
              ref={inputRef}
              value={newMemoText}
              onChange={(e) => setNewMemoText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMemo()}
              placeholder={'\u65B0\u3057\u3044\u30E1\u30E2...'}
              className="text-sm"
            />
            <Button size="icon" onClick={addMemo} className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={newMemoDuration}
              onChange={(e) => setNewMemoDuration(Number(e.target.value))}
              className="flex-1 text-xs border border-zinc-200 rounded-md px-2 py-1.5 bg-white text-zinc-700"
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ScrollArea className="flex-1 p-3">
          {memos.length > 0 ? (
            <div className="space-y-2">
              {memos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  isDraggable
                  onRemove={() => removeMemo(memo.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-300">
              <StickyNote className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{'\u30E1\u30E2\u304C\u3042\u308A\u307E\u305B\u3093'}</p>
              <p className="text-xs mt-1">{'\u4E0A\u306E\u30D5\u30A9\u30FC\u30E0\u304B\u3089\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044'}</p>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-zinc-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-6 w-6 text-indigo-500" />
              <div>
                <h1 className="text-lg font-bold text-zinc-800">{'\u30BF\u30A4\u30E0\u30C6\u30FC\u30D6\u30EB'}</h1>
                <p className="text-xs text-zinc-400">
                  {activeTime.start} {'\u301C'} {activeTime.end}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-600">
                  {'\u6B8B\u308A\u5408\u8A08'}: <span className="font-semibold text-indigo-600">{formatDuration(summary.totalRemaining)}</span>
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-zinc-400" />
                <span className="text-zinc-600">
                  {'\u8FFD\u52A0\u53EF\u80FD'}: <span className="font-semibold text-emerald-600">{summary.totalCapacity}{'\u4EF6'}</span>
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Timer className="h-4 w-4" />
                <span>{'\u5207\u66FF'}{TASK_SWITCH_BUFFER_MIN}{'\u5206'}</span>
              </div>
              <Button variant="outline" size="sm" onClick={openSettings}>
                <Settings className="h-4 w-4 mr-1.5" />
                {'\u8A2D\u5B9A'}
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center bg-zinc-50 border-b border-zinc-200 px-3 py-2">
                  <div className="w-24 shrink-0 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    {'\u6642\u9593'}
                  </div>
                  <div className="flex-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    {'\u30BF\u30B9\u30AF'}
                  </div>
                </div>

                {slots.map((slot) => (
                  <TimeSlotRow
                    key={slot.id}
                    slot={slot}
                    entries={getEntriesForSlot(slot.id)}
                    onDrop={handleDrop}
                    onRemoveMemo={removeMemoFromSlot}
                    defaultTaskDuration={defaultTaskDuration}
                  />
                ))}

                {slots.length === 0 && (
                  <div className="p-12 text-center text-zinc-400">
                    <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{'\u30A2\u30AF\u30C6\u30A3\u30D6\u30BF\u30A4\u30E0\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044'}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openSettings}
                    >
                      {'\u8A2D\u5B9A\u3092\u958B\u304F'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {'\u8A2D\u5B9A'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-700">{'\u30A2\u30AF\u30C6\u30A3\u30D6\u30BF\u30A4\u30E0'}</span>
              </div>
              <p className="text-xs text-indigo-400 mb-3">{'\u8868\u793A\u3059\u308B\u6642\u9593\u7BC4\u56F2\uFF081\u6642\u9593\u5358\u4F4D\u3067\u81EA\u52D5\u5206\u5272\uFF09'}</p>
              <div className="flex items-center gap-3">
                <Label className="sr-only">{'\u958B\u59CB'}</Label>
                <Input
                  type="time"
                  value={editActiveTime.start}
                  onChange={(e) =>
                    setEditActiveTime((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="w-36 text-sm bg-white"
                />
                <span className="text-indigo-400 font-medium">{'\u301C'}</span>
                <Label className="sr-only">{'\u7D42\u4E86'}</Label>
                <Input
                  type="time"
                  value={editActiveTime.end}
                  onChange={(e) =>
                    setEditActiveTime((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="w-36 text-sm bg-white"
                />
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">{'\u30C7\u30D5\u30A9\u30EB\u30C8\u30BF\u30B9\u30AF\u6642\u9593'}</span>
              </div>
              <p className="text-xs text-emerald-400 mb-3">{'\u7A7A\u304D\u679A\u306E\u8FFD\u52A0\u53EF\u80FD\u4EF6\u6570\u306E\u8A08\u7B97\u306B\u4F7F\u7528'}</p>
              <select
                value={editDefaultDuration}
                onChange={(e) => setEditDefaultDuration(Number(e.target.value))}
                className="w-full text-sm border border-emerald-200 rounded-md px-3 py-2 bg-white text-zinc-700"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-600">{'\u5207\u308A\u66FF\u3048\u30D0\u30C3\u30D5\u30A1'}</span>
              </div>
              <p className="text-xs text-zinc-400">
                {'\u5404\u30BF\u30B9\u30AF\u9593\u306B\u81EA\u52D5\u3067'}{TASK_SWITCH_BUFFER_MIN}{'\u5206\u306E\u5207\u308A\u66FF\u3048\u6642\u9593\u304C\u52A0\u7B97\u3055\u308C\u307E\u3059\u3002'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
              {'\u30AD\u30E3\u30F3\u30BB\u30EB'}
            </Button>
            <Button onClick={saveSettings}>{'\u4FDD\u5B58'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
