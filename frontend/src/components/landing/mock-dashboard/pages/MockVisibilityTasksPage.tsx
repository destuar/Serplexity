/**
 * @file MockVisibilityTasksPage.tsx
 * @description Mock visibility tasks page for the dashboard preview carousel.
 * Shows a simulated Kanban board interface matching the actual VisibilityTasksPage with
 * drag-and-drop task management, status columns, and task details.
 */
import React, { useState } from 'react';
import { Loader, RefreshCw } from 'lucide-react';
import MockDashboardLayout from '../MockDashboardLayout';

// Mock task data structure matching OptimizationTask interface
interface MockOptimizationTask {
  taskId: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  category: string;
  impactMetric: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  isCompleted: boolean;
}

// Mock Kanban Column Component
const MockKanbanColumn: React.FC<{
  id: string;
  title: string;
  color: string;
  tasks: MockOptimizationTask[];
  count: number;
  onTaskClick?: (task: MockOptimizationTask) => void;
}> = ({ id: _id, title, color, tasks, count, onTaskClick }) => {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex items-center justify-between p-4 ${color} rounded-t-lg border-b border-gray-200`}>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-sm font-medium text-gray-600 bg-white/60 px-2 py-1 rounded-full">
          {count}
        </span>
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {tasks.map((task) => (
          <MockKanbanTaskCard 
            key={task.taskId} 
            task={task} 
            onClick={() => onTaskClick?.(task)}
          />
        ))}
      </div>
    </div>
  );
};

// Mock Task Card Component
const MockKanbanTaskCard: React.FC<{
  task: MockOptimizationTask;
  onClick?: () => void;
}> = ({ task, onClick }) => {
  const getPriorityColors = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Low': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div 
      className="group relative bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200 cursor-pointer touch-manipulation select-none"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-sm leading-tight pr-6">
          {task.title}
        </h4>
        <span className={`text-xs px-2 py-1 rounded-full font-medium border flex-shrink-0 ${getPriorityColors(task.priority)}`}>
          {task.priority}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 mb-4 line-clamp-3 leading-relaxed">
        {task.description}
      </p>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
          {task.category}
        </span>
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
          {task.impactMetric}
        </span>
      </div>
    </div>
  );
};

const MockVisibilityTasksPage: React.FC = () => {
  const [_selectedTask, _setSelectedTask] = useState<MockOptimizationTask | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const mockTasks: MockOptimizationTask[] = [
    {
      taskId: "S01",
      title: "Verify robots.txt & llms.txt",
      description: "Navigate to your website's robots.txt and create llms.txt with brand description. Upload both files via your CMS and confirm they return 200 status for better AI visibility.",
      priority: 'High',
      category: "Technical SEO",
      impactMetric: "inclusionRate",
      status: 'NOT_STARTED',
      isCompleted: false
    },
    {
      taskId: "S02", 
      title: "Implement Comprehensive Schema Markup",
      description: "Use schema markup generator for Organization, Product and Article. Add JSON-LD to header, test in rich-results tool, and resubmit to search console.",
      priority: 'High',
      category: "Technical SEO",
      impactMetric: "averagePosition",
      status: 'IN_PROGRESS',
      isCompleted: false
    },
    {
      taskId: "S03",
      title: "Create Brand-Specific Landing Pages",
      description: "Research top 10 queries where competitors rank but you don't. Create 500+ word landing pages with title tags including exact queries and your brand name naturally 3-5 times.",
      priority: 'High',
      category: "Content & Messaging",
      impactMetric: "visibility",
      status: 'COMPLETED',
      isCompleted: true
    },
    {
      taskId: "S04",
      title: "Optimize Core Service Pages for AI Mentions",
      description: "Add FAQ sections to your 5 most important service pages with 3-5 customer questions. Write clear answers including your brand name in 2-3 FAQ responses.",
      priority: 'High',
      category: "Content & Messaging",
      impactMetric: "inclusionRate",
      status: 'NOT_STARTED',
      isCompleted: false
    },
    {
      taskId: "S05",
      title: "Establish Thought Leadership Content Hub",
      description: "Choose 3 expertise topics and create dedicated resource pages with 5+ in-depth articles, case studies, and unique insights. Monitor AI search results for industry mentions.",
      priority: 'Medium',
      category: "Brand Positioning",
      impactMetric: "visibility",
      status: 'IN_PROGRESS',
      isCompleted: false
    }
  ];

  const columns = [
    { id: 'NOT_STARTED', title: 'Not Started', color: 'bg-gray-100' },
    { id: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-600/10' },
    { id: 'COMPLETED', title: 'Completed', color: 'bg-blue-600/20' }
  ];

  const tasksByStatus = mockTasks.reduce((acc, task) => {
    const status = task.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(task);
    return acc;
  }, {} as Record<string, MockOptimizationTask[]>);

  const handleRefresh = () => {
    setRefreshing(true);
    // Mock refresh delay
    setTimeout(() => setRefreshing(false), 1500);
  };

  const handleTaskClick = (task: MockOptimizationTask) => {
    setSelectedTask(task);
    // Mock task details modal would open here
  };

  const lastUpdated = new Date().toLocaleString();

  return (
    <MockDashboardLayout activePage="Visibility Tasks">
      <div className="h-full flex flex-col">
        {/* Header Controls - matching actual page */}
        <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black transition-colors text-sm font-medium"
            >
              {refreshing ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>Refresh Data</span>
                </>
              )}
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdated}
            </p>
          </div>
        </div>

        {/* Kanban Board Container - matching actual page structure */}
        <div 
          className="flex-1 min-h-0 p-1 relative" 
          style={{ overflow: "visible" }}
        >
          <div className="h-full relative" style={{ overflow: 'visible' }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0 overflow-visible">
              {columns.map((column) => (
                <div key={column.id} className="min-h-0 flex flex-col overflow-visible">
                  <MockKanbanColumn
                    id={column.id}
                    title={column.title}
                    color={column.color}
                    tasks={tasksByStatus[column.id] || []}
                    count={tasksByStatus[column.id]?.length || 0}
                    onTaskClick={handleTaskClick}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MockDashboardLayout>
  );
};

export default MockVisibilityTasksPage;