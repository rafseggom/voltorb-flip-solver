import { Fragment, useMemo, useState } from 'react'
import './App.css'

const GRID_SIZE = 5
const CYCLE_ORDER = ['unknown', 1, 2, 3, 'voltorb']

const ALL_ROW_PATTERNS = buildRowPatterns()

function buildRowPatterns() {
  const values = [1, 2, 3, 'voltorb']
  const patterns = []

  const dfs = (current) => {
    if (current.length === GRID_SIZE) {
      const sum = current.reduce((acc, cell) => acc + (cell === 'voltorb' ? 0 : cell), 0)
      const voltorbs = current.filter((cell) => cell === 'voltorb').length
      patterns.push({ cells: current, sum, voltorbs })
      return
    }
    values.forEach((value) => dfs([...current, value]))
  }

  dfs([])
  return patterns
}

function parseClueValue(value) {
  if (value === '' || value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function getNextState(current) {
  const index = CYCLE_ORDER.indexOf(current)
  return CYCLE_ORDER[(index + 1) % CYCLE_ORDER.length]
}

function filterRowPatterns(knownRow, clue) {
  const sumTarget = parseClueValue(clue.sum)
  const voltorbTarget = parseClueValue(clue.voltorbs)

  return ALL_ROW_PATTERNS.filter(({ cells, sum, voltorbs }) => {
    if (sumTarget !== null && sum !== sumTarget) return false
    if (voltorbTarget !== null && voltorbs !== voltorbTarget) return false

    for (let i = 0; i < GRID_SIZE; i += 1) {
      const known = knownRow[i]
      if (known === 'unknown') continue
      if (known === 'voltorb' && cells[i] !== 'voltorb') return false
      if (typeof known === 'number' && cells[i] !== known) return false
    }
    return true
  })
}

function evaluateBoards(grid, rowClues, colClues) {
  const hasAnyClue = [...rowClues, ...colClues].some(
    (clue) => parseClueValue(clue.sum) !== null || parseClueValue(clue.voltorbs) !== null
  )
  if (!hasAnyClue) {
    return {
      solutions: [],
      stats: null,
      recommended: [],
      issues: ['Add at least one row or column clue to start.'],
    }
  }

  const rowOptions = rowClues.map((clue, rowIndex) => filterRowPatterns(grid[rowIndex], clue))

  // Early exit if any row has no compatible patterns
  if (rowOptions.some((options) => options.length === 0)) {
    return { solutions: [], stats: null, recommended: [], issues: ['No valid boards match at least one row clue.'] }
  }

  const colSumTargets = colClues.map((clue) => parseClueValue(clue.sum))
  const colVoltorbTargets = colClues.map((clue) => parseClueValue(clue.voltorbs))

  const solutions = []

  const backtrack = (rowIndex, board, colSums, colVoltorbs) => {
    if (rowIndex === GRID_SIZE) {
      // Final column validation
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const targetSum = colSumTargets[col]
        const targetVolts = colVoltorbTargets[col]
        if (targetSum !== null && colSums[col] !== targetSum) return
        if (targetVolts !== null && colVoltorbs[col] !== targetVolts) return
      }
      solutions.push(board.map((row) => [...row]))
      return
    }

    for (const pattern of rowOptions[rowIndex]) {
      const nextBoard = [...board, pattern.cells]
      const nextSums = colSums.slice()
      const nextVolts = colVoltorbs.slice()

      let violates = false
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const value = pattern.cells[col]
        nextSums[col] += value === 'voltorb' ? 0 : value
        nextVolts[col] += value === 'voltorb' ? 1 : 0

        const sumTarget = colSumTargets[col]
        const voltsTarget = colVoltorbTargets[col]
        if (sumTarget !== null && nextSums[col] > sumTarget) {
          violates = true
          break
        }
        if (voltsTarget !== null && nextVolts[col] > voltsTarget) {
          violates = true
          break
        }
      }

      if (violates) continue
      backtrack(rowIndex + 1, nextBoard, nextSums, nextVolts)
    }
  }

  backtrack(0, [], Array(GRID_SIZE).fill(0), Array(GRID_SIZE).fill(0))

  if (solutions.length === 0) {
    return { solutions, stats: null, recommended: [], issues: ['No boards satisfy both row and column clues. Try adjusting your inputs.'] }
  }

  const stats = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ voltorbCount: 0, total: solutions.length, sumValues: 0 }))
  )

  solutions.forEach((board) => {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      for (let c = 0; c < GRID_SIZE; c += 1) {
        const cell = board[r][c]
        if (cell === 'voltorb') {
          stats[r][c].voltorbCount += 1
        } else {
          stats[r][c].sumValues += cell
        }
      }
    }
  })

  const probabilities = stats.map((row) =>
    row.map((entry) => ({
      voltorbProbability: entry.voltorbCount / entry.total,
      expectedValue: entry.sumValues / entry.total,
    }))
  )

  let minRisk = 1
  probabilities.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (grid[r][c] === 'unknown') {
        minRisk = Math.min(minRisk, cell.voltorbProbability)
      }
    })
  })

  const recommended = []
  probabilities.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (grid[r][c] === 'unknown' && cell.voltorbProbability === minRisk) {
        recommended.push({ row: r, col: c })
      }
    })
  })

  return { solutions, stats: probabilities, recommended, issues: [] }
}

