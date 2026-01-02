import { Fragment, useEffect, useMemo, useState } from 'react'
import './App.css'

const GRID_SIZE = 5
const MAX_VISITED = 200000 

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
  const numeric = parseInt(value, 10)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return numeric
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

function hasPointsLeft(gridLine, clue) {
  const sumTarget = parseClueValue(clue.sum)
  const voltorbTarget = parseClueValue(clue.voltorbs)
  
  if (sumTarget === null) return true 

  let currentSum = 0
  let currentVoltorbs = 0
  let unknownCount = 0
  
  for (const cell of gridLine) {
    if (typeof cell === 'number') currentSum += cell
    else if (cell === 'voltorb') currentVoltorbs += 1
    else if (cell === 'unknown') unknownCount++
  }

  const remainingSum = sumTarget - currentSum
  
  let remainingVoltorbs = 0
  if (voltorbTarget !== null) {
      remainingVoltorbs = Math.max(0, voltorbTarget - currentVoltorbs)
  }

  const valueSlots = Math.max(0, unknownCount - remainingVoltorbs)
  return remainingSum > valueSlots
}

function evaluateBoards(grid, rowClues, colClues) {
  const colSumTargets = colClues.map((clue) => parseClueValue(clue.sum))
  const colVoltorbTargets = colClues.map((clue) => parseClueValue(clue.voltorbs))
  const allCluesEntered = [...rowClues, ...colClues].every(
    (clue) => parseClueValue(clue.sum) !== null && parseClueValue(clue.voltorbs) !== null
  )

  if (!allCluesEntered) {
    return {
      solutionCount: 0,
      stats: null,
      recommended: [],
      issues: ['Please fill in all 10 row and column clues to start calculation.'],
      isLevelComplete: false
    }
  }
  
  let potentialPointsRemaining = false
  let validCluesFound = false

  for (let r = 0; r < GRID_SIZE; r++) {
    if (parseClueValue(rowClues[r].sum) !== null) {
      validCluesFound = true
      if (hasPointsLeft(grid[r], rowClues[r])) {
        potentialPointsRemaining = true
        break
      }
    }
  }

  if (!potentialPointsRemaining) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (parseClueValue(colClues[c].sum) !== null) {
        validCluesFound = true
        const colCells = grid.map(row => row[c])
        if (hasPointsLeft(colCells, colClues[c])) {
          potentialPointsRemaining = true
          break
        }
      }
    }
  }

  const isLevelComplete = validCluesFound && !potentialPointsRemaining

  const zeroHintSafeTiles = []
  rowClues.forEach((clue, r) => {
    if (parseClueValue(clue.voltorbs) === 0 && hasPointsLeft(grid[r], clue)) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === 'unknown' && !zeroHintSafeTiles.some(t => t.row === r && t.col === c)) 
           zeroHintSafeTiles.push({ row: r, col: c })
      }
    }
  })
  colClues.forEach((clue, c) => {
    if (parseClueValue(clue.voltorbs) === 0) {
      const colCells = grid.map(row => row[c])
      if (hasPointsLeft(colCells, clue)) {
        for (let r = 0; r < GRID_SIZE; r++) {
          if (grid[r][c] === 'unknown' && !zeroHintSafeTiles.some(t => t.row === r && t.col === c))
            zeroHintSafeTiles.push({ row: r, col: c })
        }
      }
    }
  })

  const hasAnyClue = [...rowClues, ...colClues].some(
    (clue) => parseClueValue(clue.sum) !== null || parseClueValue(clue.voltorbs) !== null
  )

  if (!hasAnyClue) {
    return { solutionCount: 0, stats: null, recommended: [], issues: ['Add clues to start.'], isLevelComplete: false }
  }

  const rowOptions = rowClues.map((clue, rowIndex) => filterRowPatterns(grid[rowIndex], clue))
  
  if (rowOptions.some((options) => options.length === 0)) {
    return { solutionCount: 0, stats: null, recommended: [], issues: ['Invalid board configuration.'], isLevelComplete: false }
  }

  const stats = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ voltorbCount: 0, sumValues: 0 }))
  )
  
  let solutionCount = 0
  let visited = 0
  let truncated = false

  const backtrack = (rowIndex, currentBoard, colSums, colVoltorbs) => {
      if (truncated) return
      visited++
      if (visited > MAX_VISITED) { truncated = true; return }

      if (rowIndex === GRID_SIZE) {
          for (let col = 0; col < GRID_SIZE; col++) {
              const targetSum = colSumTargets[col]
              const targetVolts = colVoltorbTargets[col]
              if (targetSum !== null && colSums[col] !== targetSum) return
              if (targetVolts !== null && colVoltorbs[col] !== targetVolts) return
          }
          solutionCount++
          for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                  const val = currentBoard[r][c]
                  if (val === 'voltorb') stats[r][c].voltorbCount++
                  else stats[r][c].sumValues += val
              }
          }
          return
      }

      for (const pattern of rowOptions[rowIndex]) {
          const nextSums = [...colSums]
          const nextVolts = [...colVoltorbs]
          let possible = true

          for (let c = 0; c < GRID_SIZE; c++) {
              const val = pattern.cells[c]
              nextSums[c] += (val === 'voltorb' ? 0 : val)
              nextVolts[c] += (val === 'voltorb' ? 1 : 0)
              
              if (colSumTargets[c] !== null && nextSums[c] > colSumTargets[c]) { possible = false; break; }
              if (colVoltorbTargets[c] !== null && nextVolts[c] > colVoltorbTargets[c]) { possible = false; break; }
          }

          if (possible) {
              const nextBoard = [...currentBoard, pattern.cells]
              backtrack(rowIndex + 1, nextBoard, nextSums, nextVolts)
          }
          if (truncated) return
      }
  }

  backtrack(0, [], Array(GRID_SIZE).fill(0), Array(GRID_SIZE).fill(0))

  if (solutionCount === 0) {
    return { solutionCount, stats: null, recommended: [], issues: ['No solution found.'], isLevelComplete: false }
  }

  const probabilities = stats.map((row) =>
    row.map((entry) => ({
      voltorbProbability: entry.voltorbCount / solutionCount,
      expectedValue: entry.sumValues / solutionCount,
    }))
  )

  let recommended = []
  let mode = 'probabilistic'

  if (zeroHintSafeTiles.length > 0) {
      recommended = zeroHintSafeTiles
      mode = 'certainty'
  } else {
      let minRisk = 1.1
      probabilities.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (grid[r][c] === 'unknown') {
            const risk = Math.round(cell.voltorbProbability * 10000) / 10000
            if (risk < minRisk) minRisk = risk
          }
        })
      })

      probabilities.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (grid[r][c] === 'unknown') {
             const risk = Math.round(cell.voltorbProbability * 10000) / 10000
             if (risk === minRisk) {
                const rowUseful = hasPointsLeft(grid[r], rowClues[r])
                const colCells = grid.map(rw => rw[c])
                const colUseful = hasPointsLeft(colCells, colClues[c])
                if (rowUseful || colUseful) {
                    recommended.push({ row: r, col: c })
                }
             }
          }
        })
      })
  }

  const issues = []
  if (truncated) issues.push('Complex board. Calculation approximated.')

  return { solutionCount, stats: probabilities, recommended, issues, mode, isLevelComplete }
}

