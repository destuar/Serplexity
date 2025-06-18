import { useState, useEffect } from 'react'
import './App.css'
import React from 'react'

interface Metric {
  date: string;
  query_id: number;
  engine: string;
  pawc: number;
  air: number;
  first_citation_idx: number | null;
}

const App: React.FC = () => {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiUrl}/api/metrics`)
        if (!response.ok) {
          throw new Error('Network response was not ok')
        }
        const data: Metric[] = await response.json()
        setMetrics(data)
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message)
        } else {
          setError('An unknown error occurred')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="App">
      <h1>Serplexity GEO Dashboard</h1>
      <h2>Metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Query ID</th>
            <th>Engine</th>
            <th>PAWC</th>
            <th>AIR</th>
            <th>First Citation Index</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, index) => (
            <tr key={index}>
              <td>{metric.date}</td>
              <td>{metric.query_id}</td>
              <td>{metric.engine}</td>
              <td>{metric.pawc.toFixed(2)}</td>
              <td>{metric.air}</td>
              <td>{metric.first_citation_idx}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
