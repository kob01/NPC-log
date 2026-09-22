import { Drawer, Button, Tree, message } from 'antd'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { DataNode } from 'antd/es/tree'
import type { Key } from 'antd/es/table/interface'

interface Props {
  isVisible: boolean
  treeData: DataNode[]
  checkedKeys: Key[]
  onClose: () => void
  onSubmit: (checked: Key[]) => void
}

const PermissionDrawer = (props: Props) => {
  const { t } = useTranslation()
  const { isVisible, treeData, checkedKeys, onClose, onSubmit } = props
  const [localCheckedKeys, setLocalCheckedKeys] = useState<Key[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setLocalCheckedKeys(checkedKeys)
  }, [checkedKeys])

  /**
   * 处理提交
   */
  const handleSubmit = async () => {
    try {
      setIsLoading(true)
      await onSubmit(localCheckedKeys)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 处理选择变化
   */
  const onCheck = (checked: Key[] | { checked: Key[]; halfChecked: Key[] }) => {
    if (Array.isArray(checked)) {
      setLocalCheckedKeys(checked)
    } else {
      setLocalCheckedKeys(checked.checked)
    }
  }

  return (
    <Drawer
      title={t('system.rolePermission')}
      width={400}
      open={isVisible}
      onClose={onClose}
      footer={
        <div className='flex justify-end'>
          <Button className='mr-2' onClick={onClose}>
            {t('public.cancel')}
          </Button>
          <Button type='primary' loading={isLoading} onClick={handleSubmit}>
            {t('public.confirm')}
          </Button>
        </div>
      }
    >
      {treeData.length > 0 ? (
        <Tree
          checkable
          treeData={treeData}
          checkedKeys={localCheckedKeys}
          onCheck={onCheck}
          defaultExpandAll
        />
      ) : (
        <div className='text-center text-gray-500 py-4'>{t('system.noMenuData')}</div>
      )}
    </Drawer>
  )
}

export default PermissionDrawer
