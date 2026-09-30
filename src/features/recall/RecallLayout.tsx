import { Outlet } from 'react-router-dom'
import { RecallTabs } from './RecallTabs'

export function RecallLayout() {
  return (
    <div className="flex flex-col">
      <RecallTabs />
      <Outlet />
    </div>
  )
}
