'use client'

import { useState, useEffect } from 'react'
import { Table, Card, Empty, Spin, Tag, Button, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

interface MobileTableProps<T> {
  columns: ColumnsType<T>
  dataSource: T[]
  loading?: boolean
  rowKey?: string | ((record: T) => string)
  pagination?: {
    current: number
    pageSize: number
    total: number
    onChange: (page: number) => void
  }
  mobileCardRender?: (record: T, index: number) => React.ReactNode
  onRowClick?: (record: T) => void
  emptyText?: string
  actions?: {
    onView?: (record: T) => void
    onEdit?: (record: T) => void
    onDelete?: (record: T) => void
  }
}

export default function MobileTable<T extends { id?: string }>({
  columns,
  dataSource,
  loading = false,
  rowKey = 'id',
  pagination,
  mobileCardRender,
  onRowClick,
  emptyText = "Ma'lumot topilmadi",
  actions,
}: MobileTableProps<T>) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  // Empty state
  if (!dataSource || dataSource.length === 0) {
    return (
      <Empty
        description={emptyText}
        className="py-12"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <div className="space-y-3">
        {dataSource.map((record, index) => {
          const key = typeof rowKey === 'function' ? rowKey(record) : (record as any)[rowKey]

          // Custom card render
          if (mobileCardRender) {
            return (
              <div key={key} onClick={() => onRowClick?.(record)}>
                {mobileCardRender(record, index)}
              </div>
            )
          }

          // Default card render
          return (
            <Card
              key={key}
              size="small"
              className="shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50"
              onClick={() => onRowClick?.(record)}
              styles={{ body: { padding: '12px' } }}
            >
              <div className="space-y-2">
                {columns
                  .filter(col => col.key !== 'actions' && ('dataIndex' in col ? col.dataIndex !== 'actions' : true))
                  .slice(0, 4)
                  .map((col, colIndex) => {
                    const dataIndex = 'dataIndex' in col ? col.dataIndex as string : undefined
                    const value = dataIndex ? (record as any)[dataIndex] : null
                    const rendered = col.render
                      ? col.render(value, record, index)
                      : value

                    return (
                      <div key={colIndex} className="flex justify-between items-start">
                        <span className="text-gray-500 text-sm">{col.title as string}:</span>
                        <span className="text-gray-900 text-sm font-medium text-right max-w-[60%]">
                          {rendered}
                        </span>
                      </div>
                    )
                  })}

                {/* Actions */}
                {actions && (
                  <div className="flex gap-2 pt-2 border-t mt-2">
                    {actions.onView && (
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.onView!(record)
                        }}
                        className="flex-1 h-9"
                      >
                        Ko'rish
                      </Button>
                    )}
                    {actions.onEdit && (
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.onEdit!(record)
                        }}
                        className="flex-1 h-9"
                      >
                        Tahrir
                      </Button>
                    )}
                    {actions.onDelete && (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          actions.onDelete!(record)
                        }}
                        className="h-9"
                      />
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}

        {/* Mobile Pagination */}
        {pagination && pagination.total > pagination.pageSize && (
          <div className="flex justify-center pt-4">
            <Pagination
              current={pagination.current}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={pagination.onChange}
              size="small"
              simple
            />
          </div>
        )}
      </div>
    )
  }

  // Desktop Table View
  return (
    <div className="overflow-x-auto">
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey={rowKey}
        pagination={
          pagination
            ? {
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                onChange: pagination.onChange,
                showSizeChanger: false,
                showTotal: (total) => `Jami: ${total}`,
              }
            : false
        }
        onRow={(record) => ({
          onClick: () => onRowClick?.(record),
          style: { cursor: onRowClick ? 'pointer' : 'default' },
        })}
        scroll={{ x: 'max-content' }}
        size="middle"
      />
    </div>
  )
}
