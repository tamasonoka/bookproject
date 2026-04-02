import { useState, useEffect, useCallback, useRef, type DragEvent } from 'react'
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
  Trash2,
  GripVertical,
  Clock,
  StickyNote,
  Settings,
  X,
  CalendarClock,
} from 'lucide-react'

// --- Types ---

interface TimeSlot {
  id: string
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  label: string
}

interface MemoItem {
  id: string
  text: string
  color: string
}

interface TimetableEntry {
  slotId: string
  memos: MemoItem[]
}

// --- Helpers ---

const STORAGE_KEYS = {
  SLOTS: 'timetable-slots',
  MEMOS: 'timetable-memos',
  ENTRIES: 'timetable-entries',
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
    // ignore parse errors
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

const DEFAULT_SLOTS: TimeSlot[] = [
  { id: generateId(), startTime: '06:00', endTime: '07:00', label: '朝活' },
  { id: generateId(), startTime: '07:00', endTime: '08:00', label: '朝食' },
  { id: generateId(), startTime: '08:00', endTime: '09:00', label: '通勤' },
  { id: generateId(), startTime: '09:00', endTime: '12:00', label: '午前' },
  { id: generateId(), startTime: '12:00', endTime: '13:00', label: '昼食' },
  { id: generateId(), startTime: '13:00', endTime: '17:00', label: '午後' },
  { id: generateId(), startTime: '17:00', endTime: '18:00', label: '退勤' },
  { id: generateId(), startTime: '18:00', endTime: '19:00', label: '夕食' },
  { id: generateId(), startTime: '19:00', endTime: '21:00', label: '自由時間' },
  { id: generateId(), startTime: '21:00', endTime: '22:00', label: '就寝準備' },
]

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
}: {
  slot: TimeSlot
  entries: MemoItem[]
  onDrop: (slotId: string, memo: MemoItem, source: string, sourceSlotId?: string) => void
  onRemoveMemo: (slotId: string, memoId: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)

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
      className={`flex border-b border-zinc-200 transition-colors ${
        isDragOver ? 'bg-blue-50/70 ring-2 ring-blue-300 ring-inset' : 'hover:bg-zinc-50/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Time column */}
      <div className="w-28 shrink-0 border-r border-zinc-200 p-3 flex flex-col items-center justify-center bg-zinc-50/80">
        <span className="text-xs font-mono text-zinc-500">
          {slot.startTime}
        </span>
        <span className="text-xs text-zinc-300">|</span>
        <span className="text-xs font-mono text-zinc-500">
          {slot.endTime}
        </span>
      </div>

      {/* Label column */}
      <div className="w-24 shrink-0 border-r border-zinc-200 p-3 flex items-center justify-center">
        <span className="text-sm font-semibold text-zinc-700">{slot.label}</span>
      </div>

      {/* Entries column */}
      <div className="flex-1 p-3 min-h-16">
        {entries.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {entries.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                isDraggable={true}
                sourceSlotId={slot.id}
                onRemove={() => onRemoveMemo(slot.id, memo.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-300 text-sm">
            {isDragOver ? 'ここにドロップ' : 'メモをドラッグして追加'}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Main App ---

function App() {
  const [slots, setSlots] = useState<TimeSlot[]>(() =>
    loadFromStorage(STORAGE_KEYS.SLOTS, DEFAULT_SLOTS)
  )
  const [memos, setMemos] = useState<MemoItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.MEMOS, [])
  )
  const [entries, setEntries] = useState<TimetableEntry[]>(() =>
    loadFromStorage(STORAGE_KEYS.ENTRIES, [])
  )

  const [newMemoText, setNewMemoText] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editSlots, setEditSlots] = useState<TimeSlot[]>([])
  const memoInputRef = useRef<HTMLInputElement>(null)

  // Persist state
  useEffect(() => saveToStorage(STORAGE_KEYS.SLOTS, slots), [slots])
  useEffect(() => saveToStorage(STORAGE_KEYS.MEMOS, memos), [memos])
  useEffect(() => saveToStorage(STORAGE_KEYS.ENTRIES, entries), [entries])

  // Add memo
  const addMemo = useCallback(() => {
    const text = newMemoText.trim()
    if (!text) return
    const memo: MemoItem = {
      id: generateId(),
      text,
      color: getRandomColor(),
    }
    setMemos((prev) => [...prev, memo])
    setNewMemoText('')
    memoInputRef.current?.focus()
  }, [newMemoText])

  // Remove memo from list
  const removeMemoFromList = useCallback((memoId: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== memoId))
  }, [])

  // Remove memo from timetable slot
  const removeMemoFromSlot = useCallback((slotId: string, memoId: string) => {
    setEntries((prev) =>
      prev
        .map((entry) =>
          entry.slotId === slotId
            ? { ...entry, memos: entry.memos.filter((m) => m.id !== memoId) }
            : entry
        )
        .filter((entry) => entry.memos.length > 0)
    )
  }, [])

  // Drop memo onto a time slot
  const handleDrop = useCallback(
    (slotId: string, memo: MemoItem, source: string, sourceSlotId?: string) => {
      // If dragging from the same slot, ignore
      if (source === 'timetable' && sourceSlotId === slotId) return

      // Remove from source
      if (source === 'memolist') {
        setMemos((prev) => prev.filter((m) => m.id !== memo.id))
      } else if (source === 'timetable' && sourceSlotId) {
        setEntries((prev) =>
          prev
            .map((entry) =>
              entry.slotId === sourceSlotId
                ? { ...entry, memos: entry.memos.filter((m) => m.id !== memo.id) }
                : entry
            )
            .filter((entry) => entry.memos.length > 0)
        )
      }

      // Add to target slot
      setEntries((prev) => {
        const existing = prev.find((e) => e.slotId === slotId)
        if (existing) {
          return prev.map((entry) =>
            entry.slotId === slotId
              ? { ...entry, memos: [...entry.memos, { ...memo, id: generateId() }] }
              : entry
          )
        }
        return [...prev, { slotId, memos: [{ ...memo, id: generateId() }] }]
      })
    },
    []
  )

  // Return memo from timetable back to memo list (when dropping on memo area)
  const handleReturnToMemoList = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    try {
      const memoData = e.dataTransfer.getData('memo')
      const source = e.dataTransfer.getData('source')
      const sourceSlotId = e.dataTransfer.getData('sourceSlotId')
      if (memoData && source === 'timetable' && sourceSlotId) {
        const memo = JSON.parse(memoData) as MemoItem
        // Remove from timetable
        setEntries((prev) =>
          prev
            .map((entry) =>
              entry.slotId === sourceSlotId
                ? { ...entry, memos: entry.memos.filter((m) => m.id !== memo.id) }
                : entry
            )
            .filter((entry) => entry.memos.length > 0)
        )
        // Add back to memo list
        setMemos((prev) => [...prev, { ...memo, id: generateId() }])
      }
    } catch {
      // ignore
    }
  }, [])

  // Slot settings
  const openSettings = () => {
    setEditSlots(slots.map((s) => ({ ...s })))
    setSettingsOpen(true)
  }

  const saveSettings = () => {
    const validSlots = editSlots.filter(
      (s) => s.startTime && s.endTime && s.label.trim()
    )
    setSlots(validSlots)
    // Clean up entries for removed slots
    const validIds = new Set(validSlots.map((s) => s.id))
    setEntries((prev) => prev.filter((e) => validIds.has(e.slotId)))
    setSettingsOpen(false)
  }

  const addEditSlot = () => {
    setEditSlots((prev) => [
      ...prev,
      { id: generateId(), startTime: '', endTime: '', label: '' },
    ])
  }

  const removeEditSlot = (id: string) => {
    setEditSlots((prev) => prev.filter((s) => s.id !== id))
  }

  const updateEditSlot = (id: string, field: keyof TimeSlot, value: string) => {
    setEditSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  // Clear all memos
  const clearAllMemos = () => {
    setMemos([])
  }

  // Clear all entries
  const clearAllEntries = () => {
    setEntries([])
  }

  const getEntriesForSlot = (slotId: string): MemoItem[] => {
    return entries.find((e) => e.slotId === slotId)?.memos ?? []
  }

  return (
    <div className="flex h-screen bg-zinc-100">
      {/* Left Sidebar: Memo List */}
      <div
        className="w-80 shrink-0 border-r border-zinc-200 bg-white flex flex-col shadow-sm"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDrop={handleReturnToMemoList}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-200 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center gap-2 text-white mb-3">
            <StickyNote className="h-5 w-5" />
            <h2 className="text-lg font-bold">メモリスト</h2>
            <Badge variant="secondary" className="ml-auto bg-white/20 text-white border-0">
              {memos.length}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Input
              ref={memoInputRef}
              value={newMemoText}
              onChange={(e) => setNewMemoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addMemo()
              }}
              placeholder="新しいメモを入力..."
              className="bg-white/90 border-0 placeholder:text-zinc-400 text-sm"
            />
            <Button
              onClick={addMemo}
              size="icon"
              variant="secondary"
              className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Memo Items */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {memos.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">メモがありません</p>
                <p className="text-xs mt-1">上のフィールドからメモを追加してください</p>
              </div>
            ) : (
              memos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  memo={memo}
                  isDraggable={true}
                  onRemove={() => removeMemoFromList(memo.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        {memos.length > 0 && (
          <div className="p-3 border-t border-zinc-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllMemos}
              className="w-full text-zinc-400 hover:text-red-500 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              メモをすべてクリア
            </Button>
          </div>
        )}
      </div>

      {/* Main: Timetable */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 bg-white border-b border-zinc-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-6 w-6 text-indigo-500" />
            <div>
              <h1 className="text-xl font-bold text-zinc-800">タイムテーブル</h1>
              <p className="text-xs text-zinc-400">左のメモをドラッグ＆ドロップで配置</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllEntries}
              className="text-xs text-zinc-500"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              テーブルをクリア
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openSettings}
              className="text-xs"
            >
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              時間帯を設定
            </Button>
          </div>
        </div>

        {/* Timetable */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Table Header */}
                <div className="flex border-b border-zinc-300 bg-zinc-100">
                  <div className="w-28 shrink-0 border-r border-zinc-300 p-2 text-center">
                    <span className="text-xs font-semibold text-zinc-500 flex items-center justify-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      時間
                    </span>
                  </div>
                  <div className="w-24 shrink-0 border-r border-zinc-300 p-2 text-center">
                    <span className="text-xs font-semibold text-zinc-500">ラベル</span>
                  </div>
                  <div className="flex-1 p-2 text-center">
                    <span className="text-xs font-semibold text-zinc-500 flex items-center justify-center gap-1">
                      <StickyNote className="h-3.5 w-3.5" />
                      メモ
                    </span>
                  </div>
                </div>

                {/* Table Rows */}
                {slots.map((slot) => (
                  <TimeSlotRow
                    key={slot.id}
                    slot={slot}
                    entries={getEntriesForSlot(slot.id)}
                    onDrop={handleDrop}
                    onRemoveMemo={removeMemoFromSlot}
                  />
                ))}

                {slots.length === 0 && (
                  <div className="p-12 text-center text-zinc-400">
                    <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">時間帯が設定されていません</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={openSettings}
                    >
                      時間帯を設定する
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              タイムテーブル設定
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              {editSlots.map((slot, index) => (
                <div key={slot.id} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-6 text-right shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="sr-only">開始時間</Label>
                    <Input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        updateEditSlot(slot.id, 'startTime', e.target.value)
                      }
                      className="w-32 text-sm"
                    />
                    <span className="text-zinc-400 text-sm">〜</span>
                    <Label className="sr-only">終了時間</Label>
                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        updateEditSlot(slot.id, 'endTime', e.target.value)
                      }
                      className="w-32 text-sm"
                    />
                    <Label className="sr-only">ラベル</Label>
                    <Input
                      value={slot.label}
                      onChange={(e) =>
                        updateEditSlot(slot.id, 'label', e.target.value)
                      }
                      placeholder="ラベル"
                      className="flex-1 text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEditSlot(slot.id)}
                    className="shrink-0 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <Separator />

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="outline" size="sm" onClick={addEditSlot}>
              <Plus className="h-4 w-4 mr-1.5" />
              時間帯を追加
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setSettingsOpen(false)}
              >
                キャンセル
              </Button>
              <Button onClick={saveSettings}>保存</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
