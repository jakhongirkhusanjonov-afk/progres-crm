'use client'

import { useEffect, useState } from 'react'
import { Modal, Button, Drawer } from 'antd'
import { CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons'

interface MobileModalProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number | string
  destroyOnClose?: boolean
  closable?: boolean
}

export default function MobileModal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 600,
  destroyOnClose = true,
  closable = true,
}: MobileModalProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Mobile: Full-screen Drawer
  if (isMobile) {
    return (
      <Drawer
        title={
          <div className="flex items-center gap-3">
            {closable && (
              <button
                onClick={onClose}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <ArrowLeftOutlined className="text-lg" />
              </button>
            )}
            <span className="font-semibold text-lg">{title}</span>
          </div>
        }
        placement="right"
        onClose={onClose}
        open={open}
        width="100%"
        closable={false}
        destroyOnClose={destroyOnClose}
        styles={{
          body: {
            padding: '16px',
            paddingBottom: footer ? '80px' : '16px',
            overflowY: 'auto',
          },
          header: {
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
          },
        }}
        footer={
          footer ? (
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
              {footer}
            </div>
          ) : null
        }
      >
        {children}
      </Drawer>
    )
  }

  // Desktop: Regular Modal
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={footer}
      width={width}
      destroyOnClose={destroyOnClose}
      closable={closable}
      centered
      styles={{
        body: { maxHeight: '70vh', overflowY: 'auto' }
      }}
    >
      {children}
    </Modal>
  )
}
