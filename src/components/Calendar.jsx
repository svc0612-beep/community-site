const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const KIND_LABEL = {
  holiday: '휴무',
  event: '행사',
  exam: '평가',
  etc: '기타',
}

// '2026-07-28' 문자열을 시간대 문제 없이 Date로 변환
export function toDate(text) {
  const [y, m, d] = text.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 일정 목록을 날짜별로 펼친다 (여러 날 일정은 모든 날에 들어감)
export function spreadByDate(events) {
  const map = new Map()

  events.forEach((ev) => {
    const start = toDate(ev.start_date)
    const end = ev.end_date ? toDate(ev.end_date) : start
    const cursor = new Date(start)

    while (cursor <= end) {
      const key = toKey(cursor)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(ev)
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  return map
}

export default function Calendar({ year, month, byDate, selected, onSelect }) {
  const first = new Date(year, month, 1)
  const startPad = first.getDay()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const prevLast = new Date(year, month, 0).getDate()

  const todayKey = toKey(new Date())
  const cells = []

  for (let i = startPad - 1; i >= 0; i--) {
    cells.push({ day: prevLast - i, out: true })
  }
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, out: false, key: toKey(new Date(year, month, d)) })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - startPad - lastDay + 1, out: true })
  }

  return (
    <div className="cal">
      {WEEKDAYS.map((w, i) => (
        <div className={i === 0 ? 'cal-head cal-sun' : 'cal-head'} key={w}>
          {w}
        </div>
      ))}

      {cells.map((cell, i) => {
        if (cell.out) {
          return <div className="cal-cell cal-out" key={i}><span className="cal-num">{cell.day}</span></div>
        }

        const list = byDate.get(cell.key) ?? []
        const isToday = cell.key === todayKey
        const isSelected = cell.key === selected

        let cls = 'cal-cell'
        if (isSelected) cls += ' cal-sel'

        return (
          <button className={cls} key={i} type="button" onClick={() => onSelect(cell.key)}>
            <span className={isToday ? 'cal-num cal-today' : i % 7 === 0 ? 'cal-num cal-sun' : 'cal-num'}>
              {cell.day}
            </span>

            {list.slice(0, 3).map((ev) => (
              <span className={'cal-ev cal-ev-' + ev.kind} key={ev.id}>
                {ev.start_time ? ev.start_time + ' ' : ''}{ev.title}
              </span>
            ))}

            {list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}
          </button>
        )
      })}
    </div>
  )
}