function App() {
  const [grid, setGrid] = useState(
    Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 'unknown'))
  )
  const [rowClues, setRowClues] = useState(
    Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' }))
  )
  const [colClues, setColClues] = useState(
    Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' }))
  )

  const results = useMemo(() => evaluateBoards(grid, rowClues, colClues), [grid, rowClues, colClues])

  const updateClue = (setter, index, field, value) => {
    setter((prev) => {
      const next = prev.map((clue) => ({ ...clue }))
      next[index][field] = value
      return next
    })
  }

  const cycleCellState = (row, col) => {
    setGrid((prev) => {
      const next = prev.map((r) => r.slice())
      next[row][col] = getNextState(prev[row][col])
      return next
    })
  }

  const clearBoard = () => {
    setGrid(Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 'unknown')))
    setRowClues(Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' })))
    setColClues(Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' })))
  }

  const getCellLabel = (value) => {
    if (value === 'unknown') return '?'
    if (value === 'voltorb') return 'V'
    return value
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Voltorb Flip Assistant</p>
          <h1>Plot your safest flips</h1>
          <p className="lede">
            Enter the row and column clues from your game, add any tiles you have already revealed, and we will highlight
            the lowest-risk moves.
          </p>
        </div>
        <div className="hero-actions">
          <button className="ghost" onClick={clearBoard}>Reset board</button>
        </div>
      </header>

      <main className="layout">
        <section className="panel board-panel">
          <div className="panel-header">
            <div>
              <h2>Board and clues</h2>
              <p className="hint">Tap a tile to cycle Unknown → 1 → 2 → 3 → Voltorb.</p>
            </div>
            <div className="mini-legend">
              <span className="legend dot safe" /> safest
              <span className="legend dot warning" /> risky
              <span className="legend dot certain" /> confirmed
            </div>
          </div>

          <div className="board-grid" style={{ gridTemplateColumns: `160px repeat(${GRID_SIZE}, 1fr)` }}>
            <div className="corner">
              <p className="corner-title">Clues</p>
              <p className="corner-sub">Sum | Voltorbs</p>
            </div>

            {colClues.map((clue, col) => (
              <div key={`col-${col}`} className="clue-cell">
                <label>Col {col + 1}</label>
                <div className="clue-inputs">
                  <input
                    type="number"
                    min="0"
                    placeholder="Sum"
                    value={clue.sum}
                    onChange={(e) => updateClue(setColClues, col, 'sum', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Voltorbs"
                    value={clue.voltorbs}
                    onChange={(e) => updateClue(setColClues, col, 'voltorbs', e.target.value)}
                  />
                </div>
              </div>
            ))}

            {rowClues.map((clue, row) => (
              <Fragment key={`row-${row}`}>
                <div className="clue-cell">
                  <label>Row {row + 1}</label>
                  <div className="clue-inputs">
                    <input
                      type="number"
                      min="0"
                      placeholder="Sum"
                      value={clue.sum}
                      onChange={(e) => updateClue(setRowClues, row, 'sum', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Voltorbs"
                      value={clue.voltorbs}
                      onChange={(e) => updateClue(setRowClues, row, 'voltorbs', e.target.value)}
                    />
                  </div>
                </div>

                {grid[row].map((value, col) => {
                  const isRecommended = results.recommended.some((item) => item.row === row && item.col === col)
                  const stats = results.stats?.[row]?.[col]
                  const risk = stats ? Math.round(stats.voltorbProbability * 100) : null
                  const expected = stats ? stats.expectedValue.toFixed(2) : null

                  let tone = 'neutral'
                  if (value === 'voltorb') tone = 'certain'
                  else if (isRecommended) tone = 'safe'
                  else if (stats && stats.voltorbProbability > 0.45) tone = 'warning'

                  return (
                    <button
                      key={`${row}-${col}`}
                      className={`cell ${tone}`}
                      onClick={() => cycleCellState(row, col)}
                    >
                      <div className="cell-label">{getCellLabel(value)}</div>
                      {stats && (
                        <div className="cell-meta">
                          <span>{risk}% risk</span>
                          <span>EV {expected}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </section>

        <section className="panel insights">
          <div className="panel-header">
            <h2>Solver insights</h2>
            <p className="hint">Based on all boards that fit your clues.</p>
          </div>
          <div className="insight-cards">
            <div className="stat-card">
              <p className="stat-label">Valid boards</p>
              <p className="stat-value">{results.solutions.length}</p>
              <p className="stat-sub">Exact matches to row and column clues.</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Safest tiles now</p>
              <p className="stat-value">{results.recommended.length || '-'}</p>
              <p className="stat-sub">Tiles with the lowest voltorb probability.</p>
            </div>
          </div>

          {results.issues.length > 0 && (
            <div className="alert">
              {results.issues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          )}

          <div className="guide">
            <h3>How to use</h3>
            <ol>
              <li>Copy the row and column sums and voltorb counts from your current Voltorb Flip board.</li>
              <li>Tap any tiles you have already revealed to set them as 1, 2, 3, or Voltorb.</li>
              <li>Watch the solver highlight the lowest-risk tiles. Flip those in-game, then update the board here.</li>
            </ol>
            <p className="microcopy">The solver explores every 5x5 layout that satisfies the clues, then scores each tile by voltorb probability.</p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