function Tile({ value, tone, riskLabel, evLabel, isOpen, onOpen, onSelect, menuPosition, isDetectedVoltorb }) {
  const showVoltorb = value === 'voltorb' || isDetectedVoltorb

  return (
    <div
      className={`cell ${tone} ${isOpen ? 'is-open' : ''} ${isDetectedVoltorb ? 'detected-voltorb' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="cell-label">
        {showVoltorb ? (
            <img src="voltorb.png" alt="Voltorb" className="voltorb-sprite" />
        ) : value === 'unknown' ? '?' : value}
      </div>
      
      {value === 'unknown' && !isDetectedVoltorb && riskLabel && (
        <div className="cell-meta">
          <span>{riskLabel}</span>
          {evLabel && <span>{evLabel}</span>}
        </div>
      )}

      {isDetectedVoltorb && value === 'unknown' && (
        <div className="cell-meta danger-text">
          100% VOLTORB
        </div>
      )}

      {isOpen && (
        <div
          className={`cell-menu menu-${menuPosition}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <p className="cell-menu-title">What was here?</p>
          <div className="cell-menu-grid">
            <button onClick={(e) => { e.stopPropagation(); onSelect(1) }}>1</button>
            <button onClick={(e) => { e.stopPropagation(); onSelect(2) }}>2</button>
            <button onClick={(e) => { e.stopPropagation(); onSelect(3) }}>3</button>
            <button className="danger" onClick={(e) => { e.stopPropagation(); onSelect('voltorb') }}>
              <img src="voltorbicon.png" alt="" />
            </button>
            <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); onSelect('unknown') }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [grid, setGrid] = useState(Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 'unknown')))
  const [rowClues, setRowClues] = useState(Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' })))
  const [colClues, setColClues] = useState(Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' })))
  const [openCell, setOpenCell] = useState(null)

  const results = useMemo(() => evaluateBoards(grid, rowClues, colClues), [grid, rowClues, colClues])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') setOpenCell(null) }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const updateClue = (setter, index, field, value) => {
    setter((prev) => {
      const next = prev.map((clue) => ({ ...clue }))
      next[index][field] = value
      return next
    })
  }

  const setCellValue = (row, col, value) => {
    setGrid((prev) => {
      const next = prev.map((r) => r.slice())
      next[row][col] = value
      return next
    })
  }

  const handleSelect = (row, col, value) => {
    setCellValue(row, col, value)
    setOpenCell(null)
  }

  const clearBoard = () => {
    setGrid(Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 'unknown')))
    setRowClues(Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' })))
    setColClues(Array.from({ length: GRID_SIZE }, () => ({ sum: '', voltorbs: '' })))
    setOpenCell(null)
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Voltorb Flip Solver</p>
          <h1>Find the safest flips</h1>
          <p className="lede">
            Enter clues, reveal tiles, and let the math guide you.
          </p>
        </div>
        <div className="hero-actions">
          <button className="ghost" onClick={clearBoard}>Reset board</button>
        </div>
      </header>

      {results.isLevelComplete && (
        <div className="level-complete">
          <h2>Level Complete!</h2>
          <p>No more 2s or 3s left. Reset the board to start the next level.</p>
        </div>
      )}

      <main className="layout">
        <section className="panel board-panel">
          <div className="panel-header">
            <div>
              <h2>Board and hints</h2>
              <p className="hint">Tap a tile to enter result (1, 2, 3, Voltorb).</p>
            </div>
            <div className="mini-legend">
              <span className="pill recommended-pill">Safe</span>
              <span className="pill risk-pill">Risky</span>
              <span className="pill voltorb-pill">
                <img src="voltorbicon.png" alt="Voltorb" /> Voltorb
              </span>
            </div>
          </div>
          <div className="board-wrapper">
            <div className="grid">
              {grid.map((row, r) => (
                <Fragment key={r}>
                  <div className="row">
                    {row.map((value, c) => {
                      const isRecommended = results.recommended.some((item) => item.row === r && item.col === c)
                      
                      const stats = results.stats?.[r]?.[c]
                      const riskProb = stats ? stats.voltorbProbability : null
                      const expected = stats ? stats.expectedValue.toFixed(2) : null
                      const riskPercent = riskProb !== null ? Math.round(riskProb * 100) : null

                      const isDetectedVoltorb = riskProb !== null && riskProb > 0.999

                      let tone = 'neutral'
                      let riskLabel = null
                      
                      if (value === 'unknown') {
                        if (isDetectedVoltorb) {
                           tone = 'certain' 
                        } else if (isRecommended) {
                          tone = 'safe'
                          riskLabel = (results.mode === 'certainty' || riskPercent === 0) ? '0% Risk' : `${riskPercent}% Risk`
                        } else if (riskPercent !== null) {
                            riskLabel = `${riskPercent}% Risk`
                            if (riskPercent >= 50) tone = 'warning'
                        }
                      } else if (value === 'voltorb') {
                        tone = 'certain'
                      }

                      let menuPosition = 'center'
                      if (r <= 1) menuPosition = 'bottom'
                      if (r >= 3) menuPosition = 'top'

                      return (
                        <Tile
                          key={`${r}-${c}`}
                          value={value}
                          tone={tone}
                          riskLabel={riskLabel}
                          evLabel={value === 'unknown' && !isDetectedVoltorb && expected ? `EV ${expected}` : null}
                          isOpen={openCell?.row === r && openCell?.col === c}
                          onOpen={() => setOpenCell({ row: r, col: c })}
                          onSelect={(val) => handleSelect(r, c, val)}
                          menuPosition={menuPosition}
                          isDetectedVoltorb={isDetectedVoltorb}
                        />
                      )
                    })}
                    <div className="clue clue-right">
                      <input
                        type="number"
                        min="0"
                        aria-label={`Row ${r + 1} sum`}
                        placeholder="Sum"
                        value={rowClues[r].sum}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateClue(setRowClues, r, 'sum', e.target.value)}
                      />
                      <div className="voltorb-clue">
                        <img src="voltorbicon.png" alt="Voltorb count" />
                        <input
                          type="number"
                          min="0"
                          aria-label={`Row ${r + 1} voltorbs`}
                          placeholder="#"
                          value={rowClues[r].voltorbs}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateClue(setRowClues, r, 'voltorbs', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </Fragment>
              ))}
              <div className="bottom-clues">
                {colClues.map((clue, c) => (
                  <div className="clue clue-bottom" key={c}>
                    <input
                      type="number"
                      min="0"
                      aria-label={`Column ${c + 1} sum`}
                      placeholder="Sum"
                      value={clue.sum}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateClue(setColClues, c, 'sum', e.target.value)}
                    />
                    <div className="voltorb-clue">
                      <img src="voltorbicon.png" alt="Voltorb count" />
                      <input
                        type="number"
                        min="0"
                        aria-label={`Column ${c + 1} voltorbs`}
                        placeholder="#"
                        value={clue.voltorbs}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateClue(setColClues, c, 'voltorbs', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <div className="clue-spacer" aria-hidden="true"></div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel insights">
          <div className="panel-header">
            <h2>Solver insights</h2>
          </div>
          
          <div className="insight-cards">
            <div className="stat-card">
              <p className="stat-label">Valid boards</p>
              <p className="stat-value">{results.solutionCount}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Safest tiles</p>
              <p className="stat-value">{results.recommended.length}</p>
            </div>
          </div>

          {results.issues.length > 0 && (
            <div className="alert">
              {results.issues.map((issue, idx) => (
                <p key={idx}>{issue}</p>
              ))}
            </div>
          )}

          <div className="guide">
            <h3>Strategy</h3>
            {results.isLevelComplete ? (
               <p className="advice highlight">
                 <strong>Congratulations!</strong><br/>
                 You have found all point multipliers. You can safely stop now.
               </p>
            ) : results.mode === 'certainty' ? (
              <p className="advice highlight">
                <strong>Zero-voltorb rows detected!</strong><br/>
                Flip the highlighted green tiles. They are 100% safe.
              </p>
            ) : results.recommended.length > 0 ? (
               <p className="advice">
                 No definite safe spots. Highlighting tiles with the lowest statistical risk.
               </p>
            ) : (
              <p className="advice">Enter clues to begin.</p>
            )}
            
            <hr />
            <ol>
               <li>Enter row/col sums & voltorbs.</li>
               <li>Flip highlights first.</li>
               <li><strong>Update the board</strong> with the result (1/2/3).</li>
               <li>Recalculate.</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App